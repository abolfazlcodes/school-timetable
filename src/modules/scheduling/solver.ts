import { validateSchedule } from "./validator";
import { expandSessions, type PenaltyBreakdown, type ScheduleAssignment, type ScheduleCandidate, type SessionRequirement, type SolverOptions, type SolverResult, type SchedulingProblem } from "./types";

const ENGINE_VERSION = "csp-1.0";
export { ENGINE_VERSION };

interface Placement { teacherId: string; dayId: string; startPosition: number; periodIds: string[]; key: string; basePenalty: number }
interface SearchState { assignments: Map<string, ScheduleAssignment>; classSlots: Set<string>; teacherSlots: Set<string>; teacherLoad: Map<string, number>; teacherDayPositions: Map<string, number[]>; curriculumDays: Map<string, string[]>; incrementalPenalty: number }

function longestRun(positions: number[]) {
  const sorted = [...new Set(positions)].sort((a, b) => a - b); let longest = 0; let current = 0; let previous = -99;
  for (const position of sorted) { current = position === previous + 1 ? current + 1 : 1; longest = Math.max(longest, current); previous = position; }
  return longest;
}

function buildDomains(problem: SchedulingProblem, sessions: SessionRequirement[]) {
  const days = new Map<string, typeof problem.periods>();
  for (const period of problem.periods) days.set(period.dayId, [...(days.get(period.dayId) ?? []), period]);
  for (const periods of days.values()) periods.sort((a, b) => a.position - b.position);
  const result = new Map<string, Placement[]>();
  for (const session of sessions) {
    const placements: Placement[] = [];
    for (const teacher of problem.teachers.filter((item) => item.subjectIds.includes(session.subjectId)).sort((a, b) => a.id.localeCompare(b.id))) {
      for (const [dayId, periods] of [...days].sort((a, b) => (a[1][0]?.dayOrder ?? 0) - (b[1][0]?.dayOrder ?? 0))) {
        for (let start = 0; start <= periods.length - session.duration; start += 1) {
          const window = periods.slice(start, start + session.duration);
          if (window.some((period, index) => index && period.position !== window[index - 1].position + 1)) continue;
          if (window.some((period) => !["AVAILABLE", "PREFERRED"].includes(teacher.availability[period.id]))) continue;
          const basePenalty = window.reduce((sum, period) => sum + (teacher.availability[period.id] === "PREFERRED" ? 0 : 1), 0) + (window.some((period) => period.isLast) ? 3 : 0);
          placements.push({ teacherId: teacher.id, dayId, startPosition: window[0].position, periodIds: window.map((period) => period.id), basePenalty, key: `${basePenalty.toString().padStart(3, "0")}:${window[0].dayOrder}:${window[0].position}:${teacher.id}` });
        }
      }
    }
    result.set(session.id, placements.sort((a, b) => a.key.localeCompare(b.key)));
  }
  return result;
}

function feasible(problem: SchedulingProblem, session: SessionRequirement, placement: Placement, state: SearchState) {
  const teacher = problem.teachers.find((item) => item.id === placement.teacherId)!;
  if ((state.teacherLoad.get(teacher.id) ?? 0) + session.duration > teacher.maximumWorkload + teacher.overtimeAllowance) return false;
  for (const periodId of placement.periodIds) if (state.classSlots.has(`${session.classId}:${periodId}`) || state.teacherSlots.has(`${teacher.id}:${periodId}`)) return false;
  const dayKey = `${teacher.id}:${placement.dayId}`;
  const existing = state.teacherDayPositions.get(dayKey) ?? [];
  if (existing.length + session.duration > teacher.dailyMaximum) return false;
  const newPositions = placement.periodIds.map((id) => problem.periods.find((period) => period.id === id)!.position);
  if (longestRun([...existing, ...newPositions]) > teacher.maxConsecutive) return false;
  return true;
}

