import { BoolVar, CpModel, CpSolver, CpSolverStatus, LinearExpr } from "@ortools-node/cp-sat";
import { validateSchedule } from "./validator";
import {
  activeCycleWeeks,
  assignedHoursFor,
  compatibleWeekPatterns,
  expandSessions,
  normalizedWeekPattern,
  type PenaltyBreakdown,
  type ScheduleAssignment,
  type ScheduleCandidate,
  type SessionRequirement,
  type SolverOptions,
  type SolverResult,
  type SchedulingProblem,
} from "./types";

const ENGINE_VERSION = "cp-sat-2.0";
export { ENGINE_VERSION };

interface Placement {
  variable: BoolVar;
  session: SessionRequirement;
  assignment: ScheduleAssignment;
  workloadHours: number;
  basePenalty: number;
}

function gapCount(positions: number[]) {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  return sorted.length < 2
    ? 0
    : Math.max(0, sorted.at(-1)! - sorted[0] + 1 - sorted.length);
}

export function scoreSchedule(
  problem: SchedulingProblem,
  assignments: ScheduleAssignment[],
) {
  const periods = new Map(problem.periods.map((period) => [period.id, period]));
  const teachers = new Map(problem.teachers.map((teacher) => [teacher.id, teacher]));
  const sessions = new Map(expandSessions(problem).map((session) => [session.id, session]));
  const breakdown: PenaltyBreakdown = {
    preference: 0,
    lastPeriod: 0,
    subjectDistribution: 0,
    teacherGaps: 0,
    classGaps: 0,
    workloadBalance: 0,
  };
  const teacherDays = new Map<string, number[]>();
  const classDays = new Map<string, number[]>();
  const curriculumDays = new Map<string, string[]>();
  const teacherLoads = new Map<string, number>();
  for (const assignment of assignments) {
    const teacher = teachers.get(assignment.teacherId)!;
    for (const periodId of assignment.periodIds) {
      const period = periods.get(periodId)!;
      if (teacher.availability[periodId] !== "PREFERRED") breakdown.preference += 1;
      if (period.isLast) breakdown.lastPeriod += 3;
      for (const week of activeCycleWeeks(normalizedWeekPattern(assignment))) {
        teacherDays.set(`${teacher.id}:${assignment.dayId}:${week}`, [
          ...(teacherDays.get(`${teacher.id}:${assignment.dayId}:${week}`) ?? []),
          period.position,
        ]);
        classDays.set(`${assignment.classId}:${assignment.dayId}:${week}`, [
          ...(classDays.get(`${assignment.classId}:${assignment.dayId}:${week}`) ?? []),
          period.position,
        ]);
      }
    }
    const days = curriculumDays.get(assignment.curriculumId) ?? [];
    if (days.includes(assignment.dayId)) breakdown.subjectDistribution += 5;
    curriculumDays.set(assignment.curriculumId, [...days, assignment.dayId]);
    teacherLoads.set(
      teacher.id,
      (teacherLoads.get(teacher.id) ?? 0) +
        (sessions.get(assignment.sessionId)?.workloadHours ?? 0),
    );
  }
  for (const positions of teacherDays.values()) breakdown.teacherGaps += gapCount(positions) * 2;
  for (const positions of classDays.values()) breakdown.classGaps += gapCount(positions);
  for (const teacher of problem.teachers) {
    const load = teacherLoads.get(teacher.id) ?? 0;
    breakdown.workloadBalance += Math.abs(load - teacher.requiredWorkload);
    if (load > teacher.maximumWorkload) breakdown.workloadBalance += (load - teacher.maximumWorkload) * 3;
  }
  const penalty = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { penalty, score: Math.max(0, 10_000 - penalty * 100), breakdown };
}

function signature(assignments: ScheduleAssignment[]) {
  return assignments
    .map((item) => `${item.classId}:${item.subjectId}:${item.teacherId}:${item.dayId}:${item.startPosition}:${item.periodIds.join(",")}:${normalizedWeekPattern(item)}`)
    .sort()
    .join("|");
}

