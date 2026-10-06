// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calculateCurriculumWorkload } from "@/modules/planning/domain";
import { makeRealSchoolReferenceProblem, makeRealSchoolSolverProjection, referenceTeacherRows } from "./fixtures/real-school-1405.test-fixture";
import { runPreflight } from "./preflight";
import { solveSchedule } from "./solver";
import { validateSchedule } from "./validator";

describe("کالیبراسیون داده واقعی ۱۴۰۵–۱۴۰۶", () => {
  it("چنددرسی، ساعت متفاوت و حضور ۲/۳/۴ روزه را بدون تبدیل به قاعده ثابت حفظ می‌کند", () => {
    const problem = makeRealSchoolReferenceProblem();
    expect(problem.teachers).toHaveLength(11);
    expect(problem.teachers.filter((teacher) => teacher.subjectAssignments.length > 1).length).toBeGreaterThan(0);
    expect(new Set(referenceTeacherRows.map((teacher) => teacher.days))).toEqual(new Set([2, 3, 4]));
    expect(problem.teachers.reduce((sum, teacher) => sum + teacher.requiredWorkload, 0)).toBe(189);
    expect(problem.curriculum.reduce((sum, item) => sum + item.weeklyHours, 0)).toBe(189);
    expect(runPreflight(problem).issues.filter((issue) => issue.severity === "ERROR")).toHaveLength(0);
  });

  it("نیاز و اعتبار ظرفیت را با ۲، ۱، ۰ و ۴ کلاس دوباره محاسبه می‌کند", () => {
    expect([2, 1, 0, 4].map((classCount) => calculateCurriculumWorkload(classCount, 4))).toEqual([8, 4, 0, 16]);
    const base = makeRealSchoolReferenceProblem();
    const teacher = { ...base.teachers[0], subjectAssignments: [{ subjectId: "english", assignedWeeklyHours: 8 }], requiredWorkload: 8, minimumWorkload: 0, maximumWorkload: 8 };
    const make = (classCount: number) => ({ ...base, classes: base.classes.slice(0, classCount), curriculum: base.classes.slice(0, classCount).map((schoolClass, index) => ({ id: `english-${index}`, classId: schoolClass.id, className: schoolClass.name, subjectId: "english", subjectName: "زبان خارجه", weeklyHours: 4, sessionPattern: [2, 2] })), teachers: [teacher] });
    expect(runPreflight(make(2)).issues.some((issue) => issue.code === "INSUFFICIENT_CAPACITY")).toBe(false);
    expect(runPreflight(make(1)).issues.some((issue) => issue.code === "SURPLUS_SUBJECT_CAPACITY")).toBe(true);
    expect(runPreflight(make(0)).summary.weeklyHours).toBe(0);
    expect(runPreflight(make(4)).issues.find((issue) => issue.code === "INSUFFICIENT_CAPACITY")?.message).toContain("۸ ساعت کمبود");
  });

  it("حل‌گر سناریوی مرجع را با تخصیص سالانه و حضور نرمال‌شده معتبر می‌چیند", async () => {
    const problem = makeRealSchoolSolverProjection();
    const result = await solveSchedule(problem, { maxCandidates: 1, nodeBudget: 250_000, timeBudgetMs: 3_000 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.candidates).toHaveLength(1);
    expect(validateSchedule(problem, result.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toHaveLength(0);
  }, 10_000);
});
