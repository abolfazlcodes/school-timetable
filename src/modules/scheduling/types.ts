import type { AvailabilityStatus } from "@/db/schema";

export type IssueSeverity = "ERROR" | "WARNING" | "INFO";
export type CycleWeek = "A" | "B";
export type WeekPattern = "EVERY_WEEK" | "WEEK_A" | "WEEK_B";
export interface SchedulingIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  entityType?: "school" | "class" | "subject" | "teacher" | "session";
  entityId?: string;
  fixHref?: string;
}
export interface ProblemPeriod {
  id: string;
  dayId: string;
  dayLabel: string;
  dayOrder: number;
  position: number;
  label: string;
  startTime: string;
  endTime: string;
  instructionalUnits: number;
  isLast: boolean;
}
export interface ProblemClass {
  id: string;
  name: string;
  gradeId: string;
  gradeName: string;
  gradeCode?: string;
  gradeOrder?: number;
  majorId: string | null;
  majorName: string | null;
  majorCode?: string | null;
}
export interface CurriculumRequirement {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyHours: number;
  sessionPattern: number[];
  teacherAllocations?: ClassTeacherAllocation[];
  /** Legacy single-teacher lock kept for old snapshots and callers. */
  assignedTeacherId?: string | null;
}
export interface ClassTeacherAllocation {
  teacherId: string;
  assignedWeeklyHours: number;
}
export interface TeacherSubjectAssignment {
  subjectId: string;
  assignedWeeklyHours: number;
}
export interface TeacherResource {
  id: string;
  name: string;
  subjectAssignments: TeacherSubjectAssignment[];
  profileConfigured: boolean;
  minimumWorkload: number;
  requiredWorkload: number;
  maximumWorkload: number;
  overtimeAllowance: number;
  dailyMaximum: number;
  maxConsecutive: number;
  availability: Record<string, AvailabilityStatus>;
}
export interface SchedulingProblem {
  schoolId: string;
  academicYearId: string;
  academicYearTitle: string;
  classes: ProblemClass[];
  periods: ProblemPeriod[];
  curriculum: CurriculumRequirement[];
  teachers: TeacherResource[];
}
export interface SessionRequirement {
  id: string;
  curriculumId: string;
  ordinal: number;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  workloadHours: number;
  assignedTeacherId?: string | null;
}
export interface ScheduleAssignment {
  sessionId: string;
  curriculumId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayId: string;
  startPosition: number;
  periodIds: string[];
  /** Optional only for reading schedule snapshots created before csp-1.2. */
  weekPattern?: WeekPattern;
}

export interface AlternatingLessonIdentity {
  classId: string;
  curriculumId: string;
  subjectId: string;
  teacherId: string;
}

/**
 * Two alternate-week lessons can directly fill one physical period when they
 * are two parts of the same curriculum row, or when one teacher owns both
 * lessons. A different-teacher/different-subject pair is only valid as part
 * of a reciprocal two-class swap (see `isReciprocalAlternatingSwap`).
 */
export function isDirectAlternatingPair(
  weekA: AlternatingLessonIdentity,
  weekB: AlternatingLessonIdentity,
) {
  return (
    weekA.curriculumId === weekB.curriculumId ||
    weekA.teacherId === weekB.teacherId
  );
}

/**
 * Models the school practice confirmed for two classes and two teachers:
 * week A has C1/T1/S1 + C2/T2/S2 and week B swaps those exact
 * teacher/subject identities between the classes. This keeps both classes
 * and both teachers occupied in the shared physical period in both weeks.
 */
export function isReciprocalAlternatingSwap(
  firstWeekA: AlternatingLessonIdentity,
  firstWeekB: AlternatingLessonIdentity,
  secondWeekA: AlternatingLessonIdentity,
  secondWeekB: AlternatingLessonIdentity,
) {
  return (
    firstWeekA.classId === firstWeekB.classId &&
    secondWeekA.classId === secondWeekB.classId &&
    firstWeekA.classId !== secondWeekA.classId &&
    firstWeekA.teacherId === secondWeekB.teacherId &&
    firstWeekA.subjectId === secondWeekB.subjectId &&
    firstWeekB.teacherId === secondWeekA.teacherId &&
    firstWeekB.subjectId === secondWeekA.subjectId
  );
}

export function alternatingSessionPairs(
  sessions: SessionRequirement[],
): Array<readonly [SessionRequirement, SessionRequirement]> {
  const grouped = new Map<string, SessionRequirement[]>();
  for (const session of sessions) {
    grouped.set(session.curriculumId, [
      ...(grouped.get(session.curriculumId) ?? []),
      session,
    ]);
  }
  return [...grouped.values()].flatMap((items) => {
    const ordered = [...items].sort((left, right) => left.ordinal - right.ordinal);
    return ordered.length === 2 &&
      ordered.every((session) => session.workloadHours === 1)
      ? [[ordered[0], ordered[1]] as const]
      : [];
  });
}

