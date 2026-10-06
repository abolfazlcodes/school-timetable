import { describe, expect, it } from "vitest";
import { makeProblem } from "./fixtures.test-helper";
import { runPreflight } from "./preflight";

describe("پیش‌بررسی زمان‌بندی", () => {
  it("داده کامل را قابل تولید اعلام می‌کند", () => {
    const result = runPreflight(makeProblem());
    expect(result.canGenerate).toBe(true);
    expect(result.summary).toMatchObject({ classCount: 2, weeklyHours: 4, sessionCount: 4, errorCount: 0 });
  });

  it("نبود دبیر و curriculum کلاس را با اقدام اصلاح گزارش می‌کند", () => {
    const problem = makeProblem({ teachers: [], curriculum: [makeProblem().curriculum[0]] });
    const result = runPreflight(problem);
    expect(result.canGenerate).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["MISSING_CURRICULUM", "MISSING_TEACHER", "INSUFFICIENT_CAPACITY"]));
    expect(result.issues.find((issue) => issue.code === "MISSING_TEACHER")?.fixHref).toContain("teachers");
  });

  it("حضور ناقص و ظرفیت ناکافی را پیش از solver متوقف می‌کند", () => {
    const problem = makeProblem(); problem.teachers[0] = { ...problem.teachers[0], subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 2 }], maximumWorkload: 6, availability: { "sa-1": "AVAILABLE" } };
    const result = runPreflight(problem);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["MISSING_AVAILABILITY", "INSUFFICIENT_CAPACITY"]));
  });

  it("تخصیص بیشتر از موظفی را در محدوده مجاز اضافه‌کار می‌داند، نه هشدار مغایرت", () => {
    const problem = makeProblem();
    problem.teachers[0] = {
      ...problem.teachers[0],
      subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 4 }],
      requiredWorkload: 3,
      maximumWorkload: 3,
      overtimeAllowance: 1,
    };
    const result = runPreflight(problem);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "OVERTIME_ASSIGNED", severity: "INFO" }));
    expect(result.summary.warningCount).toBe(0);
  });

  it("ظرفیت حضور دبیر را با واحد آموزشی زنگ می‌سنجد، نه تعداد خانه‌های جدول", () => {
    const problem = makeProblem();
    problem.periods = problem.periods.slice(0, 2).map((period) => ({ ...period, instructionalUnits: 2 }));
    problem.teachers[0] = { ...problem.teachers[0], availability: Object.fromEntries(problem.periods.map((period) => [period.id, "AVAILABLE"])) };
    const result = runPreflight(problem);
    expect(result.issues.some((issue) => issue.code === "INSUFFICIENT_TEACHER_SLOTS")).toBe(false);
  });

  it("کمبود زنگ سازگار با الگوی جلسه را حتی وقتی جمع واحدهای حضور کافی است گزارش می‌کند", () => {
    const problem = makeProblem();
    problem.periods = [
      ...problem.periods.slice(0, 3).map((period) => ({ ...period, instructionalUnits: 2 })),
      { ...problem.periods[3], instructionalUnits: 1 },
      { ...problem.periods[4], instructionalUnits: 1 },
    ];
    problem.classes = [problem.classes[0]];
    problem.curriculum = Array.from({ length: 4 }, (_, index) => ({
      id: `two-hour-${index}`,
      classId: problem.classes[0].id,
      className: problem.classes[0].name,
      subjectId: "math",
      subjectName: "ریاضی",
      weeklyHours: 2,
      sessionPattern: [2],
    }));
    problem.teachers[0] = {
      ...problem.teachers[0],
      subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 8 }],
      requiredWorkload: 8,
      maximumWorkload: 8,
      availability: Object.fromEntries(
        problem.periods.map((period) => [period.id, "AVAILABLE"]),
      ),
    };
    const result = runPreflight(problem);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "INCOMPATIBLE_TEACHER_PATTERN_CAPACITY",
      severity: "ERROR",
      message: expect.stringMatching(/۸.*۶/),
    }));
  });
});
