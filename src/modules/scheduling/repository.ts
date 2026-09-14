import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { academicYears, classGroups, curriculumItems, grades, majors, periods, scheduleCandidates, scheduleRuns, schoolDays, subjects, teacherAvailability, teacherSubjectAssignments, teacherYearProfiles, teachers } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";
import type { ScheduleCandidate, SchedulingIssue, SchedulingProblem, SolverResult } from "./types";

export interface StoredRun { id: string; status: "SUCCEEDED" | "NO_SOLUTION" | "PREFLIGHT_FAILED"; inputFingerprint: string; engineVersion: string; generationTimeMs: number; exploredNodes: number; issues: SchedulingIssue[]; summary: Record<string, unknown>; createdAt: Date; candidates: ScheduleCandidate[] }
export interface SchedulingRepository {
  loadProblem(context: TenantContext, academicYearId?: string): Promise<SchedulingProblem | null>;
  saveRun(context: TenantContext, input: { problem: SchedulingProblem; fingerprint: string; engineVersion: string; result: SolverResult; summary: Record<string, unknown> }): Promise<string>;
  getRun(context: TenantContext, runId?: string): Promise<StoredRun | null>;
}

export function createSchedulingRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): SchedulingRepository {
  return {
    async loadProblem(context, academicYearId) {
      const yearCondition = academicYearId
        ? and(eq(academicYears.schoolId, context.schoolId), eq(academicYears.id, academicYearId))
        : and(eq(academicYears.schoolId, context.schoolId), eq(academicYears.isActive, true));
      const [year] = await db.select({ id: academicYears.id, title: academicYears.title }).from(academicYears).where(yearCondition).limit(1);
      if (!year) return null;
      const [classRows, curriculumRows, dayRows, periodRows, teacherRows, teacherSubjectRows, availabilityRows] = await Promise.all([
        db.select({ id: classGroups.id, name: classGroups.name, gradeId: classGroups.gradeId, gradeName: grades.name, majorId: classGroups.majorId, majorName: majors.name })
          .from(classGroups)
          .innerJoin(grades, and(eq(grades.id, classGroups.gradeId), eq(grades.schoolId, context.schoolId)))
          .leftJoin(majors, and(eq(majors.id, classGroups.majorId), eq(majors.schoolId, context.schoolId)))
          .where(and(eq(classGroups.schoolId, context.schoolId), eq(classGroups.academicYearId, year.id), eq(classGroups.isActive, true)))
          .orderBy(asc(grades.sortOrder), asc(classGroups.name)),
        db.select({ id: curriculumItems.id, gradeId: curriculumItems.gradeId, majorId: curriculumItems.majorId, subjectId: curriculumItems.subjectId, subjectName: subjects.name, weeklyHours: curriculumItems.weeklyHours, sessionPattern: curriculumItems.sessionPattern }).from(curriculumItems).innerJoin(subjects, and(eq(subjects.id, curriculumItems.subjectId), eq(subjects.schoolId, context.schoolId))).where(and(eq(curriculumItems.schoolId, context.schoolId), eq(curriculumItems.academicYearId, year.id), eq(curriculumItems.isActive, true), eq(subjects.isActive, true))).orderBy(asc(curriculumItems.id)),
        db.select({ id: schoolDays.id, label: schoolDays.label, sortOrder: schoolDays.sortOrder }).from(schoolDays).where(and(eq(schoolDays.schoolId, context.schoolId), eq(schoolDays.academicYearId, year.id), eq(schoolDays.isActive, true))).orderBy(asc(schoolDays.sortOrder)),
        db.select({ id: periods.id, dayId: periods.schoolDayId, position: periods.position, label: periods.label, startTime: periods.startTime, endTime: periods.endTime }).from(periods).where(and(eq(periods.schoolId, context.schoolId), eq(periods.academicYearId, year.id), eq(periods.isActive, true))).orderBy(asc(periods.position)),
        db.select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName, minimumWorkload: teacherYearProfiles.minimumWorkload, requiredWorkload: teacherYearProfiles.requiredWorkload, maximumWorkload: teacherYearProfiles.maximumWorkload, overtimeAllowance: teacherYearProfiles.overtimeAllowance, dailyMaximum: teacherYearProfiles.dailyMaximum, maxConsecutive: teacherYearProfiles.maxConsecutive }).from(teachers).leftJoin(teacherYearProfiles, and(eq(teacherYearProfiles.teacherId, teachers.id), eq(teacherYearProfiles.academicYearId, year.id), eq(teacherYearProfiles.schoolId, context.schoolId))).where(and(eq(teachers.schoolId, context.schoolId), eq(teachers.isActive, true))).orderBy(asc(teachers.id)),
        db.select({ teacherId: teacherSubjectAssignments.teacherId, subjectId: teacherSubjectAssignments.subjectId, assignedWeeklyHours: teacherSubjectAssignments.assignedWeeklyHours }).from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.schoolId, context.schoolId), eq(teacherSubjectAssignments.academicYearId, year.id))),
        db.select({ teacherId: teacherAvailability.teacherId, periodId: teacherAvailability.periodId, status: teacherAvailability.status }).from(teacherAvailability).where(and(eq(teacherAvailability.schoolId, context.schoolId), eq(teacherAvailability.academicYearId, year.id))),
      ]);
      const classes = classRows;
      const curriculum = curriculumRows.flatMap((rule) => classes.filter((schoolClass) => schoolClass.gradeId === rule.gradeId && (rule.majorId === null || schoolClass.majorId === rule.majorId)).map((schoolClass) => ({ id: `${rule.id}:${schoolClass.id}`, classId: schoolClass.id, className: schoolClass.name, subjectId: rule.subjectId, subjectName: rule.subjectName, weeklyHours: rule.weeklyHours, sessionPattern: rule.sessionPattern })));
      const periodsView = periodRows.map((period) => { const day = dayRows.find((item) => item.id === period.dayId)!; const lastPosition = Math.max(...periodRows.filter((item) => item.dayId === period.dayId).map((item) => item.position)); return { ...period, dayLabel: day.label, dayOrder: day.sortOrder, isLast: period.position === lastPosition }; });
      const teacherResources = teacherRows.map((teacher) => ({ id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}`, profileConfigured: teacher.requiredWorkload !== null, subjectAssignments: teacherSubjectRows.filter((row) => row.teacherId === teacher.id).map(({ subjectId, assignedWeeklyHours }) => ({ subjectId, assignedWeeklyHours })), minimumWorkload: teacher.minimumWorkload ?? 0, requiredWorkload: teacher.requiredWorkload ?? 0, maximumWorkload: teacher.maximumWorkload ?? 0, overtimeAllowance: teacher.overtimeAllowance ?? 0, dailyMaximum: teacher.dailyMaximum ?? 0, maxConsecutive: teacher.maxConsecutive ?? 0, availability: Object.fromEntries(availabilityRows.filter((row) => row.teacherId === teacher.id).map((row) => [row.periodId, row.status])) }));
      return { schoolId: context.schoolId, academicYearId: year.id, academicYearTitle: year.title, classes, periods: periodsView, curriculum, teachers: teacherResources };
    },
    async saveRun(context, input) {
      return db.transaction(async (tx) => {
        const [run] = await tx.insert(scheduleRuns).values({ schoolId: context.schoolId, academicYearId: input.problem.academicYearId, createdByUserId: context.userId, status: input.result.status, inputFingerprint: input.fingerprint, engineVersion: input.engineVersion, generationTimeMs: input.result.elapsedMs, exploredNodes: input.result.exploredNodes, issues: input.result.issues, summary: input.summary }).returning({ id: scheduleRuns.id });
        if (input.result.candidates.length) await tx.insert(scheduleCandidates).values(input.result.candidates.map((candidate) => ({ schoolId: context.schoolId, scheduleRunId: run.id, rank: candidate.rank, score: candidate.score, penalty: candidate.penalty, penaltyBreakdown: { ...candidate.penaltyBreakdown }, assignments: candidate.assignments })));
        return run.id;
      });
    },
    async getRun(context, runId) {
      const condition = runId ? and(eq(scheduleRuns.id, runId), eq(scheduleRuns.schoolId, context.schoolId)) : eq(scheduleRuns.schoolId, context.schoolId);
      const [run] = await db.select().from(scheduleRuns).where(condition).orderBy(desc(scheduleRuns.createdAt)).limit(1);
      if (!run) return null;
      const candidates = await db.select().from(scheduleCandidates).where(and(eq(scheduleCandidates.scheduleRunId, run.id), eq(scheduleCandidates.schoolId, context.schoolId))).orderBy(asc(scheduleCandidates.rank));
      return { id: run.id, status: run.status, inputFingerprint: run.inputFingerprint, engineVersion: run.engineVersion, generationTimeMs: run.generationTimeMs, exploredNodes: run.exploredNodes, issues: run.issues as SchedulingIssue[], summary: run.summary, createdAt: run.createdAt, candidates: candidates.map((candidate) => ({ rank: candidate.rank, score: candidate.score, penalty: candidate.penalty, penaltyBreakdown: candidate.penaltyBreakdown as unknown as ScheduleCandidate["penaltyBreakdown"], assignments: candidate.assignments as ScheduleCandidate["assignments"], signature: "" })) };
    },
  };
}