function buildPlacements(
  model: CpModel,
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
) {
  const placements: Placement[] = [];
  const bySession = new Map<string, Placement[]>();
  const teachers = [...problem.teachers].sort((a, b) => a.id.localeCompare(b.id));
  const periods = [...problem.periods].sort((a, b) => a.dayOrder - b.dayOrder || a.position - b.position || a.id.localeCompare(b.id));
  let index = 0;
  for (const session of sessions) {
    const domain: Placement[] = [];
    for (const teacher of teachers) {
      if (assignedHoursFor(teacher, session.subjectId) <= 0) continue;
      if (session.assignedTeacherId && teacher.id !== session.assignedTeacherId) continue;
      for (const period of periods) {
        const availability = teacher.availability[period.id];
        if (availability !== "AVAILABLE" && availability !== "PREFERRED") continue;
        for (const weekPattern of compatibleWeekPatterns(session.workloadHours, period.instructionalUnits)) {
          const placement: Placement = {
            variable: model.newBoolVar(`p${index++}`),
            session,
            workloadHours: session.workloadHours,
            basePenalty: (availability === "PREFERRED" ? 0 : 1) + (period.isLast ? 3 : 0),
            assignment: {
              sessionId: session.id,
              curriculumId: session.curriculumId,
              classId: session.classId,
              subjectId: session.subjectId,
              teacherId: teacher.id,
              dayId: period.dayId,
              startPosition: period.position,
              periodIds: [period.id],
              weekPattern,
            },
          };
          placements.push(placement);
          domain.push(placement);
        }
      }
    }
    bySession.set(session.id, domain);
  }
  return { placements, bySession };
}

function addAtMostWeighted(model: CpModel, placements: Placement[], maximum: number) {
  if (!placements.length) return;
  const total = placements.reduce((sum, placement) => sum + placement.workloadHours, 0);
  if (total <= maximum) return;
  model.addLessOrEqual(
    LinearExpr.weightedSum(
      placements.map((placement) => placement.variable),
      placements.map((placement) => placement.workloadHours),
    ),
    maximum,
  );
}

