"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpenCheck, BriefcaseBusiness, CalendarClock, Pencil, Plus, Search, UserRound, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { TeacherWorkspaceData } from "@/modules/teachers/repository";
import { addTeacherAction, editTeacherAction, saveTeacherAvailabilityAction, saveTeacherProfileAction, saveTeacherSubjectAssignmentsAction } from "@/modules/teachers/actions";
import { ManagedForm } from "@/components/planning/managed-form";
import type { ActionState } from "@/modules/planning/action-state";
import { cn } from "@/lib/utils";

const employmentLabels = { FULL_TIME: "تمام‌وقت", PART_TIME: "پاره‌وقت", CONTRACT: "قراردادی" } as const;
const staffLabels = { TEACHER: "دبیر", VICE_PRINCIPAL: "معاون", EDUCATIONAL_DEPUTY: "معاون آموزشی", EXECUTIVE_DEPUTY: "معاون اجرایی", CULTURAL_DEPUTY: "معاون فرهنگی", OTHER: "سایر کارکنان" } as const;
const availabilityLabels = { AVAILABLE: "مجاز", UNAVAILABLE: "غایب", PREFERRED: "ترجیحی", RESTRICTED: "محدود" } as const;

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("fa-IR").replaceAll("ي", "ی").replaceAll("ك", "ک").replaceAll("‌", " ");
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) { return <label className="compact-field"><span>{label}</span>{children}</label>; }

function teacherDisplayName(teacher: Pick<NonNullable<TeacherWorkspaceData["selectedTeacher"]>, "firstName" | "lastName">) {
  return `${teacher.firstName} ${teacher.lastName}`.trim();
}

function teacherInitials(teacher: Pick<NonNullable<TeacherWorkspaceData["selectedTeacher"]>, "firstName" | "lastName">) {
  return [teacher.firstName.trim()[0], teacher.lastName.trim()[0]].filter(Boolean).join("") || "د";
}

