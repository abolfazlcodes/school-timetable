// @vitest-environment node
import { describe, expect, it } from "vitest";
import { solveSchedule } from "./solver";
import type { SchedulingProblem } from "./types";
import { validateSchedule } from "./validator";

function makeTypicalSchool(): SchedulingProblem {
  const periods = Array.from({ length: 5 }, (_, dayIndex) => Array.from({ length: 6 }, (_, periodIndex) => ({
    id: `d${dayIndex + 1}-p${periodIndex + 1}`,
    dayId: `d${dayIndex + 1}`,
    dayLabel: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"][dayIndex],
    dayOrder: dayIndex,
    position: periodIndex + 1,
    label: `زنگ ${periodIndex + 1}`,
    startTime: `${String(7 + periodIndex).padStart(2, "0")}:30`,
    endTime: `${String(8 + periodIndex).padStart(2, "0")}:15`,
    isLast: periodIndex === 5,
  }))).flat();
  const classes = Array.from({ length: 12 }, (_, index) => ({ id: `c${index + 1}`, name: `کلاس ${index + 1}`, gradeId: index < 6 ? "g10" : "g11", gradeName: index < 6 ? "دهم" : "یازدهم", majorId: "science", majorName: "تجربی" }));
  const subjects = ["ادبیات", "ریاضی", "زبان", "علوم"];
  const curriculum = classes.flatMap((schoolClass) => subjects.map((name, subjectIndex) => ({ id: `r-${schoolClass.id}-s${subjectIndex + 1}`, classId: schoolClass.id, className: schoolClass.name, subjectId: `s${subjectIndex + 1}`, subjectName: name, weeklyPeriods: 2, sessionPattern: [2] })));
  const availability = Object.fromEntries(periods.map((period) => [period.id, period.position === 1 ? "PREFERRED" : "AVAILABLE"]));
  const teachers = subjects.flatMap((_, subjectIndex) => [0, 1].map((teacherIndex) => ({
    id: `t${subjectIndex + 1}-${teacherIndex + 1}`,
    name: `دبیر ${subjectIndex + 1}-${teacherIndex + 1}`,
    profileConfigured: true,
    subjectIds: [`s${subjectIndex + 1}`],
    minimumWorkload: 8,
    requiredWorkload: 12,
    maximumWorkload: 16,
    overtimeAllowance: 0,
    dailyMaximum: 6,
    maxConsecutive: 4,
    availability: availability as SchedulingProblem["teachers"][number]["availability"],
  })));
  return { schoolId: "typical-school", academicYearId: "year", academicYearTitle: "۱۴۰۵–۱۴۰۶", classes, curriculum, periods, teachers };
}

describe("benchmark مدرسه متعارف", () => {
  it("۱۲ کلاس، ۴۸ جلسه و ۸ دبیر را در budget تولید و مستقل اعتبارسنجی می‌کند", () => {
    const problem = makeTypicalSchool();
    const started = performance.now();
    const result = solveSchedule(problem, { maxCandidates: 1, nodeBudget: 250_000, timeBudgetMs: 3_000 });
    const wallTimeMs = Math.round(performance.now() - started);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].assignments).toHaveLength(48);
    expect(validateSchedule(problem, result.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toHaveLength(0);
    expect(result.elapsedMs).toBeLessThanOrEqual(3_100);
    console.info(`[scheduling-benchmark] classes=12 sessions=48 teachers=8 wall=${wallTimeMs}ms nodes=${result.exploredNodes}`);
  }, 10_000);
});
