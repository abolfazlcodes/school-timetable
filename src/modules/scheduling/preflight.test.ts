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
});