function addHardConstraints(
  model: CpModel,
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  placements: Placement[],
  bySession: Map<string, Placement[]>,
  requireAll = true,
) {
  for (const session of sessions) {
    const variables = (bySession.get(session.id) ?? []).map((placement) => placement.variable);
    if (requireAll) model.addExactlyOne(variables);
    else model.addAtMostOne(variables);
  }

  const classSlots = new Map<string, BoolVar[]>();
  const teacherSlots = new Map<string, BoolVar[]>();
  const teacherDays = new Map<string, Placement[]>();
  const teacherSubjects = new Map<string, Placement[]>();
  const teacherPlacements = new Map<string, Placement[]>();
  for (const placement of placements) {
    const { assignment } = placement;
    for (const week of activeCycleWeeks(normalizedWeekPattern(assignment))) {
      for (const periodId of assignment.periodIds) {
        const classKey = `${assignment.classId}:${periodId}:${week}`;
        const teacherKey = `${assignment.teacherId}:${periodId}:${week}`;
        classSlots.set(classKey, [...(classSlots.get(classKey) ?? []), placement.variable]);
        teacherSlots.set(teacherKey, [...(teacherSlots.get(teacherKey) ?? []), placement.variable]);
      }
      const dayKey = `${assignment.teacherId}:${assignment.dayId}:${week}`;
      teacherDays.set(dayKey, [...(teacherDays.get(dayKey) ?? []), placement]);
    }
    const subjectKey = `${assignment.teacherId}:${assignment.subjectId}`;
    teacherSubjects.set(subjectKey, [...(teacherSubjects.get(subjectKey) ?? []), placement]);
    teacherPlacements.set(assignment.teacherId, [...(teacherPlacements.get(assignment.teacherId) ?? []), placement]);
  }

  const weeklySchoolCapacity = problem.periods.reduce((sum, period) => sum + period.instructionalUnits, 0);
  const fullClasses = new Set(
    problem.classes
      .filter((schoolClass) => sessions.filter((session) => session.classId === schoolClass.id).reduce((sum, session) => sum + session.workloadHours, 0) === weeklySchoolCapacity)
      .map((schoolClass) => schoolClass.id),
  );
  for (const [key, variables] of classSlots) {
    if (requireAll && fullClasses.has(key.split(":")[0])) model.addExactlyOne(variables);
    else if (variables.length > 1) model.addAtMostOne(variables);
  }

  const demandBySubject = new Map<string, number>();
  for (const session of sessions) demandBySubject.set(session.subjectId, (demandBySubject.get(session.subjectId) ?? 0) + session.workloadHours);
  const exactSubjects = new Set(
    [...demandBySubject]
      .filter(([subjectId, demand]) => problem.teachers.reduce((sum, teacher) => sum + assignedHoursFor(teacher, subjectId), 0) === demand)
      .map(([subjectId]) => subjectId),
  );

  for (const [key, variables] of teacherSlots) {
    const teacherId = key.split(":")[0];
    const teacher = problem.teachers.find((item) => item.id === teacherId);
    if (!teacher) continue;
    const assignedTotal = teacher.subjectAssignments.reduce((sum, subject) => sum + subject.assignedWeeklyHours, 0);
    const availableCapacity = problem.periods.reduce((sum, period) => ["AVAILABLE", "PREFERRED"].includes(teacher.availability[period.id]) ? sum + period.instructionalUnits : sum, 0);
    const everySubjectIsExact = teacher.subjectAssignments.every((subject) => exactSubjects.has(subject.subjectId));
    if (requireAll && everySubjectIsExact && assignedTotal === availableCapacity) model.addExactlyOne(variables);
    else if (variables.length > 1) model.addAtMostOne(variables);
  }

  for (const teacher of problem.teachers) {
    addAtMostWeighted(model, teacherPlacements.get(teacher.id) ?? [], teacher.maximumWorkload + teacher.overtimeAllowance);
    for (const subject of teacher.subjectAssignments) {
      const subjectPlacements = teacherSubjects.get(`${teacher.id}:${subject.subjectId}`) ?? [];
      if (requireAll && exactSubjects.has(subject.subjectId)) {
        model.addEquality(
          LinearExpr.weightedSum(subjectPlacements.map((placement) => placement.variable), subjectPlacements.map((placement) => placement.workloadHours)),
          subject.assignedWeeklyHours,
        );
      } else {
        addAtMostWeighted(model, subjectPlacements, subject.assignedWeeklyHours);
      }
    }
    for (const [key, dayPlacements] of teacherDays) {
      if (!key.startsWith(`${teacher.id}:`)) continue;
      if (dayPlacements.length > teacher.dailyMaximum) {
        model.addLessOrEqual(LinearExpr.sum(dayPlacements.map((placement) => placement.variable)), teacher.dailyMaximum);
      }
      if (teacher.maxConsecutive >= 4) continue;
      const positions = [...new Set(dayPlacements.map((placement) => placement.assignment.startPosition))].sort((a, b) => a - b);
      for (const startPosition of positions) {
        const window = Array.from({ length: teacher.maxConsecutive + 1 }, (_, offset) => startPosition + offset);
        if (!window.every((position) => positions.includes(position))) continue;
        const inWindow = dayPlacements.filter((placement) => window.includes(placement.assignment.startPosition));
        model.addLessOrEqual(LinearExpr.sum(inWindow.map((placement) => placement.variable)), teacher.maxConsecutive);
      }
    }
  }

  if (!requireAll) return;
  const periodRank = new Map(problem.periods.map((period) => [period.id, period.dayOrder * 100 + period.position]));
  const sessionsByCurriculum = new Map<string, SessionRequirement[]>();
  for (const session of sessions) sessionsByCurriculum.set(session.curriculumId, [...(sessionsByCurriculum.get(session.curriculumId) ?? []), session]);
  for (const curriculumSessions of sessionsByCurriculum.values()) {
    const ordered = [...curriculumSessions].sort((a, b) => a.ordinal - b.ordinal);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (previous.workloadHours !== current.workloadHours) continue;
      const previousDomain = bySession.get(previous.id) ?? [];
      const currentDomain = bySession.get(current.id) ?? [];
      const rank = (placement: Placement) => {
        const weekOffset = placement.assignment.weekPattern === "WEEK_A" ? 0 : placement.assignment.weekPattern === "WEEK_B" ? 1 : 0;
        return (periodRank.get(placement.assignment.periodIds[0]) ?? 0) * 2 + weekOffset;
      };
      model.addLessThan(
        LinearExpr.weightedSum(previousDomain.map((placement) => placement.variable), previousDomain.map(rank)),
        LinearExpr.weightedSum(currentDomain.map((placement) => placement.variable), currentDomain.map(rank)),
      );
    }
  }
}

