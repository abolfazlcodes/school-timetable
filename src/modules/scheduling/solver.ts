import {
  BoolVar,
  CpModel,
  CpSolver,
  CpSolverStatus,
  DomainReductionStrategy,
  LinearExpr,
  VariableSelectionStrategy,
} from "@ortools-node/cp-sat";
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

const ENGINE_VERSION = "cp-sat-2.3";
export { ENGINE_VERSION };

// OR-Tools SatParameters.SearchBranching.HINT_SEARCH. The package exposes the
// typed parameter but not the generated enum from its public entry point.
const HINT_SEARCH = 6 as const;

interface Placement {
  variable: BoolVar;
  session: SessionRequirement;
  assignment: ScheduleAssignment;
  workloadHours: number;
  basePenalty: number;
}

interface PlacementLock {
  teacherId: string;
  dayId: string;
  instructionalUnits: number;
  weekPattern: NonNullable<ScheduleAssignment["weekPattern"]>;
}

interface CoarsePlacement extends PlacementLock {
  variable: BoolVar;
  session: SessionRequirement;
}

interface CoarseTeacherChoice {
  variable: BoolVar;
  session: SessionRequirement;
  teacherId: string;
}

interface CoarseDayChoice extends CoarseTeacherChoice {
  dayId: string;
}

interface TeacherDayHint {
  teacherId: string;
  dayId: string;
}

interface TeacherHintResult {
  status: CpSolverStatus;
  hints: Map<string, string>;
  exploredNodes: number;
}

interface TeacherDayHintResult {
  status: CpSolverStatus;
  hints: Map<string, TeacherDayHint>;
  exploredNodes: number;
}

interface DecompositionResult {
  status: CpSolverStatus;
  locks: Map<string, PlacementLock>;
  exploredNodes: number;
}

interface ExactSolveResult {
  status: CpSolverStatus;
  candidates: ScheduleCandidate[];
  exploredNodes: number;
  validationErrors: ReturnType<typeof validateSchedule>;
  emptyDomain?: SessionRequirement;
}

const DECOMPOSITION_SESSION_THRESHOLD = 80;

function pushGrouped<K, T>(groups: Map<K, T[]>, key: K, value: T) {
  groups.set(key, [...(groups.get(key) ?? []), value]);
}

function isAllowedAvailability(status: unknown) {
  return status === "AVAILABLE" || status === "PREFERRED";
}