function place(problem: SchedulingProblem, session: SessionRequirement, placement: Placement, state: SearchState) {
  const assignment: ScheduleAssignment = { sessionId: session.id, curriculumId: session.curriculumId, classId: session.classId, subjectId: session.subjectId, teacherId: placement.teacherId, dayId: placement.dayId, startPosition: placement.startPosition, periodIds: placement.periodIds };
  state.assignments.set(session.id, assignment);
  for (const periodId of placement.periodIds) { state.classSlots.add(`${session.classId}:${periodId}`); state.teacherSlots.add(`${placement.teacherId}:${periodId}`); }
  state.teacherLoad.set(placement.teacherId, (state.teacherLoad.get(placement.teacherId) ?? 0) + session.duration);
  const dayKey = `${placement.teacherId}:${placement.dayId}`; const positions = placement.periodIds.map((id) => problem.periods.find((period) => period.id === id)!.position);
  state.teacherDayPositions.set(dayKey, [...(state.teacherDayPositions.get(dayKey) ?? []), ...positions]);
  const curriculumDays = state.curriculumDays.get(session.curriculumId) ?? [];
  const distributionPenalty = curriculumDays.includes(placement.dayId) ? 5 : 0;
  state.curriculumDays.set(session.curriculumId, [...curriculumDays, placement.dayId]); state.incrementalPenalty += placement.basePenalty + distributionPenalty;
  return { assignment, dayKey, distributionPenalty };
}

function unplace(session: SessionRequirement, placement: Placement, state: SearchState, snapshot: ReturnType<typeof place>) {
  state.assignments.delete(session.id);
  for (const periodId of placement.periodIds) { state.classSlots.delete(`${session.classId}:${periodId}`); state.teacherSlots.delete(`${placement.teacherId}:${periodId}`); }
  state.teacherLoad.set(placement.teacherId, (state.teacherLoad.get(placement.teacherId) ?? 0) - session.duration);
  const existingPositions = state.teacherDayPositions.get(snapshot.dayKey) ?? [];
  state.teacherDayPositions.set(snapshot.dayKey, existingPositions.slice(0, Math.max(0, existingPositions.length - session.duration)));
  const curriculumDays = state.curriculumDays.get(session.curriculumId) ?? []; state.curriculumDays.set(session.curriculumId, curriculumDays.slice(0, -1));
  state.incrementalPenalty -= placement.basePenalty + snapshot.distributionPenalty;
}

function gapCount(positions: number[]) { const sorted = [...new Set(positions)].sort((a, b) => a - b); return sorted.length < 2 ? 0 : Math.max(0, sorted.at(-1)! - sorted[0] + 1 - sorted.length); }

export function scoreSchedule(problem: SchedulingProblem, assignments: ScheduleAssignment[]) {
  const periods = new Map(problem.periods.map((period) => [period.id, period])); const teachers = new Map(problem.teachers.map((teacher) => [teacher.id, teacher]));
  const breakdown: PenaltyBreakdown = { preference: 0, lastPeriod: 0, subjectDistribution: 0, teacherGaps: 0, classGaps: 0, workloadBalance: 0 };
  const teacherDays = new Map<string, number[]>(); const classDays = new Map<string, number[]>(); const curriculumDays = new Map<string, string[]>(); const teacherLoads = new Map<string, number>();
  for (const assignment of assignments) {
    const teacher = teachers.get(assignment.teacherId)!;
    for (const periodId of assignment.periodIds) { const period = periods.get(periodId)!; if (teacher.availability[periodId] !== "PREFERRED") breakdown.preference += 1; if (period.isLast) breakdown.lastPeriod += 3; teacherDays.set(`${teacher.id}:${assignment.dayId}`, [...(teacherDays.get(`${teacher.id}:${assignment.dayId}`) ?? []), period.position]); classDays.set(`${assignment.classId}:${assignment.dayId}`, [...(classDays.get(`${assignment.classId}:${assignment.dayId}`) ?? []), period.position]); }
    const days = curriculumDays.get(assignment.curriculumId) ?? []; if (days.includes(assignment.dayId)) breakdown.subjectDistribution += 5; curriculumDays.set(assignment.curriculumId, [...days, assignment.dayId]);
    teacherLoads.set(teacher.id, (teacherLoads.get(teacher.id) ?? 0) + assignment.periodIds.length);
  }
  for (const positions of teacherDays.values()) breakdown.teacherGaps += gapCount(positions) * 2;
  for (const positions of classDays.values()) breakdown.classGaps += gapCount(positions);
  for (const teacher of problem.teachers) { const load = teacherLoads.get(teacher.id) ?? 0; breakdown.workloadBalance += Math.abs(load - teacher.requiredWorkload); if (load > teacher.maximumWorkload) breakdown.workloadBalance += (load - teacher.maximumWorkload) * 3; }
  const penalty = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { penalty, score: Math.max(0, 10_000 - penalty * 100), breakdown };
}