export function normalizedWeekPattern(assignment: Pick<ScheduleAssignment, "weekPattern">): WeekPattern {
  return assignment.weekPattern ?? "EVERY_WEEK";
}

export function activeCycleWeeks(pattern: WeekPattern): CycleWeek[] {
  return pattern === "EVERY_WEEK" ? ["A", "B"] : pattern === "WEEK_A" ? ["A"] : ["B"];
}

export function compatibleWeekPatterns(workloadHours: number, instructionalUnits: number): WeekPattern[] {
  if (workloadHours === instructionalUnits) return ["EVERY_WEEK"];
  if (workloadHours * 2 === instructionalUnits) return ["WEEK_A", "WEEK_B"];
  return [];
}

export function weekPatternLabel(pattern: WeekPattern): string {
  return pattern === "EVERY_WEEK" ? "هر هفته" : pattern === "WEEK_A" ? "هفته اول" : "هفته دوم";
}
export interface PenaltyBreakdown {
  preference: number;
  lastPeriod: number;
  subjectDistribution: number;
  teacherGaps: number;
  classGaps: number;
  workloadBalance: number;
}
export interface ScheduleCandidate {
  rank: number;
  score: number;
  penalty: number;
  penaltyBreakdown: PenaltyBreakdown;
  assignments: ScheduleAssignment[];
  signature: string;
}
export interface SolverOptions {
  maxCandidates?: number;
  timeBudgetMs?: number;
}
export interface SolverResult {
  status: "SUCCEEDED" | "NO_SOLUTION";
  candidates: ScheduleCandidate[];
  exploredNodes: number;
  elapsedMs: number;
  budgetExhausted: boolean;
  issues: SchedulingIssue[];
}

export function expandSessions(
  problem: SchedulingProblem,
): SessionRequirement[] {
  return problem.curriculum.flatMap((item) => {
    const allocatedTeachers = allocatedTeachersForSessions(item);
    return item.sessionPattern.map((workloadHours, ordinal) => ({
      id: `${item.id}:${ordinal + 1}`,
      curriculumId: item.id,
      ordinal,
      classId: item.classId,
      className: item.className,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      workloadHours,
      assignedTeacherId:
        allocatedTeachers?.[ordinal] ?? item.assignedTeacherId ?? null,
    }));
  });
}

/**
 * Divides fixed class/subject teacher hours over the stored session pieces.
 * A tiny deterministic backtracking pass is sufficient because a curriculum
 * row normally contains one to four sessions. `null` means the allocation is
 * internally inconsistent and is reported by preflight before generation.
 */
export function allocatedTeachersForSessions(
  requirement: Pick<
    CurriculumRequirement,
    "weeklyHours" | "sessionPattern" | "teacherAllocations"
  >,
): Array<string | null> | null {
  const allocations = requirement.teacherAllocations;
  if (!allocations?.length) return requirement.sessionPattern.map(() => null);
  if (
    allocations.some(
      (allocation) =>
        !Number.isInteger(allocation.assignedWeeklyHours) ||
        allocation.assignedWeeklyHours <= 0,
    ) ||
    allocations.reduce(
      (sum, allocation) => sum + allocation.assignedWeeklyHours,
      0,
    ) !== requirement.weeklyHours
  ) {
    return null;
  }

  const remaining = allocations.map((allocation) =>
    allocation.assignedWeeklyHours,
  );
  const result: Array<string | null> = requirement.sessionPattern.map(
    () => null,
  );
  const assign = (ordinal: number): boolean => {
    if (ordinal === requirement.sessionPattern.length) {
      return remaining.every((hours) => hours === 0);
    }
    const workload = requirement.sessionPattern[ordinal];
    const candidates = allocations
      .map((_, index) => index)
      .filter((index) => remaining[index] >= workload)
      .sort(
        (left, right) =>
          Number(remaining[left] !== workload) -
            Number(remaining[right] !== workload) ||
          left - right,
      );
    for (const index of candidates) {
      remaining[index] -= workload;
      result[ordinal] = allocations[index].teacherId;
      if (assign(ordinal + 1)) return true;
      result[ordinal] = null;
      remaining[index] += workload;
    }
    return false;
  };

  return assign(0) ? result : null;
}

export function assignedHoursFor(teacher: TeacherResource, subjectId: string) {
  return (
    teacher.subjectAssignments.find((item) => item.subjectId === subjectId)
      ?.assignedWeeklyHours ?? 0
  );
}
