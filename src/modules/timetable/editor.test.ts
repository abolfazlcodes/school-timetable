import { describe, expect, it } from "vitest";
import { makeProblem } from "@/modules/scheduling/fixtures.test-helper";
import type { ScheduleAssignment } from "@/modules/scheduling/types";
import { evaluateChange, placeSession, removeSession, swapSessions } from "./editor";

const assignments: ScheduleAssignment[] = [
  { sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
  { sessionId: "r1:2", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 1, periodIds: ["su-1"] },
  { sessionId: "r2:1", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 2, periodIds: ["sa-2"] },
  { sessionId: "r2:2", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 2, periodIds: ["su-2"] },
];

describe("ویرایش مستقل برنامه هفتگی", () => {
  it("جلسه را با شناسه‌های قابل اعتماد دامنه به زمان جدید منتقل می‌کند", () => {
    const problem = makeProblem();
    const next = placeSession(problem, assignments, { sessionId: "r1:1", teacherId: "t1", dayId: "sat", startPosition: 3 });
    expect(next.find((item) => item.sessionId === "r1:1")).toMatchObject({ classId: "c1", subjectId: "math", periodIds: ["sa-3"] });
    expect(evaluateChange(problem, assignments, next).introducedWarnings.map((item) => item.code)).toContain("LAST_PERIOD");
  });

  it("تداخل سخت تازه را پیش از ذخیره تشخیص می‌دهد", () => {
    const problem = makeProblem();
    const next = placeSession(problem, assignments, { sessionId: "r1:1", teacherId: "t1", dayId: "sat", startPosition: 2 });
    const codes = evaluateChange(problem, assignments, next).introducedErrors.map((item) => item.code);
    expect(codes).toContain("TEACHER_CONFLICT");
  });

  it("برداشتن و جایگذاری دوباره جلسه را مدل می‌کند", () => {
    const problem = makeProblem();
    const removed = removeSession(assignments, "r1:1");
    expect(evaluateChange(problem, assignments, removed).introducedErrors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MISSING_SESSION", entityId: "r1:1" })]));
    const restored = placeSession(problem, removed, { sessionId: "r1:1", teacherId: "t1", dayId: "sat", startPosition: 1 });
    expect(evaluateChange(problem, removed, restored).issues.some((issue) => issue.code === "MISSING_SESSION")).toBe(false);
  });

  it("دو جلسه را مستقل از ساعت آموزشی‌شان میان دو زنگ تعویض می‌کند", () => {
    const problem = makeProblem();
    const swapped = swapSessions(problem, assignments, "r1:1", "r2:2");
    expect(swapped.find((item) => item.sessionId === "r1:1")?.periodIds).toEqual(["su-2"]);
    const unequalProblem = makeProblem();
    unequalProblem.curriculum[1] = { ...unequalProblem.curriculum[1], weeklyHours: 3, sessionPattern: [2, 1] };
    const unequalSwap = swapSessions(unequalProblem, assignments, "r1:1", "r2:1");
    expect(unequalSwap.find((item) => item.sessionId === "r1:1")?.periodIds).toEqual(["sa-2"]);
  });
});
