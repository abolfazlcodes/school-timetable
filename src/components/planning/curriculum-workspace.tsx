"use client";

import { useMemo, useRef, useState } from "react";
import {
  BookMarked,
  Calculator,
  CirclePause,
  CirclePlay,
  PencilLine,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { CurriculumWorkspaceData } from "@/modules/curriculum/repository";
import {
  describeSessionPattern,
  normalizeDigits,
  parseSessionPattern,
  suggestSessionPatterns,
} from "@/modules/planning/domain";
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

type CurriculumDraft = {
  itemId: string | null;
  gradeId: string;
  majorId: string;
  subjectId: string;
  weeklyHours: string;
  sessionPattern: string;
};

const emptyDraft: CurriculumDraft = {
  itemId: null,
  gradeId: "",
  majorId: "",
  subjectId: "",
  weeklyHours: "",
  sessionPattern: "",
};

const patternValue = (pattern: number[]) => pattern.join("+");

export function CurriculumWorkspace({
  data,
}: {
  data: CurriculumWorkspaceData;
}) {
  const editorRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<CurriculumDraft>(emptyDraft);
  const firstGradeWithItems =
    data.grades.find((grade) =>
      data.items.some((item) => item.gradeId === grade.id),
    )?.id ??
    data.grades[0]?.id ??
    "";
  const [selectedGradeId, setSelectedGradeId] =
    useState(firstGradeWithItems);
  const [selectedMajorId, setSelectedMajorId] = useState("all");
  const activeGradeId = data.grades.some(
    (grade) => grade.id === selectedGradeId,
  )
    ? selectedGradeId
    : firstGradeWithItems;
  const activeGrade = data.grades.find(
    (grade) => grade.id === activeGradeId,
  );
  const gradeItems = useMemo(
    () => data.items.filter((item) => item.gradeId === activeGradeId),
    [activeGradeId, data.items],
  );
  const availableMajors = useMemo(
    () =>
      data.majors.filter((major) =>
        gradeItems.some((item) => item.majorId === major.id),
      ),
    [data.majors, gradeItems],
  );
  const activeMajorId =
    selectedMajorId === "all" ||
    availableMajors.some((major) => major.id === selectedMajorId)
      ? selectedMajorId
      : "all";
  const visibleItems = useMemo(
    () =>
      activeMajorId === "all"
        ? gradeItems
        : gradeItems.filter(
            (item) =>
              item.majorId === activeMajorId || item.majorId === null,
          ),
    [activeMajorId, gradeItems],
  );
  const weeklyHours = Number(normalizeDigits(draft.weeklyHours));
  const suggestedPatterns = useMemo(
    () => suggestSessionPatterns(weeklyHours),
    [weeklyHours],
  );
  const parsedPattern = parseSessionPattern(draft.sessionPattern);
  const editingItem = data.items.find((item) => item.id === draft.itemId);

  const editItem = (item: CurriculumWorkspaceData["items"][number]) => {
    setDraft({
      itemId: item.id,
      gradeId: item.gradeId,
      majorId: item.majorId ?? "",
      subjectId: item.subjectId,
      weeklyHours: String(item.weeklyHours),
      sessionPattern: patternValue(item.sessionPattern),
    });
    editorRef.current?.scrollIntoView?.({ block: "start" });
  };

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
        <section className="panel curriculum-editor" ref={editorRef}>
          <div className="panel__header">
            <div>
              <h2>
                {editingItem
                  ? `ویرایش الگوی ${editingItem.subjectName}`
                  : "افزودن یا اصلاح ساعات درس"}
              </h2>
              <p>
                {data.activeAcademicYear
                  ? `سال تحصیلی ${data.activeAcademicYear.title}؛ الگو برای همین پایه و رشته ذخیره می‌شود.`
                  : "ابتدا سال تحصیلی فعال را تعریف کنید"}
              </p>
            </div>
            {draft.itemId ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(emptyDraft)}
              >
                <RotateCcw size={15} />
                ثبت ردیف جدید
              </Button>
            ) : null}
          </div>
          {data.activeAcademicYear &&
          data.grades.length &&
          data.subjects.some((subject) => subject.isActive) ? (
            <ManagedForm
              action={saveCurriculumItemAction}
              submitLabel={draft.itemId ? "ذخیره تغییر الگو" : "ذخیره ساعات درس"}
              className="curriculum-form form-grid form-grid--three"
            >
              <input
                type="hidden"
                name="academicYearId"
                value={data.activeAcademicYear.id}
              />
              <input
                type="hidden"
                name="sessionCount"
                value={parsedPattern.length}
              />
              <Labeled label="پایه">
                <Select
                  name="gradeId"
                  required
                  value={draft.gradeId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      gradeId: event.target.value,
                    }))
                  }
                >
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
                <Select
                  name="majorId"
                  value={draft.majorId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      majorId: event.target.value,
                    }))
                  }
                >
                  <option value="">همه رشته‌ها</option>
                  {data.majors.map((major) => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </Select>
              </Labeled>
              <Labeled label="درس">
                <Select
                  name="subjectId"
                  required
                  value={draft.subjectId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      subjectId: event.target.value,
                    }))
                  }
                >
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
              <Labeled
                label="ساعت هر کلاس در هفته"
                hint="با تغییر ساعت، الگوی پیشنهادی مدرسه دوباره محاسبه می‌شود."
              >
                <Input
                  name="weeklyHours"
                  aria-label="ساعت هر کلاس در هفته"
                  inputMode="numeric"
                  min="1"
                  required
                  placeholder="۴"
                  value={draft.weeklyHours}
                  onChange={(event) => {
                    const nextHours = event.target.value;
                    const [defaultPattern] = suggestSessionPatterns(
                      Number(normalizeDigits(nextHours)),
                    );
                    setDraft((current) => ({
                      ...current,
                      weeklyHours: nextHours,
                      sessionPattern: defaultPattern
                        ? patternValue(defaultPattern)
                        : "",
                    }));
                  }}
                />
              </Labeled>
              <Labeled
                label="الگوی دقیق جلسات"
                hint="مجموع اعداد باید با ساعت هفتگی برابر باشد؛ نمونه: ۲+۱."
              >
                <Input
                  name="sessionPattern"
                  aria-label="الگوی دقیق جلسات"
                  dir="ltr"
                  required
                  placeholder="2+1"
                  value={draft.sessionPattern}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sessionPattern: event.target.value,
                    }))
                  }
                />
              </Labeled>
              <div className="curriculum-pattern-picker">
                <div>
                  <strong>نحوه برگزاری</strong>
                  <small>
                    پیش‌فرض مدرسه انتخاب شده است؛ در صورت نیاز فقط همین ردیف را
                    پیوسته، ترکیبی یا خردشده کنید.
                  </small>
                </div>
                {suggestedPatterns.length ? (
                  <div className="curriculum-pattern-options" role="group" aria-label="انتخاب نحوه برگزاری">
                    {suggestedPatterns.map((pattern) => {
                      const value = patternValue(pattern);
                      const selected =
                        value === patternValue(parsedPattern);
                      return (
                        <button
                          type="button"
                          className="curriculum-pattern-option"
                          aria-pressed={selected}
                          key={value}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              sessionPattern: value,
                            }))
                          }
                        >
                          <bdi>
                            {pattern
                              .map((part) => part.toLocaleString("fa-IR"))
                              .join(" + ")}
                          </bdi>
                          <small>{describeSessionPattern(pattern)}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">
                    ابتدا ساعت هفتگی را وارد کنید تا حالت‌های برگزاری نمایش داده
                    شوند.
                  </p>
                )}
              </div>
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
            <Badge>
              {visibleItems.length.toLocaleString("fa-IR")} از {" "}
              {data.items.length.toLocaleString("fa-IR")} ردیف
            </Badge>
          </div>
          {data.items.length ? (
            <div className="curriculum-browser-controls">
              <div
                className="curriculum-grade-tabs"
                role="tablist"
                aria-label="انتخاب پایه تحصیلی"
              >
                {data.grades.map((grade) => {
                  const itemCount = data.items.filter(
                    (item) => item.gradeId === grade.id,
                  ).length;
                  const selected = grade.id === activeGradeId;
                  return (
                    <button
                      type="button"
                      role="tab"
                      id={`curriculum-grade-tab-${grade.id}`}
                      aria-controls="curriculum-grade-panel"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      className={selected ? "is-active" : undefined}
                      key={grade.id}
                      onClick={() => {
                        setSelectedGradeId(grade.id);
                        setSelectedMajorId("all");
                      }}
                    >
                      <span>{grade.name.replace(/^پایه\s+/, "")}</span>
                      <small>{itemCount.toLocaleString("fa-IR")} درس</small>
                    </button>
                  );
                })}
              </div>
              <div
                className="curriculum-major-filters"
                role="group"
                aria-label="فیلتر رشته"
              >
                <span>رشته</span>
                <button
                  type="button"
                  className={activeMajorId === "all" ? "is-active" : undefined}
                  aria-pressed={activeMajorId === "all"}
                  onClick={() => setSelectedMajorId("all")}
                >
                  همه
                  <small>{gradeItems.length.toLocaleString("fa-IR")}</small>
                </button>
                {availableMajors.map((major) => {
                  const itemCount = gradeItems.filter(
                    (item) => item.majorId === major.id || item.majorId === null,
                  ).length;
                  const selected = activeMajorId === major.id;
                  return (
                    <button
                      type="button"
                      className={selected ? "is-active" : undefined}
                      aria-pressed={selected}
                      key={major.id}
                      onClick={() => setSelectedMajorId(major.id)}
                    >
                      {major.name}
                      <small>{itemCount.toLocaleString("fa-IR")}</small>
                    </button>
                  );
                })}
                <p aria-live="polite">
                  {visibleItems.length.toLocaleString("fa-IR")} درس در {" "}
                  {activeGrade?.name ?? "پایه انتخاب‌شده"}
                  {activeMajorId !== "all"
                    ? ` · ${availableMajors.find((major) => major.id === activeMajorId)?.name ?? ""}`
                    : ""}
                </p>
              </div>
            </div>
          ) : null}
          <div
            className="table-wrap"
            id="curriculum-grade-panel"
            role="tabpanel"
            aria-label={activeGrade?.name ?? "برنامه درسی"}
            aria-labelledby={
              activeGradeId
                ? `curriculum-grade-tab-${activeGradeId}`
                : undefined
            }
          >
            <table>
              <thead>
                <tr>
                  <th>درس</th>
                  <th>رشته</th>
                  <th>ساعات</th>
                  <th>جلسات</th>
                  <th>کلاس‌ها</th>
                  <th>بار کل</th>
                  <th>تنظیم</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.subjectName}</strong>
                    </td>
                    <td>
                      {item.majorName ?? "همه رشته‌ها"}
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
                      <small className="curriculum-pattern-kind">
                        {describeSessionPattern(item.sessionPattern)}
                      </small>
                    </td>
                    <td>{item.classCount.toLocaleString("fa-IR")}</td>
                    <td>
                      <strong>
                        {item.totalWorkload.toLocaleString("fa-IR")} ساعت
                      </strong>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editItem(item)}
                        aria-label={`ویرایش الگوی ${item.subjectName} ${item.gradeName}${item.majorName ? ` ${item.majorName}` : ""}`}
                      >
                        <PencilLine size={15} />
                        ویرایش
                      </Button>
                    </td>
                  </tr>
                ))}
                {!data.items.length ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="table-empty">
                        <BookMarked size={22} />
                        <span>هنوز ساعات درسی ثبت نشده است.</span>
                      </div>
                    </td>
                  </tr>
                ) : !visibleItems.length ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="table-empty">
                        <BookMarked size={22} />
                        <span>برای این پایه و رشته درسی ثبت نشده است.</span>
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