function assignmentsFromSolution(solver: CpSolver, placements: Placement[]) {
  return placements
    .filter((placement) => solver.booleanValue(placement.variable))
    .map((placement) => placement.assignment)
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

async function diagnoseMaximumFeasible(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  timeBudgetMs: number,
) {
  const model = new CpModel();
  const { placements, bySession } = buildPlacements(model, problem, sessions);
  addHardConstraints(model, problem, sessions, placements, bySession, false);
  model.maximize(
    LinearExpr.weightedSum(
      placements.map((placement) => placement.variable),
      placements.map((placement) => placement.workloadHours * 1_000 + 1),
    ),
  );
  const solver = new CpSolver();
  solver.parameters.maxTimeInSeconds = Math.max(1, timeBudgetMs) / 1_000;
  solver.parameters.numSearchWorkers = 8;
  solver.parameters.interleaveSearch = true;
  solver.parameters.randomSeed = 1;
  const status = await solver.solve(model);
  if (status !== CpSolverStatus.OPTIMAL && status !== CpSolverStatus.FEASIBLE) return [];
  const scheduled = new Set(assignmentsFromSolution(solver, placements).map((assignment) => assignment.sessionId));
  return sessions.filter((session) => !scheduled.has(session.id));
}

export async function solveSchedule(
  problem: SchedulingProblem,
  options: SolverOptions = {},
): Promise<SolverResult> {
  const started = Date.now();
  const timeBudgetMs = options.timeBudgetMs ?? 3_000;
  const sessions = expandSessions(problem);
  const model = new CpModel();
  model.name = `school-${problem.schoolId}-${problem.academicYearId}`;
  const { placements, bySession } = buildPlacements(model, problem, sessions);
  const emptyDomain = sessions.find((session) => !(bySession.get(session.id)?.length));
  if (emptyDomain) {
    return {
      status: "NO_SOLUTION",
      candidates: [],
      exploredNodes: 0,
      elapsedMs: Date.now() - started,
      budgetExhausted: false,
      issues: [{ code: "EMPTY_DOMAIN", severity: "ERROR", message: `برای جلسه «${emptyDomain.subjectName}» کلاس «${emptyDomain.className}» هیچ زمان و دبیر مجازی وجود ندارد.` }],
    };
  }
  addHardConstraints(model, problem, sessions, placements, bySession);
  const maxCandidates = Math.max(1, options.maxCandidates ?? 3);
  const candidates: ScheduleCandidate[] = [];
  const signatures = new Set<string>();
  let branches = 0;
  let lastStatus = CpSolverStatus.UNKNOWN;
  while (candidates.length < maxCandidates) {
    const remainingMs = timeBudgetMs - (Date.now() - started);
    if (remainingMs <= 0) break;
    const solver = new CpSolver();
    solver.parameters.maxTimeInSeconds = remainingMs / 1_000;
    solver.parameters.numSearchWorkers = 8;
    solver.parameters.interleaveSearch = true;
    solver.parameters.randomSeed = 1;
    lastStatus = await solver.solve(model);
    branches += solver.numBranches;
    if (lastStatus !== CpSolverStatus.OPTIMAL && lastStatus !== CpSolverStatus.FEASIBLE) break;
    const assignments = assignmentsFromSolution(solver, placements);
    const validationErrors = validateSchedule(problem, assignments).filter((issue) => issue.severity === "ERROR");
    if (validationErrors.length) {
      return {
        status: "NO_SOLUTION",
        candidates: [],
        exploredNodes: branches,
        elapsedMs: Date.now() - started,
        budgetExhausted: false,
        issues: validationErrors,
      };
    }
    const candidateSignature = signature(assignments);
    if (!signatures.has(candidateSignature)) {
      signatures.add(candidateSignature);
      const scoring = scoreSchedule(problem, assignments);
      candidates.push({
        rank: 0,
        score: scoring.score,
        penalty: scoring.penalty,
        penaltyBreakdown: scoring.breakdown,
        assignments,
        signature: candidateSignature,
      });
    }
    const selected = placements.filter((placement) => solver.booleanValue(placement.variable));
    model.addBoolOr(selected.map((placement) => placement.variable.not()));
  }

  let missingSessions: SessionRequirement[] = [];
  if (!candidates.length && lastStatus === CpSolverStatus.INFEASIBLE) {
    missingSessions = await diagnoseMaximumFeasible(problem, sessions, Math.max(2_000, timeBudgetMs));
  }

  candidates.sort((a, b) => a.penalty - b.penalty || a.signature.localeCompare(b.signature));
  candidates.forEach((candidate, index) => { candidate.rank = index + 1; });
  const budgetExhausted = !candidates.length && lastStatus === CpSolverStatus.UNKNOWN;
  return {
    status: candidates.length ? "SUCCEEDED" : "NO_SOLUTION",
    candidates,
    exploredNodes: branches,
    elapsedMs: Date.now() - started,
    budgetExhausted,
    issues: candidates.length
      ? []
      : [{
          code: budgetExhausted ? "SEARCH_BUDGET" : "NO_SOLUTION",
          severity: "ERROR",
          message: budgetExhausted
            ? "جست‌وجوی برنامه در مهلت تعیین‌شده کامل نشد؛ این نتیجه به معنی ناممکن‌بودن برنامه نیست."
            : missingSessions.length
              ? `با داده فعلی دست‌کم ${missingSessions.reduce((sum, session) => sum + session.workloadHours, 0).toLocaleString("fa-IR")} ساعت قابل جای‌گذاری نیست: ${missingSessions.slice(0, 5).map((session) => `${session.subjectName} / ${session.className}`).join("، ")}`
              : "با ساعات، حضور و محدودیت‌های فعلی برنامه معتبر وجود ندارد.",
        }],
  };
}
