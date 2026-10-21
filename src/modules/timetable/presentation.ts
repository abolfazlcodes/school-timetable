import {
  normalizedWeekPattern,
  type ScheduleAssignment,
  type WeekPattern,
} from "@/modules/scheduling/types";

export interface TimetableAssignmentDisplayGroup {
  key: string;
  assignment: ScheduleAssignment;
  assignments: ScheduleAssignment[];
  displayWeekPattern: WeekPattern;
  combinedEveryWeek: boolean;
}

function hasSameDisplayIdentity(
  left: ScheduleAssignment,
  right: ScheduleAssignment,
) {
  return (
    left.curriculumId === right.curriculumId &&
    left.classId === right.classId &&
    left.subjectId === right.subjectId &&
    left.teacherId === right.teacherId &&
    left.dayId === right.dayId &&
    left.startPosition === right.startPosition &&
    left.periodIds.length === right.periodIds.length &&
    left.periodIds.every((periodId, index) => periodId === right.periodIds[index])
  );
}

/**
 * A split [1, 1] requirement is stored as two opposite-cycle assignments so
 * the solver and workload accounting remain exact. When both halves have the
 * exact same lesson, teacher and physical placement, users experience it as
 * one ordinary weekly lesson and should see it only once.
 *
 * Different teachers, curriculum rows, classes, subjects or placements are
 * deliberately not combined (including reciprocal two-class swaps).
 */
export function groupTimetableAssignmentsForDisplay(
  assignments: ScheduleAssignment[],
): TimetableAssignmentDisplayGroup[] {
  const consumed = new Set<number>();
  const groups: TimetableAssignmentDisplayGroup[] = [];

  for (const [index, assignment] of assignments.entries()) {
    if (consumed.has(index)) continue;
    const pattern = normalizedWeekPattern(assignment);
    const complementaryPattern =
      pattern === "WEEK_A"
        ? "WEEK_B"
        : pattern === "WEEK_B"
          ? "WEEK_A"
          : null;
    const pairIndex = complementaryPattern
      ? assignments.findIndex(
          (candidate, candidateIndex) =>
            candidateIndex > index &&
            !consumed.has(candidateIndex) &&
            normalizedWeekPattern(candidate) === complementaryPattern &&
            hasSameDisplayIdentity(assignment, candidate),
        )
      : -1;

    if (pairIndex >= 0) {
      const pair = [assignment, assignments[pairIndex]].sort((left, right) =>
        normalizedWeekPattern(left).localeCompare(normalizedWeekPattern(right)),
      );
      consumed.add(index);
      consumed.add(pairIndex);
      groups.push({
        key: pair.map((item) => item.sessionId).join(":"),
        assignment: pair[0],
        assignments: pair,
        displayWeekPattern: "EVERY_WEEK",
        combinedEveryWeek: true,
      });
      continue;
    }

    consumed.add(index);
    groups.push({
      key: assignment.sessionId,
      assignment,
      assignments: [assignment],
      displayWeekPattern: pattern,
      combinedEveryWeek: false,
    });
  }

  return groups;
}