function TeacherFields({ teacher }: { teacher?: TeacherWorkspaceData["selectedTeacher"] }) {
  return <><Labeled label="نام (در صورت ثبت)"><Input name="firstName" defaultValue={teacher?.firstName} /></Labeled><Labeled label="نام خانوادگی"><Input name="lastName" defaultValue={teacher?.lastName} placeholder="حداقل نام یا نام خانوادگی" /></Labeled><Labeled label="کد پرسنلی"><Input name="personnelCode" required defaultValue={teacher?.personnelCode} /></Labeled><Labeled label="نوع همکاری"><Select name="employmentType" defaultValue={teacher?.employmentType ?? "FULL_TIME"}>{Object.entries(employmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Labeled><Labeled label="مسئولیت"><Select name="staffKind" defaultValue={teacher?.staffKind ?? "TEACHER"}>{Object.entries(staffLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Labeled><Labeled label="یادداشت"><Input name="notes" defaultValue={teacher?.notes ?? ""} placeholder="اختیاری" /></Labeled></>;
}

function TeacherIdentityEditor({ teacher }: { teacher: NonNullable<TeacherWorkspaceData["selectedTeacher"]> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const teacherRevision = [teacher.id, teacher.firstName, teacher.lastName, teacher.personnelCode, teacher.employmentType, teacher.staffKind, teacher.notes ?? "", teacher.isActive].join(":");
  const toggleEditing = () => {
    setFormVersion((version) => version + 1);
    setIsEditing((editing) => !editing);
  };
  return <section className="panel teacher-section">
    <div className="teacher-section__title">
      <div><UserRound size={18} /><span><strong>{teacherDisplayName(teacher)}</strong><small>{isEditing ? "در حال ویرایش اطلاعات دبیر" : "اطلاعات پایدار دبیر · فقط خواندنی"}</small></span></div>
      <div className="teacher-section__actions"><Badge variant={teacher.isActive ? "success" : "warning"}>{teacher.isActive ? "فعال" : "غیرفعال"}</Badge><Button type="button" variant="secondary" size="sm" onClick={toggleEditing} aria-pressed={isEditing}>{isEditing ? <X size={15} /> : <Pencil size={15} />}{isEditing ? "لغو ویرایش" : "ویرایش اطلاعات دبیر"}</Button></div>
    </div>
    <ManagedForm key={`${teacherRevision}:${formVersion}`} action={editTeacherAction} submitLabel="ذخیره مشخصات" hideSubmit={!isEditing} refreshOnSuccess onSuccess={() => setIsEditing(false)}>
      <input type="hidden" name="teacherId" value={teacher.id} />
      <fieldset className="form-grid form-grid--three teacher-identity-fields" disabled={!isEditing}>
        <TeacherFields teacher={teacher} />
        <label className="check-field"><input type="checkbox" name="isActive" defaultChecked={teacher.isActive} /> دبیر فعال است</label>
      </fieldset>
    </ManagedForm>
  </section>;
}

type TeacherDetail = NonNullable<TeacherWorkspaceData["selectedTeacher"]>;
type AvailabilityValue = TeacherDetail["availability"][string];

function normalizedAvailability(teacher: TeacherDetail, schoolDays: TeacherWorkspaceData["schoolDays"]) {
  return Object.fromEntries(schoolDays.flatMap((day) => day.periods.map((period) => [period.id, teacher.availability[period.id] ?? "AVAILABLE"]))) as Record<string, AvailabilityValue>;
}

function availabilityRevision(values: Record<string, AvailabilityValue>, schoolDays: TeacherWorkspaceData["schoolDays"]) {
  return schoolDays.flatMap((day) => day.periods.map((period) => `${period.id}:${values[period.id] ?? "MISSING"}`)).join("|");
}

function savedAvailabilityFrom(state: ActionState, fallback: Record<string, AvailabilityValue>) {
  if (!state.data || typeof state.data !== "object" || !("availability" in state.data) || !state.data.availability || typeof state.data.availability !== "object") return fallback;
  return state.data.availability as Record<string, AvailabilityValue>;
}

function TeacherAvailabilityEditor({ teacher, academicYearId, schoolDays }: { teacher: TeacherDetail; academicYearId: string; schoolDays: TeacherWorkspaceData["schoolDays"] }) {
  const positions = [...new Set(schoolDays.flatMap((day) => day.periods.map((period) => period.position)))].sort((a, b) => a - b);
  const initialAvailability = normalizedAvailability(teacher, schoolDays);
  const isInitiallyComplete = schoolDays.every((day) => day.periods.every((period) => teacher.availability[period.id] !== undefined));
  const [availability, setAvailability] = useState(initialAvailability);
  const [savedRevision, setSavedRevision] = useState(isInitiallyComplete ? availabilityRevision(initialAvailability, schoolDays) : "");
  const currentRevision = availabilityRevision(availability, schoolDays);
  const hasUnsavedChanges = currentRevision !== savedRevision;

  return (
    <ManagedForm action={saveTeacherAvailabilityAction} submitLabel="ذخیره جدول حضور" className="availability-form" refreshOnSuccess onSuccess={(state) => { const saved = savedAvailabilityFrom(state, availability); setAvailability(saved); setSavedRevision(availabilityRevision(saved, schoolDays)); }}>
      <input type="hidden" name="teacherId" value={teacher.id} />
      <input type="hidden" name="academicYearId" value={academicYearId} />
      <div className="availability-sync-state" aria-live="polite">
        <Badge variant={hasUnsavedChanges ? "warning" : "success"}>{hasUnsavedChanges ? "تغییر ذخیره‌نشده" : "همگام با اطلاعات ذخیره‌شده"}</Badge>
      </div>
      <div className="availability-grid-wrap">
        <table className="availability-grid">
          <thead><tr><th>زنگ</th>{schoolDays.map((day) => <th key={day.id}>{day.label}</th>)}</tr></thead>
          <tbody>{positions.map((position) => <tr key={position}><th>زنگ {position.toLocaleString("fa-IR")}</th>{schoolDays.map((day) => {
            const period = day.periods.find((item) => item.position === position);
            if (!period) return <td key={day.id}><span className="no-period">—</span></td>;
            const status = availability[period.id] ?? "AVAILABLE";
            return <td key={day.id} className={cn("availability-slot", `is-${status.toLowerCase()}`)}><Select name={`slot:${period.id}`} value={status} onChange={(event) => setAvailability((current) => ({ ...current, [period.id]: event.target.value as AvailabilityValue }))} aria-label={`${day.label} ${period.label}`}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><small><bdi>{period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}</bdi></small></td>;
          })}</tr>)}</tbody>
        </table>
      </div>
    </ManagedForm>
  );
}

function SubjectAssignmentPicker({ subjects, assignmentBySubject }: { subjects: TeacherWorkspaceData["subjects"]; assignmentBySubject: Map<string, number> }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState(() => new Set(assignmentBySubject.keys()));
  const normalizedQuery = normalizeSearch(query);
  const availableSubjects = subjects
    .filter((subject) => subject.isActive || assignmentBySubject.has(subject.id))
    .sort((left, right) => Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id)) || left.name.localeCompare(right.name, "fa"));
  const isVisible = (subject: TeacherWorkspaceData["subjects"][number]) => {
    const matchesQuery = !normalizedQuery || normalizeSearch(subject.name).includes(normalizedQuery);
    return matchesQuery && (scope === "all" || selectedIds.has(subject.id));
  };
  const visibleCount = availableSubjects.filter(isVisible).length;

  return <>
    <div className="subject-assignment-toolbar">
      <label className="compact-search">
        <Search size={16} aria-hidden="true" />
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="جست‌وجوی درس" placeholder="جست‌وجوی نام درس…" />
      </label>
      <div className="subject-scope" aria-label="فیلتر درس‌ها">
        <button type="button" className={cn(scope === "all" && "is-active")} aria-pressed={scope === "all"} onClick={() => setScope("all")}>همه</button>
        <button type="button" className={cn(scope === "selected" && "is-active")} aria-pressed={scope === "selected"} onClick={() => setScope("selected")}>انتخاب‌شده <span>{selectedIds.size.toLocaleString("fa-IR")}</span></button>
      </div>
      <small>{visibleCount.toLocaleString("fa-IR")} درس نمایش داده می‌شود</small>
    </div>
    <div className="subject-assignment-grid" role="group" aria-label="انتخاب درس‌ها و ساعت تخصیص">
      {availableSubjects.map((subject) => {
        const assigned = assignmentBySubject.get(subject.id);
        const selected = selectedIds.has(subject.id);
        return <label key={subject.id} hidden={!isVisible(subject)} className={cn(selected && "is-selected")}>
          <span><input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={assigned !== undefined} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(subject.id); else next.delete(subject.id); return next; })} /> {subject.name}</span>
          <Input name={`hours:${subject.id}`} inputMode="numeric" min="1" max="100" defaultValue={assigned || ""} aria-label={`ساعت تخصیص ${subject.name}`} placeholder="ساعت" />
        </label>;
      })}
      {visibleCount === 0 ? <div className="subject-search-empty"><BookOpenCheck size={21} /><span>{scope === "selected" ? "درسی با این جست‌وجو انتخاب نشده است." : "درسی با این نام پیدا نشد."}</span></div> : null}
      {!subjects.some((item) => item.isActive) ? <span className="muted">ابتدا درس‌ها را در گام قبل تعریف کنید.</span> : null}
    </div>
  </>;
}

