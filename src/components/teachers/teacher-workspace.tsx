"use client";

import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, Plus, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import type { TeacherWorkspaceData } from "@/modules/teachers/repository";
import { addTeacherAction, editTeacherAction, saveTeacherAvailabilityAction, saveTeacherProfileAction, saveTeacherSubjectsAction } from "@/modules/teachers/actions";
import { ManagedForm } from "@/components/planning/managed-form";
import { cn } from "@/lib/utils";

const employmentLabels = { FULL_TIME: "تمام‌وقت", PART_TIME: "پاره‌وقت", CONTRACT: "قراردادی" } as const;
const staffLabels = { TEACHER: "دبیر", VICE_PRINCIPAL: "معاون", EDUCATIONAL_DEPUTY: "معاون آموزشی", EXECUTIVE_DEPUTY: "معاون اجرایی", CULTURAL_DEPUTY: "معاون فرهنگی", OTHER: "سایر کارکنان" } as const;
const availabilityLabels = { AVAILABLE: "مجاز", UNAVAILABLE: "غایب", PREFERRED: "ترجیحی", RESTRICTED: "محدود" } as const;

function Labeled({ label, children }: { label: string; children: React.ReactNode }) { return <label className="compact-field"><span>{label}</span>{children}</label>; }

function TeacherFields({ teacher }: { teacher?: TeacherWorkspaceData["selectedTeacher"] }) {
  return <><Labeled label="نام"><Input name="firstName" required defaultValue={teacher?.firstName} /></Labeled><Labeled label="نام خانوادگی"><Input name="lastName" required defaultValue={teacher?.lastName} /></Labeled><Labeled label="کد پرسنلی"><Input name="personnelCode" required defaultValue={teacher?.personnelCode} /></Labeled><Labeled label="نوع همکاری"><Select name="employmentType" defaultValue={teacher?.employmentType ?? "FULL_TIME"}>{Object.entries(employmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Labeled><Labeled label="مسئولیت"><Select name="staffKind" defaultValue={teacher?.staffKind ?? "TEACHER"}>{Object.entries(staffLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Labeled><Labeled label="یادداشت"><Input name="notes" defaultValue={teacher?.notes ?? ""} placeholder="اختیاری" /></Labeled></>;
}

export function TeacherWorkspace({ data, embedded = false }: { data: TeacherWorkspaceData; embedded?: boolean }) {
  const selected = data.selectedTeacher;
  const selectHref = (teacherId: string) => embedded ? `/planning?step=teachers&teacher=${teacherId}` : `/teachers?teacher=${teacherId}`;
  const positions = [...new Set(data.schoolDays.flatMap((day) => day.periods.map((period) => period.position)))].sort((a, b) => a - b);
  const defaults = selected?.profile ?? { minimumWorkload: 20, requiredWorkload: 24, maximumWorkload: 28, overtimeAllowance: 4, dailyMinimum: 0, dailyMaximum: 6, maxConsecutive: 3 };
  return (
    <div className="teacher-workspace">
      <aside className="teacher-directory panel">
        <div className="panel__header"><div><h2>دبیران</h2><p>{data.teachers.length.toLocaleString("fa-IR")} نفر ثبت‌شده</p></div><UsersRound size={19} /></div>
        <div className="teacher-list">{data.teachers.map((teacher) => <Link href={selectHref(teacher.id)} key={teacher.id} className={cn("teacher-list__item", teacher.id === selected?.id && "is-active")}><span className="avatar">{teacher.firstName[0]}{teacher.lastName[0]}</span><div><strong>{teacher.firstName} {teacher.lastName}</strong><small>{staffLabels[teacher.staffKind]} · {employmentLabels[teacher.employmentType]}</small></div>{!teacher.isActive ? <Badge variant="warning">غیرفعال</Badge> : null}</Link>)}{!data.teachers.length ? <div className="directory-empty"><UserRound size={24} /><span>هنوز دبیری ثبت نشده است.</span></div> : null}</div>
        <details className="inline-disclosure teacher-add"><summary><Plus size={15} /> افزودن دبیر</summary><ManagedForm action={addTeacherAction} submitLabel="افزودن دبیر" className="form-grid form-grid--two"><TeacherFields /></ManagedForm></details>
      </aside>

      <main className="teacher-detail">
        {!data.activeAcademicYear ? <section className="panel inline-callout">ابتدا یک سال تحصیلی فعال تعریف کنید.</section> : !selected ? <section className="panel teacher-empty"><UserRound size={28} /><h2>یک دبیر اضافه کنید</h2><p>مشخصات، درس‌ها، موظفی و حضور در همین صفحه مدیریت می‌شوند.</p></section> : <>
          <section className="panel teacher-section">
            <div className="teacher-section__title"><div><UserRound size={18} /><span><strong>{selected.firstName} {selected.lastName}</strong><small>اطلاعات پایدار دبیر</small></span></div><Badge variant={selected.isActive ? "success" : "warning"}>{selected.isActive ? "فعال" : "غیرفعال"}</Badge></div>
            <ManagedForm action={editTeacherAction} submitLabel="ذخیره مشخصات" className="form-grid form-grid--three"><input type="hidden" name="teacherId" value={selected.id} /><TeacherFields teacher={selected} /><label className="check-field"><input type="checkbox" name="isActive" defaultChecked={selected.isActive} /> دبیر فعال است</label></ManagedForm>
          </section>

          <div className="teacher-detail-grid">
            <section className="panel teacher-section">
              <div className="teacher-section__title"><div><BriefcaseBusiness size={18} /><span><strong>درس‌ها و موظفی</strong><small>{data.activeAcademicYear.title}</small></span></div></div>
              <ManagedForm compact action={saveTeacherSubjectsAction} submitLabel="ذخیره درس‌ها"><input type="hidden" name="teacherId" value={selected.id} /><div className="subject-checks">{data.subjects.filter((subject) => subject.isActive).map((subject) => <label key={subject.id}><input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={selected.subjectIds.includes(subject.id)} /> {subject.name}</label>)}{!data.subjects.some((item) => item.isActive) ? <span className="muted">ابتدا درس‌ها را در گام قبل تعریف کنید.</span> : null}</div></ManagedForm>
              <ManagedForm compact action={saveTeacherProfileAction} submitLabel="ذخیره موظفی" className="workload-form"><input type="hidden" name="teacherId" value={selected.id} /><input type="hidden" name="academicYearId" value={data.activeAcademicYear.id} /><Labeled label="حداقل"><Input name="minimumWorkload" inputMode="numeric" defaultValue={defaults.minimumWorkload} required /></Labeled><Labeled label="موظفی"><Input name="requiredWorkload" inputMode="numeric" defaultValue={defaults.requiredWorkload} required /></Labeled><Labeled label="حداکثر"><Input name="maximumWorkload" inputMode="numeric" defaultValue={defaults.maximumWorkload} required /></Labeled><Labeled label="اضافه‌کاری مجاز"><Input name="overtimeAllowance" inputMode="numeric" defaultValue={defaults.overtimeAllowance} required /></Labeled><Labeled label="حداقل روزانه"><Input name="dailyMinimum" inputMode="numeric" defaultValue={defaults.dailyMinimum} required /></Labeled><Labeled label="حداکثر روزانه"><Input name="dailyMaximum" inputMode="numeric" defaultValue={defaults.dailyMaximum} required /></Labeled><Labeled label="حداکثر متوالی"><Input name="maxConsecutive" inputMode="numeric" defaultValue={defaults.maxConsecutive} required /></Labeled></ManagedForm>
            </section>

            <section className="panel teacher-section availability-section">
              <div className="teacher-section__title"><div><CalendarClock size={18} /><span><strong>روزها و ساعات حضور</strong><small>برای هر زنگ یک وضعیت انتخاب کنید.</small></span></div><div className="availability-legend"><i className="available" />مجاز <i className="preferred" />ترجیحی <i className="restricted" />محدود <i className="unavailable" />غایب</div></div>
              {data.schoolDays.length && positions.length ? <ManagedForm action={saveTeacherAvailabilityAction} submitLabel="ذخیره جدول حضور" className="availability-form"><input type="hidden" name="teacherId" value={selected.id} /><input type="hidden" name="academicYearId" value={data.activeAcademicYear.id} /><div className="availability-grid-wrap"><table className="availability-grid"><thead><tr><th>زنگ</th>{data.schoolDays.map((day) => <th key={day.id}>{day.label}</th>)}</tr></thead><tbody>{positions.map((position) => <tr key={position}><th>زنگ {position.toLocaleString("fa-IR")}</th>{data.schoolDays.map((day) => { const period = day.periods.find((item) => item.position === position); return <td key={day.id}>{period ? <><Select name={`slot:${period.id}`} defaultValue={selected.availability[period.id] ?? "AVAILABLE"} aria-label={`${day.label} ${period.label}`}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><small><bdi>{period.startTime.slice(0, 5)}</bdi></small></> : <span className="no-period">—</span>}</td>; })}</tr>)}</tbody></table></div></ManagedForm> : <p className="inline-callout">برای تنظیم حضور، ابتدا روزها و زنگ‌های مدرسه را تعریف کنید.</p>}
            </section>
          </div>
        </>}
        {embedded ? <div className="step-footer"><a className="button button--secondary button--md" href="/planning?step=curriculum">بازگشت به دروس</a><span className="muted">گام بررسی اطلاعات در مرحلهٔ بعد فعال می‌شود.</span></div> : null}
      </main>
    </div>
  );
}
