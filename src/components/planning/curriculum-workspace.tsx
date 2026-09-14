"use client";

import {
  BookMarked,
  Calculator,
  CirclePause,
  CirclePlay,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import type { CurriculumWorkspaceData } from "@/modules/curriculum/repository";
import {
  addSubjectAction,
  saveCurriculumItemAction,
  setSubjectStatusAction,
} from "@/modules/curriculum/actions";
import { ManagedForm } from "./managed-form";

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="compact-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function CurriculumWorkspace({
  data,
}: {
  data: CurriculumWorkspaceData;
}) {
  const totalWorkload = data.items
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + item.totalWorkload, 0);
  return (
    <div className="planning-content curriculum-layout">
      <section className="panel subject-panel">
        <div className="panel__header">
          <div>
            <h2>فهرست دروس</h2>
            <p>تعریف مشترک و قابل استفاده در سال‌های بعد</p>
          </div>
          <Badge>
            {data.subjects
              .filter((item) => item.isActive)
              .length.toLocaleString("fa-IR")}{" "}
            فعال
          </Badge>
        </div>
        <div className="subject-list">
          {data.subjects.map((subject) => (
            <div className="subject-row" key={subject.id}>
              <div>
                <strong>{subject.name}</strong>
                <span>{subject.code || "بدون کد"}</span>
              </div>
              <ManagedForm
                compact
                action={setSubjectStatusAction}
                submitLabel={subject.isActive ? "غیرفعال" : "فعال"}
              >
                <input type="hidden" name="subjectId" value={subject.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={subject.isActive ? "false" : "true"}
                />
                {subject.isActive ? (
                  <CirclePause size={15} />
                ) : (
                  <CirclePlay size={15} />
                )}
              </ManagedForm>
            </div>
          ))}
        </div>
        <details className="inline-disclosure subject-add">
          <summary>
            <Plus size={15} /> افزودن درس
          </summary>
          <ManagedForm compact action={addSubjectAction} submitLabel="افزودن">
            <Input name="name" required placeholder="نام درس" />
            <Input name="code" placeholder="کد اختیاری" />
          </ManagedForm>
        </details>
      </section>

      <div className="curriculum-main">
        <section className="workload-summary">
          <div>
            <Calculator size={20} />
            <span>بار آموزشی محاسبه‌شده</span>
          </div>
          <strong>{totalWorkload.toLocaleString("fa-IR")} ساعت هفتگی</strong>
          <small>مجموع تعداد کلاس × ساعات هر درس</small>
        </section>
        {data.requirements.length ? (
          <section className="panel requirement-summary-panel">
            <div className="panel__header">
              <div>
                <h2>نیاز واقعی مدرسه و پوشش دبیران</h2>
                <p>
                  نیاز از کلاس‌های فعال محاسبه می‌شود؛ تخصیص دبیران فقط پوشش آن
                  را نشان می‌دهد.
                </p>
              </div>
            </div>
            <div className="requirement-summary-list">
              {data.requirements.map((requirement) => {
                const balance =
                  requirement.totalAssignedHours -
                  requirement.totalRequiredHours;
                return (
                  <details
                    key={requirement.subjectId}
                    className="requirement-summary-row"
                  >
                    <summary>
                      <strong>{requirement.subjectName}</strong>
                      <span>
                        {requirement.totalRequiredHours.toLocaleString("fa-IR")}{" "}
                        ساعت نیاز
                      </span>
                      <Badge
                        variant={
                          balance < 0
                            ? "danger"
                            : balance > 0
                              ? "warning"
                              : "success"
                        }
                      >
                        {balance < 0
                          ? `${Math.abs(balance).toLocaleString("fa-IR")} ساعت کمبود`
                          : balance > 0
                            ? `${balance.toLocaleString("fa-IR")} ساعت مازاد`
                            : "پوشش کامل"}
                      </Badge>
                    </summary>
                    <div>
                      {requirement.scopes.map((scope) => (
                        <p key={scope.label}>
                          <span>{scope.label}</span>
                          <bdi>
                            {scope.classCount.toLocaleString("fa-IR")} کلاس ×{" "}
                            {scope.weeklyHours.toLocaleString("fa-IR")} ساعت ={" "}
                            <strong>
                              {scope.requiredHours.toLocaleString("fa-IR")} ساعت
                            </strong>
                          </bdi>
                        </p>
                      ))}
                      <p className="requirement-assigned-total">
                        <span>جمع تخصیص دبیران</span>
                        <strong>
                          {requirement.totalAssignedHours.toLocaleString(
                            "fa-IR",
                          )}{" "}
                          ساعت
                        </strong>
                      </p>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>افزودن یا اصلاح ساعات درس</h2>
              <p>
                {data.activeAcademicYear
                  ? `سال تحصیلی ${data.activeAcademicYear.title}`
                  : "ابتدا سال تحصیلی فعال را تعریف کنید"}
              </p>
            </div>
          </div>
          {data.activeAcademicYear &&
          data.grades.length &&
          data.subjects.some((subject) => subject.isActive) ? (
            <ManagedForm
              action={saveCurriculumItemAction}
              submitLabel="ذخیره ساعات درس"
              className="curriculum-form form-grid form-grid--three"
            >
              <input
                type="hidden"
                name="academicYearId"
                value={data.activeAcademicYear.id}
              />
              <Labeled label="پایه">
                <Select name="gradeId" required defaultValue="">
                  <option value="" disabled>
                    انتخاب پایه
                  </option>
                  {data.grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name}
                    </option>
                  ))}
                </Select>
              </Labeled>
              <Labeled label="رشته">
                <Select name="majorId" defaultValue="">
                  <option value="">همه رشته‌ها</option>
                  {data.majors.map((major) => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </Select>
              </Labeled>
              <Labeled label="درس">
                <Select name="subjectId" required defaultValue="">
                  <option value="" disabled>
                    انتخاب درس
                  </option>
                  {data.subjects
                    .filter((subject) => subject.isActive)
                    .map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                </Select>
              </Labeled>
              <Labeled label="ساعت هر کلاس در هفته">
                <Input
                  name="weeklyHours"
                  inputMode="numeric"
                  min="1"
                  required
                  placeholder="۴"
                />
              </Labeled>
              <Labeled label="تعداد جلسات">
                <Input
                  name="sessionCount"
                  inputMode="numeric"
                  min="1"
                  required
                  placeholder="۲"
                />
              </Labeled>
              <Labeled label="الگوی جلسات" hint="نمونه: ۲+۲ یا ۲+۱">
                <Input
                  name="sessionPattern"
                  dir="ltr"
                  required
                  placeholder="2+2"
                />
              </Labeled>
            </ManagedForm>
          ) : (
            <p className="inline-callout">
              برای ثبت برنامه درسی، سال فعال، پایه و حداقل یک درس فعال لازم است.
            </p>
          )}
        </section>

        <section className="panel curriculum-table">
          <div className="panel__header">
            <div>
              <h2>برنامه درسی سال فعال</h2>
              <p>بار آموزشی هر ردیف بر اساس کلاس‌های فعال محاسبه می‌شود.</p>
            </div>
            <Badge>{data.items.length.toLocaleString("fa-IR")} ردیف</Badge>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>درس</th>
                  <th>پایه / رشته</th>
                  <th>ساعات</th>
                  <th>جلسات</th>
                  <th>کلاس‌ها</th>
                  <th>بار کل</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.subjectName}</strong>
                    </td>
                    <td>
                      {item.gradeName}
                      {item.majorName
                        ? ` · ${item.majorName}`
                        : " · همه رشته‌ها"}
                    </td>
                    <td>{item.weeklyHours.toLocaleString("fa-IR")}</td>
                    <td>
                      <bdi>
                        {item.sessionPattern
                          .map((part) => part.toLocaleString("fa-IR"))
                          .join(" + ")}
                      </bdi>{" "}
                      <span className="muted">
                        ({item.sessionCount.toLocaleString("fa-IR")} جلسه)
                      </span>
                    </td>
                    <td>{item.classCount.toLocaleString("fa-IR")}</td>
                    <td>
                      <strong>
                        {item.totalWorkload.toLocaleString("fa-IR")} ساعت
                      </strong>
                    </td>
                  </tr>
                ))}
                {!data.items.length ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="table-empty">
                        <BookMarked size={22} />
                        <span>هنوز ساعات درسی ثبت نشده است.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <div className="step-footer">
          <a
            className="button button--secondary button--md"
            href="/planning?step=structure"
          >
            بازگشت به ساختار
          </a>
          <a
            className="button button--primary button--md"
            href="/planning?step=teachers"
          >
            ادامه به دبیران و حضور
          </a>
        </div>
      </div>
    </div>
  );
}