export function TeacherWorkspace({ data, embedded = false }: { data: TeacherWorkspaceData; embedded?: boolean }) {
  const [teacherQuery, setTeacherQuery] = useState("");
  const selected = data.selectedTeacher;
  const selectHref = (teacherId: string) => embedded ? `/planning?step=teachers&teacher=${teacherId}` : `/teachers?teacher=${teacherId}`;
  const defaults = selected?.profile ?? { minimumWorkload: 20, requiredWorkload: 24, maximumWorkload: 24, overtimeAllowance: 4, dailyMinimum: 0, dailyMaximum: 6, maxConsecutive: 3 };
  const assignedHours = selected?.subjectAssignments.reduce((sum, item) => sum + item.assignedWeeklyHours, 0) ?? 0;
  const currentOvertime = selected?.profile ? Math.max(0, assignedHours - selected.profile.requiredWorkload) : 0;
  const assignmentBySubject = new Map(selected?.subjectAssignments.map((item) => [item.subjectId, item.assignedWeeklyHours]) ?? []);
  const normalizedTeacherQuery = normalizeSearch(teacherQuery);
  const visibleTeachers = data.teachers.filter((teacher) => !normalizedTeacherQuery || normalizeSearch(`${teacher.firstName} ${teacher.lastName} ${teacher.personnelCode}`).includes(normalizedTeacherQuery));
  return (
    <div className="teacher-workspace">
      <aside className="teacher-directory panel">
        <div className="panel__header"><div><h2>دبیران</h2><p>{data.teachers.length.toLocaleString("fa-IR")} نفر ثبت‌شده</p></div><UsersRound size={19} /></div>
        <label className="compact-search teacher-directory__search"><Search size={16} aria-hidden="true" /><Input type="search" value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} aria-label="جست‌وجوی دبیر" placeholder="نام یا کد پرسنلی…" /></label>
        <div className="teacher-list">{visibleTeachers.map((teacher) => <Link href={selectHref(teacher.id)} key={teacher.id} className={cn("teacher-list__item", teacher.id === selected?.id && "is-active")}><span className="avatar">{teacherInitials(teacher)}</span><div><strong>{teacherDisplayName(teacher)}</strong><small>{staffLabels[teacher.staffKind]} · {employmentLabels[teacher.employmentType]}</small></div>{!teacher.isActive ? <Badge variant="warning">غیرفعال</Badge> : null}</Link>)}{!data.teachers.length ? <div className="directory-empty"><UserRound size={24} /><span>هنوز دبیری ثبت نشده است.</span></div> : visibleTeachers.length === 0 ? <div className="directory-empty directory-empty--compact"><Search size={21} /><span>دبیری با این مشخصات پیدا نشد.</span></div> : null}</div>
        <details className="inline-disclosure teacher-add"><summary><Plus size={15} /> افزودن دبیر</summary><ManagedForm action={addTeacherAction} submitLabel="افزودن دبیر" className="form-grid form-grid--two"><TeacherFields /></ManagedForm></details>
      </aside>

      <main className="teacher-detail" key={selected?.id ?? "no-teacher"}>
        {!data.activeAcademicYear ? <section className="panel inline-callout">ابتدا یک سال تحصیلی فعال تعریف کنید.</section> : !selected ? <section className="panel teacher-empty"><UserRound size={28} /><h2>یک دبیر اضافه کنید</h2><p>مشخصات، درس‌ها، موظفی و حضور در همین صفحه مدیریت می‌شوند.</p></section> : <>
          <TeacherIdentityEditor teacher={selected} />

          <div className="teacher-detail-grid">
            <section className="panel teacher-section">
              <div className="teacher-section__title"><div><BriefcaseBusiness size={18} /><span><strong>درس‌ها و موظفی</strong><small>{data.activeAcademicYear.title}</small></span></div></div>
              <ManagedForm compact action={saveTeacherSubjectAssignmentsAction} submitLabel="ذخیره تخصیص درس‌ها" refreshOnSuccess>
                <input type="hidden" name="teacherId" value={selected.id} />
                <input type="hidden" name="academicYearId" value={data.activeAcademicYear.id} />
                <div className="subject-assignment-summary"><span>جمع تخصیص سالانه</span><strong>{assignedHours.toLocaleString("fa-IR")} ساعت</strong>{selected.profile ? <small>موظفی: {selected.profile.requiredWorkload.toLocaleString("fa-IR")} ساعت{currentOvertime > 0 ? ` · اضافه‌کار فعلی: ${currentOvertime.toLocaleString("fa-IR")} ساعت` : ""}</small> : <small>موظفی هنوز ثبت نشده است.</small>}</div>
                <SubjectAssignmentPicker subjects={data.subjects} assignmentBySubject={assignmentBySubject} />
              </ManagedForm>
              <ManagedForm compact action={saveTeacherProfileAction} submitLabel="ذخیره موظفی" className="workload-form" refreshOnSuccess><input type="hidden" name="teacherId" value={selected.id} /><input type="hidden" name="academicYearId" value={data.activeAcademicYear.id} /><Labeled label="حداقل"><Input name="minimumWorkload" inputMode="numeric" defaultValue={defaults.minimumWorkload} required /></Labeled><Labeled label="موظفی"><Input name="requiredWorkload" inputMode="numeric" defaultValue={defaults.requiredWorkload} required /></Labeled><Labeled label="حداکثر"><Input name="maximumWorkload" inputMode="numeric" defaultValue={defaults.maximumWorkload} required /></Labeled><Labeled label="اضافه‌کاری مجاز"><Input name="overtimeAllowance" inputMode="numeric" defaultValue={defaults.overtimeAllowance} required /></Labeled><Labeled label="حداقل روزانه"><Input name="dailyMinimum" inputMode="numeric" defaultValue={defaults.dailyMinimum} required /></Labeled><Labeled label="حداکثر روزانه"><Input name="dailyMaximum" inputMode="numeric" defaultValue={defaults.dailyMaximum} required /></Labeled><Labeled label="حداکثر متوالی"><Input name="maxConsecutive" inputMode="numeric" defaultValue={defaults.maxConsecutive} required /></Labeled></ManagedForm>
            </section>

            <section className="panel teacher-section availability-section">
              <div className="teacher-section__title"><div><CalendarClock size={18} /><span><strong>روزها و ساعات حضور</strong><small>برای هر زنگ یک وضعیت انتخاب کنید.</small></span></div><div className="availability-legend"><i className="available" />مجاز <i className="preferred" />ترجیحی <i className="restricted" />محدود <i className="unavailable" />غایب</div></div>
              {data.schoolDays.some((day) => day.periods.length) ? <TeacherAvailabilityEditor key={selected.id} teacher={selected} academicYearId={data.activeAcademicYear.id} schoolDays={data.schoolDays} /> : <p className="inline-callout">برای تنظیم حضور، ابتدا روزها و زنگ‌های مدرسه را تعریف کنید.</p>}
            </section>
          </div>
        </>}
        {embedded ? <div className="step-footer"><a className="button button--secondary button--md" href="/planning?step=curriculum">بازگشت به دروس</a><span className="muted">گام بررسی اطلاعات در مرحلهٔ بعد فعال می‌شود.</span></div> : null}
      </main>
    </div>
  );
}
