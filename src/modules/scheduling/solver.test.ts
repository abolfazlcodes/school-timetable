import { describe, expect, it } from "vitest";
import { makeProblem } from "./fixtures.test-helper";
import { scoreSchedule, solveSchedule } from "./solver";
import { validateSchedule } from "./validator";

describe("موتور قطعی CSP", () => {
  it("همه ساعات و تعداد جلسات را بدون conflict زمان‌بندی می‌کند", () => {
    const problem = makeProblem(); const result = solveSchedule(problem, { maxCandidates: 3, nodeBudget: 20_000, timeBudgetMs: 1_000 });
    expect(result.status).toBe("SUCCEEDED"); expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates[0].assignments).toHaveLength(4);
    expect(validateSchedule(problem, result.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toEqual([]);
  });

  it("برای ورودی یکسان نتیجه و ترتیب یکسان می‌دهد", () => {
    const problem = makeProblem(); const first = solveSchedule(problem, { nodeBudget: 20_000, timeBudgetMs: 5_000 }); const second = solveSchedule(problem, { nodeBudget: 20_000, timeBudgetMs: 5_000 });
    expect(first.candidates.map((item) => item.signature)).toEqual(second.candidates.map((item) => item.signature));
    expect(first.candidates.map((item) => item.score)).toEqual(second.candidates.map((item) => item.score));
  });

  it("availability و تداخل دبیر و کلاس را validator مستقل رد می‌کند", () => {
    const problem = makeProblem(); const assignments = [
      { sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
      { sessionId: "r2:1", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
    ];
    const codes = validateSchedule(problem, assignments).map((issue) => issue.code);
    expect(codes).toContain("TEACHER_CONFLICT"); expect(codes).toContain("MISSING_SESSION");
    problem.teachers[0].availability["sa-1"] = "UNAVAILABLE";
    expect(validateSchedule(problem, assignments).map((issue) => issue.code)).toContain("OUTSIDE_AVAILABILITY");
  });

  it("سقف workload را hard نگه می‌دارد و no-solution معتبر برمی‌گرداند", () => {
    const problem = makeProblem(); problem.teachers[0] = { ...problem.teachers[0], maximumWorkload: 2, overtimeAllowance: 0 };
    const result = solveSchedule(problem, { nodeBudget: 20_000, timeBudgetMs: 1_000 });
    expect(result.status).toBe("NO_SOLUTION"); expect(result.candidates).toEqual([]); expect(result.issues[0].severity).toBe("ERROR");
  });

  it("ترجیحات را در امتیاز نرم لحاظ می‌کند", () => {
    const problem = makeProblem({ curriculum: [makeProblem().curriculum[0]] });
    const preferred = [
      { sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
      { sessionId: "r1:2", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 1, periodIds: ["su-1"] },
    ];
    const undesirable = [{ ...preferred[0], periodIds: ["sa-3"], startPosition: 3 }, { ...preferred[1], periodIds: ["su-3"], startPosition: 3 }];
    expect(scoreSchedule(problem, preferred).score).toBeGreaterThan(scoreSchedule(problem, undesirable).score);
  });
});
