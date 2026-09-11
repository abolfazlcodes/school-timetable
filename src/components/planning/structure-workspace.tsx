"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, CalendarRange, ChevronDown, Clock3, Layers3, Plus, School } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import type { StructureWorkspaceData } from "@/modules/academic-structure/repository";
import { activateAcademicYearAction, addGradeAction, addMajorAction, addPeriodAction, addSchoolDayAction, createAcademicYearAction, editClassGroupAction, editPeriodAction, saveClassPlanAction, setGradeStatusAction, setMajorStatusAction, setSchoolDayStatusAction } from "@/modules/academic-structure/actions";
import { ManagedForm } from "./managed-form";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) { return <label className="compact-field"><span>{label}</span>{children}</label>; }

function ClassPlanForm({ data }: { data: StructureWorkspaceData }) {
  const [students, setStudents] = useState(73);
  const [capacity, setCapacity] = useState(28);
  const [override, setOverride] = useState("");
  const suggestion = useMemo(() => students > 0 && capacity > 0 ? Math.ceil(students / capacity) : 0, [students, capacity]);
  const chosen = override ? Number(override) : suggestion;
  return (
    <ManagedForm action={saveClassPlanAction} submitLabel="ساخت یا به‌روزرسانی کلاس‌ها" className="form-grid form-grid--five">
      <input type="hidden" name="academicYearId" value={data.activeAcademicYear?.id ?? ""} />
      <Labeled label="پایه"><Select name="gradeId" required defaultValue=""><option value="" disabled>انتخاب پایه</option>{data.grades.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Labeled>
      <Labeled label="رشته"><Select name="majorId" defaultValue=""><option value="">بدون رشته</option>{data.majors.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Labeled>
      <Labeled label="تعداد دانش‌آموز"><Input name="studentCount" inputMode="numeric" required value={students} onChange={(event) => setStudents(Number(event.target.value))} /></Labeled>
      <Labeled label="حداکثر ظرفیت کلاس"><Input name="maxClassCapacity" inputMode="numeric" required value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></Labeled>
      <Labeled label="تعداد کلاس دستی"><Input name="classCountOverride" inputMode="numeric" min="1" placeholder="اختیاری" value={override} onChange={(event) => setOverride(event.target.value)} /></Labeled>
      <div className="calculation-strip"><span>پیشنهاد سامانه</span><strong>{suggestion.toLocaleString("fa-IR")} کلاس</strong><span>تعداد نهایی</span><strong>{Number.isFinite(chosen) ? chosen.toLocaleString("fa-IR") : "—"} کلاس</strong></div>
    </ManagedForm>
  );
}

export function StructureWorkspace({ data }: { data: StructureWorkspaceData }) {
  return (
    <div className="planning-content">
      <section className="setup-section panel" open-item="true">
        <div className="setup-section__heading"><span className="section-icon"><CalendarRange size={19} /></span><div><h2>سال تحصیلی</h2><p>تاریخچه حفظ می‌شود و فقط یک سال برای ورود اطلاعات فعال است.</p></div><Badge variant={data.activeAcademicYear ? "success" : "warning"}>{data.activeAcademicYear?.title ?? "سال فعال تعیین نشده"}</Badge></div>
        <div className="setup-section__body split-layout">
          <div className="compact-list">
            {data.academicYears.map((year) => <div className="compact-list__row" key={year.id}><div><strong>{year.title}</strong><span>{year.startYear.toLocaleString("fa-IR")} تا {year.endYear.toLocaleString("fa-IR")}</span></div>{year.isActive ? <Badge variant="success">فعال</Badge> : <ManagedForm compact action={activateAcademicYearAction} submitLabel="فعال‌سازی"><input type="hidden" name="academicYearId" value={year.id} /></ManagedForm>}</div>)}
            {!data.academicYears.length ? <p className="inline-empty">هنوز سال تحصیلی ثبت نشده است.</p> : null}
          </div>
          <ManagedForm action={createAcademicYearAction} submitLabel="افزودن سال" className="form-grid form-grid--two">
            <Labeled label="عنوان"><Input name="title" required placeholder="۱۴۰۵–۱۴۰۶" /></Labeled><Labeled label="سال شروع"><Input name="startYear" inputMode="numeric" required placeholder="۱۴۰۵" /></Labeled><Labeled label="سال پایان"><Input name="endYear" inputMode="numeric" required placeholder="۱۴۰۶" /></Labeled><label className="check-field"><input type="checkbox" name="makeActive" defaultChecked /> این سال فعال باشد</label>
          </ManagedForm>
        </div>
      </section>

      <section className="setup-section panel">
        <div className="setup-section__heading"><span className="section-icon"><Layers3 size={19} /></span><div><h2>پایه‌ها و رشته‌ها</h2><p>تعاریف مشترک مدرسه؛ در ساخت کلاس از آن‌ها استفاده می‌شود.</p></div><span className="section-count">{(data.grades.length + data.majors.length).toLocaleString("fa-IR")} مورد</span></div>
        <div className="setup-section__body two-column-forms">
          <div><h3>پایه‌ها</h3><div className="tag-list">{data.grades.map((grade) => <span className="managed-tag" key={grade.id}><Badge variant={grade.isActive ? undefined : "warning"}>{grade.name}</Badge><ManagedForm compact action={setGradeStatusAction} submitLabel={grade.isActive ? "غیرفعال" : "فعال"}><input type="hidden" name="id" value={grade.id} /><input type="hidden" name="isActive" value={grade.isActive ? "false" : "true"} /></ManagedForm></span>)}</div><ManagedForm compact action={addGradeAction} submitLabel="افزودن پایه" className="inline-entry"><Input name="name" required placeholder="نام پایه؛ مانند دهم" /><Input name="code" required placeholder="کد؛ مانند 10" /><Input name="sortOrder" required inputMode="numeric" defaultValue="10" aria-label="ترتیب" /></ManagedForm></div>
          <div><h3>رشته‌ها</h3><div className="tag-list">{data.majors.map((major) => <span className="managed-tag" key={major.id}><Badge variant={major.isActive ? undefined : "warning"}>{major.name}</Badge><ManagedForm compact action={setMajorStatusAction} submitLabel={major.isActive ? "غیرفعال" : "فعال"}><input type="hidden" name="id" value={major.id} /><input type="hidden" name="isActive" value={major.isActive ? "false" : "true"} /></ManagedForm></span>)}</div><ManagedForm compact action={addMajorAction} submitLabel="افزودن رشته" className="inline-entry"><Input name="name" required placeholder="نام رشته" /><Input name="code" placeholder="کد اختیاری" /></ManagedForm></div>
        </div>
      </section>

      <section className="setup-section panel">
        <div className="setup-section__heading"><span className="section-icon"><School size={19} /></span><div><h2>کلاس‌ها</h2><p>تعداد پیشنهادی خودکار است؛ مقدار دستی تنها در صورت نیاز استفاده می‌شود.</p></div><span className="section-count">{data.classPlans.flatMap((plan) => plan.classes.filter((item) => item.isActive)).length.toLocaleString("fa-IR")} کلاس فعال</span></div>
        <div className="setup-section__body">
          {data.activeAcademicYear && data.grades.length ? <ClassPlanForm data={data} /> : <p className="inline-callout">ابتدا سال فعال و حداقل یک پایه را ثبت کنید.</p>}
          <div className="cohort-list">
            {data.classPlans.map((plan) => <article className="cohort" key={plan.id}><header><div><strong>{plan.gradeName}{plan.majorName ? ` · ${plan.majorName}` : ""}</strong><span>{plan.studentCount.toLocaleString("fa-IR")} دانش‌آموز · ظرفیت {plan.maxClassCapacity.toLocaleString("fa-IR")} · پیشنهاد {Math.ceil(plan.studentCount / plan.maxClassCapacity).toLocaleString("fa-IR")}</span></div><Badge>{plan.classes.filter((item) => item.isActive).length.toLocaleString("fa-IR")} کلاس</Badge></header><div className="class-chips">{plan.classes.map((group) => <ManagedForm compact action={editClassGroupAction} className="class-edit" submitLabel="ثبت" key={group.id}><input type="hidden" name="classGroupId" value={group.id} /><Input name="name" defaultValue={group.name} aria-label="نام کلاس" required /><span>{group.studentCount.toLocaleString("fa-IR")} نفر</span><label className="switch-label"><input type="checkbox" name="isActive" defaultChecked={group.isActive} /> فعال</label></ManagedForm>)}</div></article>)}
          </div>
        </div>
      </section>

      <section className="setup-section panel">
        <div className="setup-section__heading"><span className="section-icon"><Clock3 size={19} /></span><div><h2>روزها و زنگ‌های مدرسه</h2><p>هر روز می‌تواند ساعت‌بندی متفاوت داشته باشد؛ زمان استراحت روی زنگ ثبت می‌شود.</p></div><span className="section-count">{data.schoolDays.length.toLocaleString("fa-IR")} روز کاری</span></div>
        <div className="setup-section__body">
          {data.activeAcademicYear ? <details className="inline-disclosure"><summary><Plus size={15} /> افزودن روز کاری <ChevronDown size={15} /></summary><ManagedForm compact action={addSchoolDayAction} submitLabel="افزودن روز" className="inline-entry"><input type="hidden" name="academicYearId" value={data.activeAcademicYear.id} /><Select name="dayOfWeek" required defaultValue=""><option value="" disabled>روز هفته</option><option value="0">شنبه</option><option value="1">یکشنبه</option><option value="2">دوشنبه</option><option value="3">سه‌شنبه</option><option value="4">چهارشنبه</option><option value="5">پنجشنبه</option><option value="6">جمعه</option></Select><Input name="label" required placeholder="عنوان روز" /><Input name="sortOrder" inputMode="numeric" required placeholder="ترتیب" /></ManagedForm></details> : null}
          <div className="day-grid">{data.schoolDays.map((day) => <article className="day-card" key={day.id}><header><strong>{day.label}</strong><Badge variant={day.isActive ? undefined : "warning"}>{day.periods.filter((item) => item.isActive).length.toLocaleString("fa-IR")} زنگ</Badge><ManagedForm compact action={setSchoolDayStatusAction} submitLabel={day.isActive ? "غیرفعال" : "فعال"}><input type="hidden" name="id" value={day.id} /><input type="hidden" name="isActive" value={day.isActive ? "false" : "true"} /></ManagedForm></header><ol>{day.periods.map((period) => <li key={period.id} className={!period.isActive ? "is-inactive" : undefined}><details className="period-disclosure"><summary><span>{period.label}</span><bdi>{period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}</bdi>{period.breakAfterMinutes ? <small>{period.breakAfterMinutes.toLocaleString("fa-IR")} دقیقه استراحت</small> : null}</summary><ManagedForm compact action={editPeriodAction} submitLabel="به‌روزرسانی" className="period-edit-form"><input type="hidden" name="periodId" value={period.id} /><Input name="label" required defaultValue={period.label} aria-label="عنوان زنگ" /><Input name="startTime" type="time" required defaultValue={period.startTime.slice(0, 5)} aria-label="شروع" /><Input name="endTime" type="time" required defaultValue={period.endTime.slice(0, 5)} aria-label="پایان" /><Input name="breakAfterMinutes" inputMode="numeric" defaultValue={period.breakAfterMinutes} aria-label="استراحت پس از زنگ" /><label className="switch-label"><input type="checkbox" name="isActive" defaultChecked={period.isActive} /> فعال</label></ManagedForm></details></li>)}</ol><details className="inline-disclosure"><summary><Plus size={14} /> افزودن زنگ</summary><ManagedForm compact action={addPeriodAction} submitLabel="ثبت زنگ" className="period-form"><input type="hidden" name="academicYearId" value={data.activeAcademicYear?.id ?? ""} /><input type="hidden" name="schoolDayId" value={day.id} /><Input name="position" inputMode="numeric" required placeholder="شماره" /><Input name="label" required placeholder="عنوان زنگ" /><Input name="startTime" type="time" required aria-label="شروع" /><Input name="endTime" type="time" required aria-label="پایان" /><Input name="breakAfterMinutes" inputMode="numeric" defaultValue="5" aria-label="استراحت پس از زنگ" /></ManagedForm></details></article>)}</div>
        </div>
      </section>
      <div className="step-footer"><div><BookOpenCheck size={18} /><span>پس از تکمیل ساختار، ساعات دروس را تعریف کنید.</span></div><a className="button button--primary button--md" href="/planning?step=curriculum">ادامه به دروس و ساعات</a></div>
    </div>
  );
}
