import { describe, expect, it } from "vitest";
import { makeProblem } from "./fixtures.test-helper";
import { scoreSchedule, solveSchedule } from "./solver";
import type { SchedulingProblem } from "./types";
import { validateSchedule } from "./validator";

describe("موتور قیود CP-SAT", () => {
  it("همه ساعات و تعداد جلسات را بدون conflict زمان‌بندی می‌کند", async () => {
    const problem = makeProblem(); const result = await solveSchedule(problem, { maxCandidates: 3, timeBudgetMs: 1_000 });
    expect(result.status).toBe("SUCCEEDED"); expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates[0].assignments).toHaveLength(4);
    expect(validateSchedule(problem, result.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toEqual([]);
  });

  it("برای ورودی یکسان نتیجه و ترتیب یکسان می‌دهد", async () => {
    const problem = makeProblem(); const first = await solveSchedule(problem, { timeBudgetMs: 5_000 }); const second = await solveSchedule(problem, { timeBudgetMs: 5_000 });
    expect(first.candidates.map((item) => item.signature)).toEqual(second.candidates.map((item) => item.signature));
    expect(first.candidates.map((item) => item.score)).toEqual(second.candidates.map((item) => item.score));
  });

  it("با زمان واقعی و مدت‌های نابرابر زنگ‌ها همان قیود slot را حفظ می‌کند", async () => {
    const original = makeProblem();
    const customTimes = makeProblem({
      periods: makeProblem().periods.map((period) => {
        const times = period.position === 1 ? ["08:00", "09:15"] : period.position === 2 ? ["09:25", "10:45"] : ["11:00", "12:25"];
        return { ...period, startTime: times[0], endTime: times[1] };
      }),
    });
    const first = await solveSchedule(original, { maxCandidates: 1, timeBudgetMs: 1_000 });
    const second = await solveSchedule(customTimes, { maxCandidates: 1, timeBudgetMs: 1_000 });
    expect(second.status).toBe("SUCCEEDED");
    expect(second.candidates[0].signature).toBe(first.candidates[0].signature);
    expect(validateSchedule(customTimes, second.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toEqual([]);
  });

  it("در مدرسه شش‌زنگه به دبیر با سقف چهار زنگ، پنج زنگ متوالی نمی‌دهد", async () => {
    const periods: SchedulingProblem["periods"] = Array.from(
      { length: 6 },
      (_, index) => ({
        id: `sa-${index + 1}`,
        dayId: "sat",
        dayLabel: "شنبه",
        dayOrder: 0,
        position: index + 1,
        label: `زنگ ${index + 1}`,
        startTime: `${String(8 + index).padStart(2, "0")}:00`,
        endTime: `${String(8 + index).padStart(2, "0")}:45`,
        instructionalUnits: 1,
        isLast: index === 5,
      }),
    );
    const availability = Object.fromEntries(
      periods.map((period) => [period.id, "AVAILABLE"]),
    ) as SchedulingProblem["teachers"][number]["availability"];
    const problem: SchedulingProblem = {
      schoolId: "six-period-school",
      academicYearId: "year",
      academicYearTitle: "۱۴۰۵",
      classes: [{
        id: "c1",
        name: "دهم ۱",
        gradeId: "g10",
        gradeName: "دهم",
        majorId: null,
        majorName: null,
      }],
      periods,
      curriculum: [{
        id: "math",
        classId: "c1",
        className: "دهم ۱",
        subjectId: "math",
        subjectName: "ریاضی",
        weeklyHours: 5,
        sessionPattern: [1, 1, 1, 1, 1],
      }],
      teachers: [
        {
          id: "math-teacher",
          name: "دبیر ریاضی",
          profileConfigured: true,
          subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 5 }],
          minimumWorkload: 0,
          requiredWorkload: 5,
          maximumWorkload: 5,
          overtimeAllowance: 0,
          dailyMaximum: 6,
          maxConsecutive: 4,
          availability,
        },
      ],
    };

    const result = await solveSchedule(problem, {
      maxCandidates: 5,
      timeBudgetMs: 2_000,
    });

    expect(result.status, result.issues.map((issue) => issue.message).join(" | ")).toBe("SUCCEEDED");
    const positions = result.candidates[0].assignments
      .filter((assignment) => assignment.teacherId === "math-teacher")
      .map((assignment) => assignment.startPosition)
      .sort((a, b) => a - b);
    const longestRun = positions.reduce(
      (state, position) => ({
        current: position === state.previous + 1 ? state.current + 1 : 1,
        longest: Math.max(
          state.longest,
          position === state.previous + 1 ? state.current + 1 : 1,
        ),
        previous: position,
      }),
      { current: 0, longest: 0, previous: Number.NEGATIVE_INFINITY },
    ).longest;
    expect(longestRun).toBeLessThanOrEqual(4);
    expect(
      validateSchedule(problem, result.candidates[0].assignments).filter(
        (issue) => issue.severity === "ERROR",
      ),
    ).toEqual([]);
  });

  it("دو جلسه یک‌ساعته را در هفته‌های متفاوت یک زنگ دوساعته قرار می‌دهد", async () => {
    const base = makeProblem();
    const period = { ...base.periods[0], instructionalUnits: 2, isLast: true };
    const problem = makeProblem({
      periods: [period],
      curriculum: base.curriculum.map((item) => ({ ...item, weeklyHours: 1, sessionPattern: [1] })),
      teachers: [{ ...base.teachers[0], requiredWorkload: 2, subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 2 }], dailyMaximum: 1, availability: { [period.id]: "AVAILABLE" } }],
    });
    const result = await solveSchedule(problem, { maxCandidates: 1, timeBudgetMs: 1_000 });
    expect(result.status).toBe("SUCCEEDED");
    expect(new Set(result.candidates[0].assignments.map((item) => item.weekPattern))).toEqual(new Set(["WEEK_A", "WEEK_B"]));
    expect(result.candidates[0].assignments.every((item) => item.periodIds[0] === period.id)).toBe(true);
    expect(validateSchedule(problem, result.candidates[0].assignments).filter((issue) => issue.severity === "ERROR")).toEqual([]);
  });

  it("دو جلسه دوساعته را یک‌هفته‌درمیان در یک زنگ چهارساعته جا می‌دهد", async () => {
    const base = makeProblem();
    const period = {
      ...base.periods[0],
      instructionalUnits: 4,
      isLast: true,
    };
    const problem = makeProblem({
      periods: [period],
      classes: [base.classes[0]],
      curriculum: [{
        ...base.curriculum[0],
        weeklyHours: 4,
        sessionPattern: [2, 2],
      }],
      teachers: [{
        ...base.teachers[0],
        requiredWorkload: 4,
        maximumWorkload: 4,
        subjectAssignments: [{ subjectId: "math", assignedWeeklyHours: 4 }],
        dailyMaximum: 1,
        availability: { [period.id]: "AVAILABLE" },
      }],
    });

    const result = await solveSchedule(problem, {
      maxCandidates: 1,
      timeBudgetMs: 1_000,
    });

    expect(result.status, JSON.stringify(result.issues)).toBe("SUCCEEDED");
    expect(
      new Set(
        result.candidates[0].assignments.map((item) => item.weekPattern),
      ),
    ).toEqual(new Set(["WEEK_A", "WEEK_B"]));
    expect(
      result.candidates[0].assignments.every(
        (item) => item.periodIds[0] === period.id,
      ),
    ).toBe(true);
    expect(
      validateSchedule(problem, result.candidates[0].assignments).filter(
        (issue) => issue.severity === "ERROR",
      ),
    ).toEqual([]);
  });

  it("قفل‌های تجزیه، ترتیب صوری جلسه‌های همسان را اجباری نمی‌کنند", async () => {
    const periods: SchedulingProblem["periods"] = [
      {
        id: "early",
        dayId: "only-day",
        dayLabel: "روز",
        dayOrder: 0,
        position: 1,
        label: "زود",
        startTime: "08:00",
        endTime: "09:00",
        instructionalUnits: 1,
        isLast: false,
      },
      {
        id: "late",
        dayId: "only-day",
        dayLabel: "روز",
        dayOrder: 0,
        position: 2,
        label: "دیر",
        startTime: "09:00",
        endTime: "10:00",
        instructionalUnits: 1,
        isLast: true,
      },
    ];
    const classes: SchedulingProblem["classes"] = [];
    const curriculum: SchedulingProblem["curriculum"] = [];
    const teachers: SchedulingProblem["teachers"] = [];
    for (let index = 0; index < 40; index += 1) {
      const classId = `class-${index}`;
      const subjectId = `subject-${index}`;
      // The deterministic teacher relaxation assigns :1 to the later-only
      // teacher, exercising an extendable lock whose ordinal ranks are reversed.
      const lateTeacherId = `teacher-${index}-b-late`;
      const earlyTeacherId = `teacher-${index}-a-early`;
      classes.push({
        id: classId,
        name: `Class ${index}`,
        gradeId: "grade",
        gradeName: "Grade",
        majorId: null,
        majorName: null,
      });
      curriculum.push({
        id: `requirement-${index}`,
        classId,
        className: `Class ${index}`,
        subjectId,
        subjectName: `Subject ${index}`,
        weeklyHours: 2,
        sessionPattern: [1, 1],
      });
      teachers.push(
        {
          id: lateTeacherId,
          name: "Same",
          subjectAssignments: [{ subjectId, assignedWeeklyHours: 1 }],
          profileConfigured: true,
          minimumWorkload: 0,
          requiredWorkload: 1,
          maximumWorkload: 1,
          overtimeAllowance: 0,
          dailyMaximum: 1,
          maxConsecutive: 1,
          availability: { early: "UNAVAILABLE", late: "AVAILABLE" },
        },
        {
          id: earlyTeacherId,
          name: "Same",
          subjectAssignments: [{ subjectId, assignedWeeklyHours: 1 }],
          profileConfigured: true,
          minimumWorkload: 0,
          requiredWorkload: 1,
          maximumWorkload: 1,
          overtimeAllowance: 0,
          dailyMaximum: 1,
          maxConsecutive: 1,
          availability: { early: "AVAILABLE", late: "UNAVAILABLE" },
        },
      );
    }
    const problem: SchedulingProblem = {
      schoolId: "canonical-lock-regression",
      academicYearId: "year",
      academicYearTitle: "Year",
      classes,
      periods,
      curriculum,
      teachers,
    };

    const result = await solveSchedule(problem, {
      maxCandidates: 1,
      timeBudgetMs: 10_000,
    });

    expect(result.status, JSON.stringify(result.issues)).toBe("SUCCEEDED");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].assignments).toHaveLength(80);
    expect(
      validateSchedule(problem, result.candidates[0].assignments).filter(
        (issue) => issue.severity === "ERROR",
      ),
    ).toEqual([]);
    let reversedPairs = 0;
    for (let index = 0; index < 40; index += 1) {
      const first = result.candidates[0].assignments.find(
        (item) => item.sessionId === `requirement-${index}:1`,
      );
      const second = result.candidates[0].assignments.find(
        (item) => item.sessionId === `requirement-${index}:2`,
      );
      if (
        first?.periodIds[0] === "late" &&
        second?.periodIds[0] === "early"
      ) {
        reversedPairs += 1;
      }
    }
    expect(reversedPairs).toBe(40);
  });

  it("ترتیب تکراری روزها جلسه‌های همسان را به‌اشتباه ناممکن نمی‌کند", async () => {
    const periods: SchedulingProblem["periods"] = ["sat", "sun"].map(
      (dayId) => ({
        id: `${dayId}-p1`,
        dayId,
        dayLabel: dayId,
        dayOrder: 0,
        position: 1,
        label: "زنگ ۱",
        startTime: "08:00",
        endTime: "09:00",
        instructionalUnits: 1,
        isLast: true,
      }),
    );
    const problem: SchedulingProblem = {
      schoolId: "same-day-order",
      academicYearId: "year",
      academicYearTitle: "Year",
      classes: [{
        id: "c",
        name: "c",
        gradeId: "g",
        gradeName: "g",
        majorId: null,
        majorName: null,
      }],
      periods,
      curriculum: [{
        id: "r",
        classId: "c",
        className: "c",
        subjectId: "s",
        subjectName: "s",
        weeklyHours: 2,
        sessionPattern: [1, 1],
      }],
      teachers: [{
        id: "t",
        name: "t",
        profileConfigured: true,
        subjectAssignments: [{ subjectId: "s", assignedWeeklyHours: 2 }],
        minimumWorkload: 0,
        requiredWorkload: 2,
        maximumWorkload: 2,
        overtimeAllowance: 0,
        dailyMaximum: 1,
        maxConsecutive: 1,
        availability: {
          "sat-p1": "AVAILABLE",
          "sun-p1": "AVAILABLE",
        },
      }],
    };

    const result = await solveSchedule(problem, {
      maxCandidates: 1,
      timeBudgetMs: 1_000,
    });

    expect(result.status, JSON.stringify(result.issues)).toBe("SUCCEEDED");
    expect(result.candidates).toHaveLength(1);
    expect(
      result.candidates[0].assignments.map((item) => item.dayId).sort(),
    ).toEqual(["sat", "sun"]);
    expect(
      validateSchedule(problem, result.candidates[0].assignments).filter(
        (issue) => issue.severity === "ERROR",
      ),
    ).toEqual([]);
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

  it("سقف workload را hard نگه می‌دارد و no-solution معتبر برمی‌گرداند", async () => {
    const problem = makeProblem(); problem.teachers[0] = { ...problem.teachers[0], maximumWorkload: 2, overtimeAllowance: 0 };
    const result = await solveSchedule(problem, { timeBudgetMs: 1_000 });
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