function signature(assignments: ScheduleAssignment[]) { return assignments.map((item) => `${item.classId}:${item.subjectId}:${item.teacherId}:${item.dayId}:${item.startPosition}:${item.periodIds.join(",")}`).sort().join("|"); }

export function solveSchedule(problem: SchedulingProblem, options: SolverOptions = {}): SolverResult {
  const started = Date.now(); const deadline = started + (options.timeBudgetMs ?? 3_000); const nodeBudget = options.nodeBudget ?? 150_000; const maxCandidates = options.maxCandidates ?? 3;
  const sessions = expandSessions(problem); const domains = buildDomains(problem, sessions); const candidates: ScheduleCandidate[] = []; const signatures = new Set<string>(); let exploredNodes = 0; let budgetExhausted = false;
  const emptyDomain = sessions.find((session) => !domains.get(session.id)?.length);
  if (emptyDomain) return { status: "NO_SOLUTION", candidates: [], exploredNodes: 0, elapsedMs: Date.now() - started, budgetExhausted: false, issues: [{ code: "EMPTY_DOMAIN", severity: "ERROR", message: `برای جلسه «${emptyDomain.subjectName}» کلاس «${emptyDomain.className}» هیچ زمان و دبیر مجازی وجود ندارد.` }] };
  const state: SearchState = { assignments: new Map(), classSlots: new Set(), teacherSlots: new Set(), teacherLoad: new Map(), teacherDayPositions: new Map(), curriculumDays: new Map(), incrementalPenalty: 0 };
  function search() {
    exploredNodes += 1;
    if (exploredNodes > nodeBudget || Date.now() > deadline) { budgetExhausted = true; return; }
    if (state.assignments.size === sessions.length) {
      const assignments = [...state.assignments.values()]; if (validateSchedule(problem, assignments).some((issue) => issue.severity === "ERROR")) return;
      const candidateSignature = signature(assignments); if (signatures.has(candidateSignature)) return; signatures.add(candidateSignature);
      const scoring = scoreSchedule(problem, assignments); candidates.push({ rank: 0, score: scoring.score, penalty: scoring.penalty, penaltyBreakdown: scoring.breakdown, assignments: assignments.sort((a, b) => a.sessionId.localeCompare(b.sessionId)), signature: candidateSignature });
      candidates.sort((a, b) => a.penalty - b.penalty || a.signature.localeCompare(b.signature)); if (candidates.length > maxCandidates) candidates.pop(); return;
    }
    if (candidates.length === maxCandidates && state.incrementalPenalty >= candidates.at(-1)!.penalty) return;
    let chosen: SessionRequirement | undefined; let feasibleDomain: Placement[] = [];
    for (const session of sessions) if (!state.assignments.has(session.id)) {
      const current = domains.get(session.id)!.filter((placement) => feasible(problem, session, placement, state));
      if (!current.length) return;
      if (!chosen || current.length < feasibleDomain.length || current.length === feasibleDomain.length && session.id.localeCompare(chosen.id) < 0) { chosen = session; feasibleDomain = current; }
    }
    for (const placement of feasibleDomain) { const snapshot = place(problem, chosen!, placement, state); search(); unplace(chosen!, placement, state, snapshot); if (budgetExhausted) return; }
  }
  search(); candidates.forEach((candidate, index) => { candidate.rank = index + 1; });
  const issues = candidates.length ? (budgetExhausted ? [{ code: "SEARCH_BUDGET", severity: "WARNING" as const, message: "برنامه معتبر پیدا شد؛ جست‌وجوی گزینه‌های بیشتر به سقف زمان رسید." }] : []) : [{ code: "NO_SOLUTION", severity: "ERROR" as const, message: budgetExhausted ? "در محدوده زمان جست‌وجو برنامه معتبری پیدا نشد. محدودیت‌ها را بازبینی کنید." : "با محدودیت‌های فعلی برنامه معتبری وجود ندارد." }];
  return { status: candidates.length ? "SUCCEEDED" : "NO_SOLUTION", candidates, exploredNodes, elapsedMs: Date.now() - started, budgetExhausted, issues };
}
