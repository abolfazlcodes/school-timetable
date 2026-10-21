import { describe, expect, it } from "vitest";
import type { ScheduleAssignment } from "@/modules/scheduling/types";
import { groupTimetableAssignmentsForDisplay } from "./presentation";

function assignment(
  sessionId: string,
  weekPattern: ScheduleAssignment["weekPattern"],
  overrides: Partial<ScheduleAssignment> = {},
): ScheduleAssignment {
  return {
    sessionId,
    curriculumId: "curriculum-1",
    classId: "class-1",
    subjectId: "subject-1",
    teacherId: "teacher-1",
    dayId: "saturday",
    startPosition: 2,
    periodIds: ["saturday-2"],
    weekPattern,
    ...overrides,
  };
}

describe("نمایش برنامه دوهفته‌ای", () => {
  it("دو نیمه کاملاً یکسان هفته اول و دوم را یک درس هرهفته‌ای نشان می‌دهد", () => {
    const groups = groupTimetableAssignmentsForDisplay([
      assignment("session-a", "WEEK_A"),
      assignment("session-b", "WEEK_B"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      displayWeekPattern: "EVERY_WEEK",
      combinedEveryWeek: true,
    });
    expect(groups[0].assignments.map((item) => item.sessionId)).toEqual([
      "session-a",
      "session-b",
    ]);
  });

  it("جلسه‌های متعلق به دو دبیر متفاوت را ادغام نمی‌کند", () => {
    const groups = groupTimetableAssignmentsForDisplay([
      assignment("session-a", "WEEK_A"),
      assignment("session-b", "WEEK_B", { teacherId: "teacher-2" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.displayWeekPattern)).toEqual([
      "WEEK_A",
      "WEEK_B",
    ]);
  });

  it("جلسه‌های دو برنامه درسی یا زنگ متفاوت را ادغام نمی‌کند", () => {
    const groups = groupTimetableAssignmentsForDisplay([
      assignment("session-a", "WEEK_A"),
      assignment("session-b", "WEEK_B", { curriculumId: "curriculum-2" }),
      assignment("session-c", "WEEK_B", {
        startPosition: 3,
        periodIds: ["saturday-3"],
      }),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups.every((group) => !group.combinedEveryWeek)).toBe(true);
  });

  it("یک نیمه تنها را همراه نوبت هفته نگه می‌دارد", () => {
    const [group] = groupTimetableAssignmentsForDisplay([
      assignment("session-a", "WEEK_A"),
    ]);

    expect(group.displayWeekPattern).toBe("WEEK_A");
    expect(group.combinedEveryWeek).toBe(false);
  });
});