function sessionCapacityForPeriods(
  periods: SchedulingProblem["periods"],
  workloadHours: number,
) {
  return periods.reduce(
    (sum, period) =>
      sum +
      compatibleWeekPatterns(workloadHours, period.instructionalUnits).length,
    0,
  );
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
  locks?: Map<string, PlacementLock>,
) {
  const placements: Placement[] = [];
  const bySession = new Map<string, Placement[]>();
  const teachers = [...problem.teachers].sort((a, b) => a.id.localeCompare(b.id));
  const periods = [...problem.periods].sort((a, b) => a.dayOrder - b.dayOrder || a.position - b.position || a.id.localeCompare(b.id));
  let index = 0;
  for (const session of sessions) {
    const domain: Placement[] = [];
    const lock = locks?.get(session.id);
    for (const teacher of teachers) {
      if (assignedHoursFor(teacher, session.subjectId) <= 0) continue;
      if (session.assignedTeacherId && teacher.id !== session.assignedTeacherId) continue;
      if (lock && teacher.id !== lock.teacherId) continue;
      for (const period of periods) {
        if (lock && (period.dayId !== lock.dayId || period.instructionalUnits !== lock.instructionalUnits)) continue;
        const availability = teacher.availability[period.id];
        if (!isAllowedAvailability(availability)) continue;
        for (const weekPattern of compatibleWeekPatterns(session.workloadHours, period.instructionalUnits)) {
          if (lock && weekPattern !== lock.weekPattern) continue;
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

function exactSubjectIds(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
) {
  const demandBySubject = new Map<string, number>();
  for (const session of sessions) {
    demandBySubject.set(
      session.subjectId,
      (demandBySubject.get(session.subjectId) ?? 0) + session.workloadHours,
    );
  }
  return new Set(
    [...demandBySubject]
      .filter(
        ([subjectId, demand]) =>
          problem.teachers.reduce(
            (sum, teacher) => sum + assignedHoursFor(teacher, subjectId),
            0,
          ) === demand,
      )
      .map(([subjectId]) => subjectId),
  );
}

function comparePersianText(left: string, right: string) {
  return left.localeCompare(right, "fa");
}

function orderedTeachersForSearch(problem: SchedulingProblem) {
  const availableCapacity = (teacher: SchedulingProblem["teachers"][number]) =>
    problem.periods.reduce(
      (sum, period) =>
        isAllowedAvailability(teacher.availability[period.id])
          ? sum + period.instructionalUnits
          : sum,
      0,
    );
  const assignedHours = (teacher: SchedulingProblem["teachers"][number]) =>
    teacher.subjectAssignments.reduce(
      (sum, assignment) => sum + assignment.assignedWeeklyHours,
      0,
    );

  return [...problem.teachers].sort(
    (left, right) =>
      availableCapacity(left) - assignedHours(left) -
        (availableCapacity(right) - assignedHours(right)) ||
      availableCapacity(left) - availableCapacity(right) ||
      left.subjectAssignments.length - right.subjectAssignments.length ||
      comparePersianText(left.name, right.name) ||
      left.id.localeCompare(right.id),
  );
}

function orderedSessionsForSearch(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
) {
  const teachers = orderedTeachersForSearch(problem);
  const classes = new Map(problem.classes.map((item) => [item.id, item]));
  const optionCount = (session: SessionRequirement) =>
    teachers.reduce((count, teacher) => {
      if (assignedHoursFor(teacher, session.subjectId) <= 0) return count;
      if (
        session.assignedTeacherId &&
        teacher.id !== session.assignedTeacherId
      ) {
        return count;
      }
      return (
        count +
        problem.periods.filter(
          (period) =>
            isAllowedAvailability(teacher.availability[period.id]) &&
            compatibleWeekPatterns(
              session.workloadHours,
              period.instructionalUnits,
            ).length > 0,
        ).length
      );
    }, 0);
  const eligibleTeacherCount = (session: SessionRequirement) =>
    teachers.filter(
      (teacher) =>
        assignedHoursFor(teacher, session.subjectId) > 0 &&
        (!session.assignedTeacherId ||
          teacher.id === session.assignedTeacherId),
    ).length;

  return [...sessions].sort((left, right) => {
    const leftClass = classes.get(left.classId);
    const rightClass = classes.get(right.classId);
    return (
      optionCount(left) - optionCount(right) ||
      eligibleTeacherCount(left) - eligibleTeacherCount(right) ||
      right.workloadHours - left.workloadHours ||
      (leftClass?.gradeOrder ?? Number.MAX_SAFE_INTEGER) -
        (rightClass?.gradeOrder ?? Number.MAX_SAFE_INTEGER) ||
      (leftClass?.gradeCode ?? leftClass?.gradeName ?? "").localeCompare(
        rightClass?.gradeCode ?? rightClass?.gradeName ?? "",
      ) ||
      (leftClass?.majorCode ?? leftClass?.majorName ?? "").localeCompare(
        rightClass?.majorCode ?? rightClass?.majorName ?? "",
      ) ||
      comparePersianText(left.className, right.className) ||
      comparePersianText(left.subjectName, right.subjectName) ||
      left.ordinal - right.ordinal ||
      left.id.localeCompare(right.id)
    );
  });
}

async function solveTeacherHints(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  timeBudgetMs: number,
): Promise<TeacherHintResult> {
  const model = new CpModel();
  model.name = `teacher-hints-${problem.schoolId}-${problem.academicYearId}`;
  const teachers = orderedTeachersForSearch(problem);
  const orderedSessions = orderedSessionsForSearch(problem, sessions);
  const choices: CoarseTeacherChoice[] = [];
  const byTeacher = new Map<string, CoarseTeacherChoice[]>();
  const byTeacherSubject = new Map<string, CoarseTeacherChoice[]>();

  for (const session of orderedSessions) {
    const domain: CoarseTeacherChoice[] = [];
    for (const teacher of teachers) {
      if (assignedHoursFor(teacher, session.subjectId) <= 0) continue;
      if (
        session.assignedTeacherId &&
        teacher.id !== session.assignedTeacherId
      ) {
        continue;
      }
      const choice: CoarseTeacherChoice = {
        variable: model.newBoolVar(`teacher-${choices.length}`),
        session,
        teacherId: teacher.id,
      };
      choices.push(choice);
      domain.push(choice);
      pushGrouped(byTeacher, teacher.id, choice);
      pushGrouped(
        byTeacherSubject,
        `${teacher.id}\u0000${session.subjectId}`,
        choice,
      );
    }
    if (!domain.length) {
      return {
        status: CpSolverStatus.INFEASIBLE,
        hints: new Map(),
        exploredNodes: 0,
      };
    }
    model.addExactlyOne(domain.map((choice) => choice.variable));
  }

  const exactSubjects = exactSubjectIds(problem, sessions);
  const workloadSizes = [...new Set(sessions.map((session) => session.workloadHours))];
  for (const teacher of teachers) {
    const teacherChoices = byTeacher.get(teacher.id) ?? [];
    const availablePeriods = problem.periods.filter((period) =>
      isAllowedAvailability(teacher.availability[period.id]),
    );
    model.addLessOrEqual(
      LinearExpr.weightedSum(
        teacherChoices.map((choice) => choice.variable),
        teacherChoices.map((choice) => choice.session.workloadHours),
      ),
      Math.min(
        teacher.maximumWorkload + teacher.overtimeAllowance,
        availablePeriods.reduce(
          (sum, period) => sum + period.instructionalUnits,
          0,
        ),
      ),
    );
    for (const workloadHours of workloadSizes) {
      model.addLessOrEqual(
        LinearExpr.sum(
          teacherChoices
            .filter(
              (choice) => choice.session.workloadHours === workloadHours,
            )
            .map((choice) => choice.variable),
        ),
        sessionCapacityForPeriods(availablePeriods, workloadHours),
      );
    }
    for (const assignment of teacher.subjectAssignments) {
      const subjectChoices =
        byTeacherSubject.get(
          `${teacher.id}\u0000${assignment.subjectId}`,
        ) ?? [];
      const expression = LinearExpr.weightedSum(
        subjectChoices.map((choice) => choice.variable),
        subjectChoices.map((choice) => choice.session.workloadHours),
      );
      if (exactSubjects.has(assignment.subjectId)) {
        model.addEquality(expression, assignment.assignedWeeklyHours);
      } else {
        model.addLessOrEqual(expression, assignment.assignedWeeklyHours);
      }
    }
  }

  model.addDecisionStrategy(
    choices.map((choice) => choice.variable),
    VariableSelectionStrategy.CHOOSE_FIRST,
    DomainReductionStrategy.SELECT_MAX_VALUE,
  );
  const solver = new CpSolver();
  solver.parameters.maxTimeInSeconds = Math.max(1, timeBudgetMs) / 1_000;
  solver.parameters.numSearchWorkers = 1;
  solver.parameters.randomSeed = 1;
  const status = await solver.solve(model);
  if (status !== CpSolverStatus.OPTIMAL && status !== CpSolverStatus.FEASIBLE) {
    return { status, hints: new Map(), exploredNodes: solver.numBranches };
  }
  return {
    status,
    hints: new Map(
      choices
        .filter((choice) => solver.booleanValue(choice.variable))
        .map((choice) => [choice.session.id, choice.teacherId]),
    ),
    exploredNodes: solver.numBranches,
  };
}

/**
 * Builds a small relaxation that decides only teacher and day. Its solution is
 * a warm-start suggestion for the authoritative decomposition model, never a
 * lock: CP-SAT may repair or ignore every hinted value.
 */
async function solveTeacherDayHints(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  timeBudgetMs: number,
  teacherHints?: Map<string, string>,
): Promise<TeacherDayHintResult> {
  const model = new CpModel();
  model.name = `teacher-day-hints-${problem.schoolId}-${problem.academicYearId}`;
  const teachers = orderedTeachersForSearch(problem);
  const orderedSessions = orderedSessionsForSearch(problem, sessions);
  const days = [
    ...new Map(
      [...problem.periods]
        .sort(
          (left, right) =>
            left.dayOrder - right.dayOrder ||
            left.dayId.localeCompare(right.dayId),
        )
        .map((period) => [period.dayId, period.dayOrder]),
    ).keys(),
  ];
  const choices: CoarseDayChoice[] = [];
  const byTeacher = new Map<string, CoarseDayChoice[]>();
  const byTeacherSubject = new Map<string, CoarseDayChoice[]>();
  const byTeacherDay = new Map<string, CoarseDayChoice[]>();
  const byClassDay = new Map<string, CoarseDayChoice[]>();

  for (const session of orderedSessions) {
    const domain: CoarseDayChoice[] = [];
    for (const teacher of teachers) {
      const teacherHint = teacherHints?.get(session.id);
      if (teacherHint && teacher.id !== teacherHint) continue;
      if (assignedHoursFor(teacher, session.subjectId) <= 0) continue;
      if (
        session.assignedTeacherId &&
        teacher.id !== session.assignedTeacherId
      ) {
        continue;
      }
      for (const dayId of days) {
        const compatiblePeriods = problem.periods.filter(
          (period) =>
            period.dayId === dayId &&
            isAllowedAvailability(teacher.availability[period.id]) &&
            compatibleWeekPatterns(
              session.workloadHours,
              period.instructionalUnits,
            ).length > 0,
        );
        if (!compatiblePeriods.length) continue;
        const choice: CoarseDayChoice = {
          variable: model.newBoolVar(`teacher-day-${choices.length}`),
          session,
          teacherId: teacher.id,
          dayId,
        };
        choices.push(choice);
        domain.push(choice);
        pushGrouped(byTeacher, teacher.id, choice);
        pushGrouped(
          byTeacherSubject,
          `${teacher.id}\u0000${session.subjectId}`,
          choice,
        );
        pushGrouped(byTeacherDay, `${teacher.id}\u0000${dayId}`, choice);
        pushGrouped(byClassDay, `${session.classId}\u0000${dayId}`, choice);
      }
    }
    if (!domain.length) {
      return {
        status: CpSolverStatus.INFEASIBLE,
        hints: new Map(),
        exploredNodes: 0,
      };
    }
    model.addExactlyOne(domain.map((choice) => choice.variable));
  }

  const exactSubjects = exactSubjectIds(problem, sessions);
  const workloadSizes = [...new Set(sessions.map((session) => session.workloadHours))];
  for (const teacher of teachers) {
    const teacherChoices = byTeacher.get(teacher.id) ?? [];
    model.addLessOrEqual(
      LinearExpr.weightedSum(
        teacherChoices.map((choice) => choice.variable),
        teacherChoices.map((choice) => choice.session.workloadHours),
      ),
      teacher.maximumWorkload + teacher.overtimeAllowance,
    );
    for (const assignment of teacher.subjectAssignments) {
      const subjectChoices =
        byTeacherSubject.get(
          `${teacher.id}\u0000${assignment.subjectId}`,
        ) ?? [];
      const expression = LinearExpr.weightedSum(
        subjectChoices.map((choice) => choice.variable),
        subjectChoices.map((choice) => choice.session.workloadHours),
      );
      if (exactSubjects.has(assignment.subjectId)) {
        model.addEquality(expression, assignment.assignedWeeklyHours);
      } else {
        model.addLessOrEqual(expression, assignment.assignedWeeklyHours);
      }
    }
    for (const dayId of days) {
      const dayChoices = byTeacherDay.get(`${teacher.id}\u0000${dayId}`) ?? [];
      const availablePeriods = problem.periods.filter(
        (period) =>
          period.dayId === dayId &&
          isAllowedAvailability(teacher.availability[period.id]),
      );
      model.addLessOrEqual(
        LinearExpr.weightedSum(
          dayChoices.map((choice) => choice.variable),
          dayChoices.map((choice) => choice.session.workloadHours),
        ),
        availablePeriods.reduce(
          (sum, period) => sum + period.instructionalUnits,
          0,
        ),
      );
      for (const workloadHours of workloadSizes) {
        model.addLessOrEqual(
          LinearExpr.sum(
            dayChoices
              .filter(
                (choice) => choice.session.workloadHours === workloadHours,
              )
              .map((choice) => choice.variable),
          ),
          sessionCapacityForPeriods(availablePeriods, workloadHours),
        );
      }
    }
  }

  for (const schoolClass of problem.classes) {
    for (const dayId of days) {
      const dayChoices = byClassDay.get(`${schoolClass.id}\u0000${dayId}`) ?? [];
      const periods = problem.periods.filter(
        (period) => period.dayId === dayId,
      );
      model.addLessOrEqual(
        LinearExpr.weightedSum(
          dayChoices.map((choice) => choice.variable),
          dayChoices.map((choice) => choice.session.workloadHours),
        ),
        periods.reduce(
          (sum, period) => sum + period.instructionalUnits,
          0,
        ),
      );
      for (const workloadHours of workloadSizes) {
        model.addLessOrEqual(
          LinearExpr.sum(
            dayChoices
              .filter(
                (choice) => choice.session.workloadHours === workloadHours,
              )
              .map((choice) => choice.variable),
          ),
          sessionCapacityForPeriods(periods, workloadHours),
        );
      }
    }
  }

  model.addDecisionStrategy(
    choices.map((choice) => choice.variable),
    VariableSelectionStrategy.CHOOSE_FIRST,
    DomainReductionStrategy.SELECT_MAX_VALUE,
  );
  const solver = new CpSolver();
  solver.parameters.maxTimeInSeconds = Math.max(1, timeBudgetMs) / 1_000;
  solver.parameters.numSearchWorkers = 1;
  solver.parameters.randomSeed = 1;
  const status = await solver.solve(model);
  if (status !== CpSolverStatus.OPTIMAL && status !== CpSolverStatus.FEASIBLE) {
    return { status, hints: new Map(), exploredNodes: solver.numBranches };
  }
  return {
    status,
    hints: new Map(
      choices
        .filter((choice) => solver.booleanValue(choice.variable))
        .map((choice) => [
          choice.session.id,
          { teacherId: choice.teacherId, dayId: choice.dayId },
        ]),
    ),
    exploredNodes: solver.numBranches,
  };
}

/**
 * Reduces a large timetable to the decisions that create most of the search
 * symmetry: teacher, day, period capacity and cycle week. The exact period is
 * deliberately left to the normal solver, which remains the source of truth.
 */
async function solveDecomposition(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  timeBudgetMs: number,
  hints?: Map<string, TeacherDayHint>,
  teacherLocks?: Map<string, string>,
  teacherDayLocks?: Map<string, TeacherDayHint>,
): Promise<DecompositionResult> {
  const model = new CpModel();
  model.name = `decomposition-${problem.schoolId}-${problem.academicYearId}`;
  const teachers = orderedTeachersForSearch(problem);
  const orderedSessions = orderedSessionsForSearch(problem, sessions);
  const periods = [...problem.periods].sort(
    (a, b) =>
      a.dayOrder - b.dayOrder ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  );
  const choices: CoarsePlacement[] = [];
  const dayChoices: CoarseDayChoice[] = [];
  const teacherAssignments: CoarseTeacherChoice[] = [];
  let variableIndex = 0;

  for (const session of orderedSessions) {
    const seen = new Set<string>();
    const domain: CoarsePlacement[] = [];
    const teacherLock = teacherLocks?.get(session.id);
    const teacherDayLock = teacherDayLocks?.get(session.id);
    for (const teacher of teachers) {
      if (assignedHoursFor(teacher, session.subjectId) <= 0) continue;
      if (session.assignedTeacherId && teacher.id !== session.assignedTeacherId) {
        continue;
      }
      if (teacherLock && teacher.id !== teacherLock) continue;
      if (teacherDayLock && teacher.id !== teacherDayLock.teacherId) continue;
      const teacherDomain: CoarsePlacement[] = [];
      for (const period of periods) {
        if (teacherDayLock && period.dayId !== teacherDayLock.dayId) continue;
        if (!isAllowedAvailability(teacher.availability[period.id])) continue;
        for (const weekPattern of compatibleWeekPatterns(
          session.workloadHours,
          period.instructionalUnits,
        )) {
          const key = `${teacher.id}\u0000${period.dayId}\u0000${period.instructionalUnits}\u0000${weekPattern}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const choice: CoarsePlacement = {
            variable: model.newBoolVar(`d${variableIndex++}`),
            session,
            teacherId: teacher.id,
            dayId: period.dayId,
            instructionalUnits: period.instructionalUnits,
            weekPattern,
          };
          choices.push(choice);
          domain.push(choice);
          teacherDomain.push(choice);
        }
      }
      if (teacherDomain.length) {
        const placementsByDay = new Map<string, CoarsePlacement[]>();
        for (const placement of teacherDomain) {
          pushGrouped(placementsByDay, placement.dayId, placement);
        }
        const teacherDayVariables: BoolVar[] = [];
        for (const [dayId, placements] of placementsByDay) {
          const dayChoice: CoarseDayChoice = {
            variable: model.newBoolVar(`coarse-day-${dayChoices.length}`),
            session,
            teacherId: teacher.id,
            dayId,
          };
          model.addEquality(
            LinearExpr.sum(placements.map((placement) => placement.variable)),
            dayChoice.variable,
          );
          dayChoices.push(dayChoice);
          teacherDayVariables.push(dayChoice.variable);
        }
        const teacherChoice: CoarseTeacherChoice = {
          variable: model.newBoolVar(
            `coarse-teacher-${teacherAssignments.length}`,
          ),
          session,
          teacherId: teacher.id,
        };
        model.addEquality(
          LinearExpr.sum(teacherDayVariables),
          teacherChoice.variable,
        );
        teacherAssignments.push(teacherChoice);
      }
    }
    if (!domain.length) {
      return {
        status: CpSolverStatus.INFEASIBLE,
        locks: new Map(),
        exploredNodes: 0,
      };
    }
    model.addExactlyOne(domain.map((choice) => choice.variable));
  }

  // Explicit hierarchy variables let CP-SAT settle the high-impact teacher
  // and day decisions before branching over equivalent period-capacity modes.
  // They are created alongside each session domain to keep deterministic
  // variable ordering. Linked equalities do not add or remove any solution.

  const classModes = new Map<string, CoarsePlacement[]>();
  const teacherModes = new Map<string, CoarsePlacement[]>();
  const teacherDays = new Map<string, CoarsePlacement[]>();
  const teacherSubjects = new Map<string, CoarseTeacherChoice[]>();
  const teacherChoices = new Map<string, CoarseTeacherChoice[]>();
  for (const choice of choices) {
    for (const week of activeCycleWeeks(choice.weekPattern)) {
      pushGrouped(
        classModes,
        `${choice.session.classId}\u0000${choice.dayId}\u0000${choice.instructionalUnits}\u0000${week}`,
        choice,
      );
      pushGrouped(
        teacherModes,
        `${choice.teacherId}\u0000${choice.dayId}\u0000${choice.instructionalUnits}\u0000${week}`,
        choice,
      );
      pushGrouped(
        teacherDays,
        `${choice.teacherId}\u0000${choice.dayId}\u0000${week}`,
        choice,
      );
    }
  }
  for (const choice of teacherAssignments) {
    pushGrouped(
      teacherSubjects,
      `${choice.teacherId}\u0000${choice.session.subjectId}`,
      choice,
    );
    pushGrouped(teacherChoices, choice.teacherId, choice);
  }

  for (const [key, groupedChoices] of classModes) {
    const [, dayId, unitsText] = key.split("\u0000");
    const instructionalUnits = Number(unitsText);
    const capacity = periods.filter(
      (period) =>
        period.dayId === dayId &&
        period.instructionalUnits === instructionalUnits,
    ).length;
    model.addLessOrEqual(
      LinearExpr.sum(groupedChoices.map((choice) => choice.variable)),
      capacity,
    );
  }

  for (const [key, groupedChoices] of teacherModes) {
    const [teacherId, dayId, unitsText] = key.split("\u0000");
    const instructionalUnits = Number(unitsText);
    const teacher = teachers.find((item) => item.id === teacherId)!;
    const capacity = periods.filter(
      (period) =>
        period.dayId === dayId &&
        period.instructionalUnits === instructionalUnits &&
        isAllowedAvailability(teacher.availability[period.id]),
    ).length;
    model.addLessOrEqual(
      LinearExpr.sum(groupedChoices.map((choice) => choice.variable)),
      capacity,
    );
  }

  for (const [key, groupedChoices] of teacherDays) {
    const [teacherId] = key.split("\u0000");
    const teacher = teachers.find((item) => item.id === teacherId)!;
    model.addLessOrEqual(
      LinearExpr.sum(groupedChoices.map((choice) => choice.variable)),
      teacher.dailyMaximum,
    );
  }

  const exactSubjects = exactSubjectIds(problem, sessions);
  for (const teacher of teachers) {
    const allTeacherChoices = teacherChoices.get(teacher.id) ?? [];
    model.addLessOrEqual(
      LinearExpr.weightedSum(
        allTeacherChoices.map((choice) => choice.variable),
        allTeacherChoices.map((choice) => choice.session.workloadHours),
      ),
      teacher.maximumWorkload + teacher.overtimeAllowance,
    );
    for (const subject of teacher.subjectAssignments) {
      const subjectChoices =
        teacherSubjects.get(`${teacher.id}\u0000${subject.subjectId}`) ?? [];
      if (exactSubjects.has(subject.subjectId)) {
        model.addEquality(
          LinearExpr.weightedSum(
            subjectChoices.map((choice) => choice.variable),
            subjectChoices.map((choice) => choice.session.workloadHours),
          ),
          subject.assignedWeeklyHours,
        );
      } else {
        model.addLessOrEqual(
          LinearExpr.weightedSum(
            subjectChoices.map((choice) => choice.variable),
            subjectChoices.map((choice) => choice.session.workloadHours),
          ),
          subject.assignedWeeklyHours,
        );
      }
    }
  }

  if (!teacherLocks) {
    model.addDecisionStrategy(
      teacherAssignments.map((choice) => choice.variable),
      VariableSelectionStrategy.CHOOSE_FIRST,
      DomainReductionStrategy.SELECT_MAX_VALUE,
    );
    model.addDecisionStrategy(
      dayChoices.map((choice) => choice.variable),
      VariableSelectionStrategy.CHOOSE_FIRST,
      DomainReductionStrategy.SELECT_MAX_VALUE,
    );
    model.addDecisionStrategy(
      choices.map((choice) => choice.variable),
      VariableSelectionStrategy.CHOOSE_FIRST,
      DomainReductionStrategy.SELECT_MAX_VALUE,
    );
  }

  if (hints?.size) {
    for (const choice of teacherAssignments) {
      model.addHint(
        choice.variable,
        hints.get(choice.session.id)?.teacherId === choice.teacherId,
      );
    }
    for (const choice of dayChoices) {
      const hint = hints.get(choice.session.id);
      model.addHint(
        choice.variable,
        hint?.teacherId === choice.teacherId && hint.dayId === choice.dayId,
      );
    }
  }

  const solver = new CpSolver();
  solver.parameters.maxTimeInSeconds = Math.max(1, timeBudgetMs) / 1_000;
  // One worker avoids oversubscribing serverless runtimes with a single vCPU.
  // The decomposition already receives a complete teacher/day warm start in
  // normal large-school runs, so hint search reaches a stable coarse plan much
  // faster than the generic portfolio on that hardware.
  solver.parameters.numSearchWorkers = 1;
  if (hints?.size) solver.parameters.searchBranching = HINT_SEARCH;
  solver.parameters.randomSeed = 1;
  const status = await solver.solve(model);
  if (status !== CpSolverStatus.OPTIMAL && status !== CpSolverStatus.FEASIBLE) {
    return { status, locks: new Map(), exploredNodes: solver.numBranches };
  }
  const selectedLocks = new Map<string, PlacementLock>(
    choices
      .filter((choice) => solver.booleanValue(choice.variable))
      .map((choice) => [
        choice.session.id,
        {
          teacherId: choice.teacherId,
          dayId: choice.dayId,
          instructionalUnits: choice.instructionalUnits,
          weekPattern: choice.weekPattern,
        },
      ]),
  );
  return {
    status,
    locks: selectedLocks,
    exploredNodes: solver.numBranches,
  };
}

function addHardConstraints(
  model: CpModel,
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  placements: Placement[],
  bySession: Map<string, Placement[]>,
  requireAll = true,
  symmetryLocks?: Map<string, PlacementLock>,
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

  const exactSubjects = exactSubjectIds(problem, sessions);

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
      const positions = [...new Set(dayPlacements.map((placement) => placement.assignment.startPosition))].sort((a, b) => a - b);
      if (teacher.maxConsecutive >= positions.length) continue;
      for (const startPosition of positions) {
        const window = Array.from({ length: teacher.maxConsecutive + 1 }, (_, offset) => startPosition + offset);
        if (!window.every((position) => positions.includes(position))) continue;
        const inWindow = dayPlacements.filter((placement) => window.includes(placement.assignment.startPosition));
        model.addLessOrEqual(LinearExpr.sum(inWindow.map((placement) => placement.variable)), teacher.maxConsecutive);
      }
    }
  }
  if (!requireAll) return;
  const periodRank = new Map(
    [...problem.periods]
      .sort(
        (left, right) =>
          left.dayOrder - right.dayOrder ||
          left.dayId.localeCompare(right.dayId) ||
          left.position - right.position ||
          left.id.localeCompare(right.id),
      )
      .map((period, index) => [period.id, index]),
  );
  const sessionsByCurriculum = new Map<string, SessionRequirement[]>();
  for (const session of sessions) sessionsByCurriculum.set(session.curriculumId, [...(sessionsByCurriculum.get(session.curriculumId) ?? []), session]);
  for (const curriculumSessions of sessionsByCurriculum.values()) {
    const interchangeableSessions = new Map<string, SessionRequirement[]>();
    for (const session of curriculumSessions) {
      const lock = symmetryLocks?.get(session.id);
      const key = lock
        ? `${session.workloadHours}\u0000${lock.teacherId}\u0000${lock.dayId}\u0000${lock.instructionalUnits}\u0000${lock.weekPattern}`
        : `${session.workloadHours}`;
      pushGrouped(interchangeableSessions, key, session);
    }
    for (const workloadSessions of interchangeableSessions.values()) {
      const ordered = [...workloadSessions].sort(
        (left, right) => left.ordinal - right.ordinal,
      );
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        const previousDomain = bySession.get(previous.id) ?? [];
        const currentDomain = bySession.get(current.id) ?? [];
        const rank = (placement: Placement) => {
          const weekOffset =
            placement.assignment.weekPattern === "WEEK_A"
              ? 0
              : placement.assignment.weekPattern === "WEEK_B"
                ? 1
                : 0;
          return (
            (periodRank.get(placement.assignment.periodIds[0]) ?? 0) * 2 +
            weekOffset
          );
        };
        model.addLessThan(
          LinearExpr.weightedSum(
            previousDomain.map((placement) => placement.variable),
            previousDomain.map(rank),
          ),
          LinearExpr.weightedSum(
            currentDomain.map((placement) => placement.variable),
            currentDomain.map(rank),
          ),
        );
      }
    }
  }
}

function assignmentsFromSolution(solver: CpSolver, placements: Placement[]) {
  return placements
    .filter((placement) => solver.booleanValue(placement.variable))
    .map((placement) => placement.assignment)
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

function findSessionWithoutDomain(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
) {
  return sessions.find((session) =>
    !problem.teachers.some((teacher) => {
      if (assignedHoursFor(teacher, session.subjectId) <= 0) return false;
      if (session.assignedTeacherId && teacher.id !== session.assignedTeacherId) {
        return false;
      }
      return problem.periods.some(
        (period) =>
          isAllowedAvailability(teacher.availability[period.id]) &&
          compatibleWeekPatterns(
            session.workloadHours,
            period.instructionalUnits,
          ).length > 0,
      );
    }),
  );
}

async function solveExact(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  maxCandidates: number,
  deadline: number,
  locks?: Map<string, PlacementLock>,
): Promise<ExactSolveResult> {
  const model = new CpModel();
  model.name = `school-${problem.schoolId}-${problem.academicYearId}`;
  const { placements, bySession } = buildPlacements(
    model,
    problem,
    sessions,
    locks,
  );
  const emptyDomain = sessions.find(
    (session) => !(bySession.get(session.id)?.length),
  );
  if (emptyDomain) {
    return {
      status: CpSolverStatus.INFEASIBLE,
      candidates: [],
      exploredNodes: 0,
      validationErrors: [],
      emptyDomain,
    };
  }
  // Equal sessions can be ordered only when their coarse locks are identical.
  // Different teacher/day/mode locks are already distinct and ordering them
  // could remove an otherwise valid timetable.
  addHardConstraints(model, problem, sessions, placements, bySession, true, locks);
  model.addDecisionStrategy(
    orderedSessionsForSearch(problem, sessions).flatMap((session) =>
      (bySession.get(session.id) ?? []).map((placement) => placement.variable),
    ),
    VariableSelectionStrategy.CHOOSE_FIRST,
    DomainReductionStrategy.SELECT_MAX_VALUE,
  );

  const candidates: ScheduleCandidate[] = [];
  const signatures = new Set<string>();
  let exploredNodes = 0;
  let status = CpSolverStatus.UNKNOWN;
  while (candidates.length < maxCandidates) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      status = CpSolverStatus.UNKNOWN;
      break;
    }
    const solver = new CpSolver();
    solver.parameters.maxTimeInSeconds = remainingMs / 1_000;
    solver.parameters.numSearchWorkers = 1;
    solver.parameters.randomSeed = 1;
    status = await solver.solve(model);
    exploredNodes += solver.numBranches;
    if (status !== CpSolverStatus.OPTIMAL && status !== CpSolverStatus.FEASIBLE) {
      break;
    }
    const assignments = assignmentsFromSolution(solver, placements);
    const validationErrors = validateSchedule(problem, assignments).filter(
      (issue) => issue.severity === "ERROR",
    );
    if (validationErrors.length) {
      return {
        status: CpSolverStatus.INFEASIBLE,
        candidates: [],
        exploredNodes,
        validationErrors,
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
    const selected = placements.filter((placement) =>
      solver.booleanValue(placement.variable),
    );
    model.addBoolOr(
      selected.map((placement) => placement.variable.not()),
    );
  }
  return {
    status,
    candidates,
    exploredNodes,
    validationErrors: [],
  };
}

interface MaximumFeasibleDiagnosis {
  status: CpSolverStatus;
  missingSessions: SessionRequirement[];
}

async function diagnoseMaximumFeasible(
  problem: SchedulingProblem,
  sessions: SessionRequirement[],
  timeBudgetMs: number,
): Promise<MaximumFeasibleDiagnosis> {
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
  solver.parameters.maxTimeInSeconds = Math.max(0.01, timeBudgetMs / 1_000);
  // Keep the diagnostic path inside the same single-vCPU budget as the main
  // solve. Oversubscribing here makes an already unsuccessful run more likely
  // to end as a serverless timeout before its actionable diagnosis is saved.
  solver.parameters.numSearchWorkers = 1;
  solver.parameters.randomSeed = 1;
  const status = await solver.solve(model);
  if (status !== CpSolverStatus.OPTIMAL && status !== CpSolverStatus.FEASIBLE) {
    return { status, missingSessions: [] };
  }
  const scheduled = new Set(assignmentsFromSolution(solver, placements).map((assignment) => assignment.sessionId));
  return {
    status,
    missingSessions: sessions.filter((session) => !scheduled.has(session.id)),
  };
}

export async function solveSchedule(
  problem: SchedulingProblem,
  options: SolverOptions = {},
): Promise<SolverResult> {
  const started = Date.now();
  const timeBudgetMs = options.timeBudgetMs ?? 3_000;
  const deadline = started + timeBudgetMs;
  const sessions = expandSessions(problem);
  const maxCandidates = Math.max(1, options.maxCandidates ?? 3);
  const emptyDomain = findSessionWithoutDomain(problem, sessions);
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

  let exploredNodes = 0;
  let locks: Map<string, PlacementLock> | undefined;
  let lastStatus = CpSolverStatus.UNKNOWN;
  const shouldDecompose =
    sessions.length >= DECOMPOSITION_SESSION_THRESHOLD && timeBudgetMs >= 5_000;
  if (shouldDecompose) {
    const teacherHintBudgetMs = Math.min(
      2_000,
      Math.max(1_000, Math.floor((deadline - Date.now()) * 0.08)),
    );
    const teacherHintResult = await solveTeacherHints(
      problem,
      sessions,
      teacherHintBudgetMs,
    );
    exploredNodes += teacherHintResult.exploredNodes;
    lastStatus = teacherHintResult.status;

    const dayHintBudgetMs = Math.min(
      3_000,
      Math.max(1_000, Math.floor((deadline - Date.now()) * 0.12)),
    );
    const hintResult = await solveTeacherDayHints(
      problem,
      sessions,
      dayHintBudgetMs,
      teacherHintResult.hints.size === sessions.length
        ? teacherHintResult.hints
        : undefined,
    );
    exploredNodes += hintResult.exploredNodes;
    lastStatus = hintResult.status;

    if (teacherHintResult.hints.size === sessions.length) {
      const restrictedBudgetMs = Math.min(
        12_000,
        Math.max(1_000, Math.floor((deadline - Date.now()) * 0.45)),
      );
      const restricted = await solveDecomposition(
        problem,
        sessions,
        restrictedBudgetMs,
        hintResult.hints,
        teacherHintResult.hints,
      );
      exploredNodes += restricted.exploredNodes;
      lastStatus = restricted.status;
      if (
        restricted.status === CpSolverStatus.OPTIMAL ||
        restricted.status === CpSolverStatus.FEASIBLE
      ) {
        locks = restricted.locks;
      }
    }

    if (!locks) {
      const remainingMs = deadline - Date.now();
      const exactReserveMs = Math.max(
        1_000,
        Math.floor(remainingMs * 0.15),
      );
      const decompositionBudgetMs = Math.max(
        1,
        remainingMs - exactReserveMs,
      );
      const decomposition = await solveDecomposition(
        problem,
        sessions,
        decompositionBudgetMs,
        hintResult.hints,
      );
      exploredNodes += decomposition.exploredNodes;
      lastStatus = decomposition.status;
      if (
        decomposition.status === CpSolverStatus.OPTIMAL ||
        decomposition.status === CpSolverStatus.FEASIBLE
      ) {
        locks = decomposition.locks;
      }
    }
  }

  const exactRemainingMs = Math.max(0, deadline - Date.now());
  const unlockedFallbackReserveMs = locks
    ? Math.min(5_000, Math.floor(exactRemainingMs * 0.25))
    : 0;
  let exact = await solveExact(
    problem,
    sessions,
    maxCandidates,
    deadline - unlockedFallbackReserveMs,
    locks,
  );
  exploredNodes += exact.exploredNodes;
  lastStatus = exact.status;

  // A coarse choice is a necessary-capacity plan, not a proof that granular
  // period availability or consecutive-period limits can extend it. Retry the
  // authoritative model without locks whenever time remains.
  if (
    locks &&
    !exact.candidates.length &&
    !exact.validationErrors.length
  ) {
    if (deadline - Date.now() > 0) {
      exact = await solveExact(
        problem,
        sessions,
        maxCandidates,
        deadline,
      );
      exploredNodes += exact.exploredNodes;
      lastStatus = exact.status;
    } else {
      // Failure to extend one coarse solution is not a proof that the full
      // timetable is impossible.
      lastStatus = CpSolverStatus.UNKNOWN;
    }
  }

  if (exact.validationErrors.length) {
    return {
      status: "NO_SOLUTION",
      candidates: [],
      exploredNodes,
      elapsedMs: Date.now() - started,
      budgetExhausted: false,
      issues: exact.validationErrors,
    };
  }
  if (!locks && exact.emptyDomain) {
    return {
      status: "NO_SOLUTION",
      candidates: [],
      exploredNodes,
      elapsedMs: Date.now() - started,
      budgetExhausted: false,
      issues: [{
        code: "EMPTY_DOMAIN",
        severity: "ERROR",
        message: `برای جلسه «${exact.emptyDomain.subjectName}» کلاس «${exact.emptyDomain.className}» هیچ زمان و دبیر مجازی وجود ندارد.`,
      }],
    };
  }

  const candidates = exact.candidates;
  let diagnosis: MaximumFeasibleDiagnosis | undefined;
  const diagnosisBudgetMs = deadline - Date.now();
  if (
    !candidates.length &&
    lastStatus === CpSolverStatus.INFEASIBLE &&
    diagnosisBudgetMs >= 250
  ) {
    diagnosis = await diagnoseMaximumFeasible(
      problem,
      sessions,
      diagnosisBudgetMs,
    );
  }

  candidates.sort((a, b) => a.penalty - b.penalty || a.signature.localeCompare(b.signature));
  candidates.forEach((candidate, index) => { candidate.rank = index + 1; });
  const budgetExhausted = !candidates.length && lastStatus === CpSolverStatus.UNKNOWN;
  const missingSessions = diagnosis?.missingSessions ?? [];
  const missingHours = missingSessions.reduce(
    (sum, session) => sum + session.workloadHours,
    0,
  );
  const missingLabels = missingSessions
    .slice(0, 5)
    .map((session) => `${session.subjectName} / ${session.className}`)
    .join("، ");
  return {
    status: candidates.length ? "SUCCEEDED" : "NO_SOLUTION",
    candidates,
    exploredNodes,
    elapsedMs: Date.now() - started,
    budgetExhausted,
    issues: candidates.length
      ? []
      : [{
          code: budgetExhausted ? "SEARCH_BUDGET" : "NO_SOLUTION",
          severity: "ERROR",
          message: budgetExhausted
            ? "جست‌وجوی برنامه در مهلت تعیین‌شده کامل نشد؛ این نتیجه به معنی ناممکن‌بودن برنامه نیست."
            : missingSessions.length && diagnosis?.status === CpSolverStatus.OPTIMAL
              ? `با داده فعلی دست‌کم ${missingHours.toLocaleString("fa-IR")} ساعت قابل جای‌گذاری نیست: ${missingLabels}`
              : missingSessions.length && diagnosis?.status === CpSolverStatus.FEASIBLE
                ? `یک چیدمان ناقص نمونه ${missingHours.toLocaleString("fa-IR")} ساعت جای‌گذاری‌نشده دارد؛ ممکن است پاسخ بهتری وجود داشته باشد: ${missingLabels}`
              : "با ساعات، حضور و محدودیت‌های فعلی برنامه معتبر وجود ندارد.",
        }],
  };
}
