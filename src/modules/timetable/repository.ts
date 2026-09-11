import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { scheduleCandidates, scheduleRuns, scheduleWorkspaces } from "@/db/schema";
import type { ScheduleAssignment, SchedulingIssue } from "@/modules/scheduling/types";
import type { TenantContext } from "@/modules/tenancy/types";

export interface CandidateSource {
  candidateId: string;
  runId: string;
  academicYearId: string;
  rank: number;
  score: number;
  assignments: ScheduleAssignment[];
  generatedAt: Date;
}

export interface StoredScheduleWorkspace {
  id: string;
  academicYearId: string;
  scheduleRunId: string;
  sourceCandidateId: string;
  sourceVersionId: string | null;
  sourceRank: number;
  sourceScore: number;
  assignments: ScheduleAssignment[];
  validationIssues: SchedulingIssue[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimetableRepository {
  getCandidate(context: TenantContext, runId?: string, rank?: number): Promise<CandidateSource | null>;
  createWorkspace(context: TenantContext, source: CandidateSource, issues: SchedulingIssue[]): Promise<string>;
  getWorkspace(context: TenantContext, workspaceId?: string): Promise<StoredScheduleWorkspace | null>;
  updateWorkspace(
    context: TenantContext,
    workspaceId: string,
    expectedRevision: number,
    assignments: ScheduleAssignment[],
    issues: SchedulingIssue[],
  ): Promise<{ revision: number; updatedAt: Date } | null>;
}

export function createTimetableRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): TimetableRepository {
  return {
    async getCandidate(context, runId, rank) {
      const conditions = [eq(scheduleRuns.schoolId, context.schoolId), eq(scheduleRuns.status, "SUCCEEDED")];
      if (runId) conditions.push(eq(scheduleRuns.id, runId));
      if (rank) conditions.push(eq(scheduleCandidates.rank, rank));
      const [row] = await db
        .select({
          candidateId: scheduleCandidates.id,
          runId: scheduleRuns.id,
          academicYearId: scheduleRuns.academicYearId,
          rank: scheduleCandidates.rank,
          score: scheduleCandidates.score,
          assignments: scheduleCandidates.assignments,
          generatedAt: scheduleRuns.createdAt,
        })
        .from(scheduleCandidates)
        .innerJoin(scheduleRuns, and(eq(scheduleRuns.id, scheduleCandidates.scheduleRunId), eq(scheduleRuns.schoolId, scheduleCandidates.schoolId)))
        .where(and(...conditions, eq(scheduleCandidates.schoolId, context.schoolId)))
        .orderBy(desc(scheduleRuns.createdAt), asc(scheduleCandidates.rank))
        .limit(1);
      return row ? { ...row, assignments: row.assignments as ScheduleAssignment[] } : null;
    },

    async createWorkspace(context, source, issues) {
      await db.insert(scheduleWorkspaces).values({
        schoolId: context.schoolId,
        academicYearId: source.academicYearId,
        scheduleRunId: source.runId,
        sourceCandidateId: source.candidateId,
        createdByUserId: context.userId,
        assignments: source.assignments,
        validationIssues: issues,
      }).onConflictDoNothing();
      const [workspace] = await db
        .select({ id: scheduleWorkspaces.id })
        .from(scheduleWorkspaces)
        .where(and(
          eq(scheduleWorkspaces.sourceCandidateId, source.candidateId),
          eq(scheduleWorkspaces.schoolId, context.schoolId),
          isNull(scheduleWorkspaces.sourceVersionId),
        ))
        .limit(1);
      if (!workspace) throw new Error("WORKSPACE_CREATION_FAILED");
      return workspace.id;
    },

    async getWorkspace(context, workspaceId) {
      const conditions = [eq(scheduleWorkspaces.schoolId, context.schoolId)];
      if (workspaceId) conditions.push(eq(scheduleWorkspaces.id, workspaceId));
      const [row] = await db
        .select({
          id: scheduleWorkspaces.id,
          academicYearId: scheduleWorkspaces.academicYearId,
          scheduleRunId: scheduleWorkspaces.scheduleRunId,
          sourceCandidateId: scheduleWorkspaces.sourceCandidateId,
          sourceVersionId: scheduleWorkspaces.sourceVersionId,
          sourceRank: scheduleCandidates.rank,
          sourceScore: scheduleCandidates.score,
          assignments: scheduleWorkspaces.assignments,
          validationIssues: scheduleWorkspaces.validationIssues,
          revision: scheduleWorkspaces.revision,
          createdAt: scheduleWorkspaces.createdAt,
          updatedAt: scheduleWorkspaces.updatedAt,
        })
        .from(scheduleWorkspaces)
        .innerJoin(scheduleCandidates, and(
          eq(scheduleCandidates.id, scheduleWorkspaces.sourceCandidateId),
          eq(scheduleCandidates.scheduleRunId, scheduleWorkspaces.scheduleRunId),
          eq(scheduleCandidates.schoolId, scheduleWorkspaces.schoolId),
        ))
        .where(and(...conditions))
        .orderBy(desc(scheduleWorkspaces.updatedAt))
        .limit(1);
      return row ? {
        ...row,
        assignments: row.assignments as ScheduleAssignment[],
        validationIssues: row.validationIssues as SchedulingIssue[],
      } : null;
    },

    async updateWorkspace(context, workspaceId, expectedRevision, assignments, issues) {
      const [updated] = await db
        .update(scheduleWorkspaces)
        .set({ assignments, validationIssues: issues, revision: expectedRevision + 1, updatedAt: new Date() })
        .where(and(
          eq(scheduleWorkspaces.id, workspaceId),
          eq(scheduleWorkspaces.schoolId, context.schoolId),
          eq(scheduleWorkspaces.revision, expectedRevision),
        ))
        .returning({ revision: scheduleWorkspaces.revision, updatedAt: scheduleWorkspaces.updatedAt });
      return updated ?? null;
    },
  };
}
