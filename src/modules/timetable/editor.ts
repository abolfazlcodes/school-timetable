import { assignedHoursFor, expandSessions, type ScheduleAssignment, type SchedulingIssue, type SchedulingProblem } from "@/modules/scheduling/types";
import { validateSchedule, validationIssueKey } from "@/modules/scheduling/validator";

export class TimetableEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimetableEditError";
  }
}

export interface PlacementInput {
  sessionId: string;
  teacherId: string;
  dayId: string;
  startPosition: number;
}

export interface EvaluatedChange {
  assignments: ScheduleAssignment[];
  issues: SchedulingIssue[];
  introducedErrors: SchedulingIssue[];
  introducedWarnings: SchedulingIssue[];
}

function sortAssignments(assignments: ScheduleAssignment[]) {
  return [...assignments].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

export function placeSession(problem: SchedulingProblem, assignments: ScheduleAssignment[], input: PlacementInput) {
  const session = expandSessions(problem).find((item) => item.id === input.sessionId);
  if (!session) throw new TimetableEditError("جلسه انتخاب‌شده در نیازهای درسی این سال وجود ندارد.");
  const teacher = problem.teachers.find((item) => item.id === input.teacherId && assignedHoursFor(item, session.subjectId) > 0);
  if (!teacher) throw new TimetableEditError("دبیر انتخاب‌شده مجاز به تدریس این درس نیست.");
  const dayPeriods = problem.periods
    .filter((period) => period.dayId === input.dayId)
    .sort((a, b) => a.position - b.position);
  const startIndex = dayPeriods.findIndex((period) => period.position === input.startPosition);
  const selectedPeriods = startIndex < 0 ? [] : [dayPeriods[startIndex]];
  if (!selectedPeriods.length) throw new TimetableEditError("زنگ انتخاب‌شده در روز موردنظر وجود ندارد.");
  const next: ScheduleAssignment = {
    sessionId: session.id,
    curriculumId: session.curriculumId,
    classId: session.classId,
    subjectId: session.subjectId,
    teacherId: teacher.id,
    dayId: input.dayId,
    startPosition: input.startPosition,
    periodIds: selectedPeriods.map((period) => period.id),
  };
  return sortAssignments([...assignments.filter((item) => item.sessionId !== input.sessionId), next]);
}

export function swapSessions(problem: SchedulingProblem, assignments: ScheduleAssignment[], firstSessionId: string, secondSessionId: string) {
  if (firstSessionId === secondSessionId) throw new TimetableEditError("برای جابه‌جایی، دو جلسه متفاوت انتخاب کنید.");
  const first = assignments.find((item) => item.sessionId === firstSessionId);
  const second = assignments.find((item) => item.sessionId === secondSessionId);
  const sessions = new Map(expandSessions(problem).map((item) => [item.id, item]));
  const firstRequirement = sessions.get(firstSessionId);
  const secondRequirement = sessions.get(secondSessionId);
  if (!first || !second || !firstRequirement || !secondRequirement) throw new TimetableEditError("یکی از جلسات انتخاب‌شده در جدول قرار ندارد.");
  return sortAssignments(assignments.map((assignment) => {
    if (assignment.sessionId === firstSessionId) return { ...assignment, dayId: second.dayId, startPosition: second.startPosition, periodIds: [...second.periodIds] };
    if (assignment.sessionId === secondSessionId) return { ...assignment, dayId: first.dayId, startPosition: first.startPosition, periodIds: [...first.periodIds] };
    return assignment;
  }));
}

export function removeSession(assignments: ScheduleAssignment[], sessionId: string) {
  if (!assignments.some((item) => item.sessionId === sessionId)) throw new TimetableEditError("این جلسه پیش‌تر از جدول برداشته شده است.");
  return sortAssignments(assignments.filter((item) => item.sessionId !== sessionId));
}

export function evaluateChange(problem: SchedulingProblem, currentAssignments: ScheduleAssignment[], nextAssignments: ScheduleAssignment[]): EvaluatedChange {
  const currentIssueKeys = new Set(validateSchedule(problem, currentAssignments).map(validationIssueKey));
  const issues = validateSchedule(problem, nextAssignments);
  const introduced = issues.filter((issue) => !currentIssueKeys.has(validationIssueKey(issue)));
  return {
    assignments: sortAssignments(nextAssignments),
    issues,
    introducedErrors: introduced.filter((issue) => issue.severity === "ERROR"),
    introducedWarnings: introduced.filter((issue) => issue.severity === "WARNING"),
  };
}
