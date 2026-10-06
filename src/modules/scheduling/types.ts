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
  majorId: string | null;
  majorName: string | null;
}
export interface CurriculumRequirement {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyHours: number;
  sessionPattern: number[];
  assignedTeacherId?: string | null;
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
  nodeBudget?: number;
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
  return problem.curriculum.flatMap((item) =>
    item.sessionPattern.map((workloadHours, ordinal) => ({
      id: `${item.id}:${ordinal + 1}`,
      curriculumId: item.id,
      ordinal,
      classId: item.classId,
      className: item.className,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      workloadHours,
      assignedTeacherId: item.assignedTeacherId,
    })),
  );
}

export function assignedHoursFor(teacher: TeacherResource, subjectId: string) {
  return (
    teacher.subjectAssignments.find((item) => item.subjectId === subjectId)
      ?.assignedWeeklyHours ?? 0
  );
}
