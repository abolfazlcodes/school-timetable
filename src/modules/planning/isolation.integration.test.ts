// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { academicYears, grades, scheduleCandidates, scheduleRuns, scheduleVersions, scheduleWorkspaces, schoolMemberships, schools, subjects, teacherSubjectAssignments, users } from "@/db/schema";
import { createAcademicStructureRepository } from "@/modules/academic-structure/repository";
import { createTeacherRepository } from "@/modules/teachers/repository";
import type { TenantContext } from "@/modules/tenancy/types";
import { createTimetableRepository } from "@/modules/timetable/repository";
import { createScheduleVersionRepository } from "@/modules/schedule-versions/repository";

const ids = { user: "10000000-0000-4000-8000-000000000001", schoolA: "20000000-0000-4000-8000-000000000001", schoolB: "20000000-0000-4000-8000-000000000002", yearA: "30000000-0000-4000-8000-000000000001", yearA2: "30000000-0000-4000-8000-000000000003", yearB: "30000000-0000-4000-8000-000000000002", gradeA: "31000000-0000-4000-8000-000000000001", gradeB: "31000000-0000-4000-8000-000000000002", subjectA: "34000000-0000-4000-8000-000000000001", subjectB: "34000000-0000-4000-8000-000000000002" };
const contextA: TenantContext = { sessionId: "s", userId: ids.user, userName: "مدیر", schoolId: ids.schoolA, schoolName: "الف", schoolCode: null, role: "ADMIN" };

describe("جداسازی ورودی‌های برنامه‌ریزی", () => {
  it("reference مدرسه دیگر را در repository و DB رد می‌کند", async () => {
    const client = new PGlite();
    try {
      for (const migrationName of ["0000_auth_and_schools.sql", "0001_planning_inputs.sql", "0002_planning_invariants.sql", "0003_schedule_runs.sql", "0004_schedule_workspaces.sql", "0005_schedule_versions.sql", "0006_hardening_invariants.sql", "0007_period_overlap_upsert.sql", "0008_school_day_timeline.sql", "0009_real_school_calibration.sql"]) await client.exec(await readFile(new URL(`../../../migrations/${migrationName}`, import.meta.url), "utf8"));
      const db = drizzle(client, { schema });
      await db.insert(users).values({ id: ids.user, email: "admin@example.com", fullName: "مدیر", passwordHash: "hash" });
      await db.insert(schools).values([{ id: ids.schoolA, name: "مدرسه الف" }, { id: ids.schoolB, name: "مدرسه ب" }]);
      await db.insert(schoolMemberships).values([{ userId: ids.user, schoolId: ids.schoolA, role: "ADMIN" }, { userId: ids.user, schoolId: ids.schoolB, role: "ADMIN" }]);
      await db.insert(academicYears).values([{ id: ids.yearA, schoolId: ids.schoolA, title: "۱۴۰۵ الف", startYear: 1405, endYear: 1406, isActive: true }, { id: ids.yearA2, schoolId: ids.schoolA, title: "۱۴۰۶ الف", startYear: 1406, endYear: 1407, isActive: false }, { id: ids.yearB, schoolId: ids.schoolB, title: "۱۴۰۵ ب", startYear: 1405, endYear: 1406, isActive: true }]);
      await db.insert(grades).values([{ id: ids.gradeA, schoolId: ids.schoolA, name: "دهم", code: "10" }, { id: ids.gradeB, schoolId: ids.schoolB, name: "یازدهم", code: "11" }]);
      await db.insert(subjects).values([{ id: ids.subjectA, schoolId: ids.schoolA, name: "زبان" }, { id: ids.subjectB, schoolId: ids.schoolB, name: "فیزیک" }]);

      const structureRepository = createAcademicStructureRepository(db);
      await expect(structureRepository.resolveClassScope(contextA, { academicYearId: ids.yearB, gradeId: ids.gradeB, majorId: null })).resolves.toBeNull();
      await expect(db.insert(schema.classPlans).values({ schoolId: ids.schoolA, academicYearId: ids.yearB, gradeId: ids.gradeA, studentCount: 20, maxClassCapacity: 25 })).rejects.toThrow();
      await expect(db.insert(schema.curriculumItems).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, gradeId: ids.gradeA, subjectId: ids.subjectA, weeklyHours: 4, sessionCount: 2, sessionPattern: [3, 2] })).rejects.toThrow();
      await expect(db.insert(schema.scheduleRuns).values({ schoolId: ids.schoolA, academicYearId: ids.yearB, createdByUserId: ids.user, status: "NO_SOLUTION", inputFingerprint: "a".repeat(64), engineVersion: "test", generationTimeMs: 1, exploredNodes: 1, issues: [], summary: {} })).rejects.toThrow();

      const [runA] = await db.insert(scheduleRuns).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, createdByUserId: ids.user, status: "SUCCEEDED", inputFingerprint: "b".repeat(64), engineVersion: "test", generationTimeMs: 1, exploredNodes: 1, issues: [], summary: {} }).returning({ id: scheduleRuns.id });
      const [runB] = await db.insert(scheduleRuns).values({ schoolId: ids.schoolB, academicYearId: ids.yearB, createdByUserId: ids.user, status: "SUCCEEDED", inputFingerprint: "c".repeat(64), engineVersion: "test", generationTimeMs: 1, exploredNodes: 1, issues: [], summary: {} }).returning({ id: scheduleRuns.id });
      const [candidateA] = await db.insert(scheduleCandidates).values({ schoolId: ids.schoolA, scheduleRunId: runA.id, rank: 1, score: 9900, penalty: 1, penaltyBreakdown: {}, assignments: [] }).returning({ id: scheduleCandidates.id });
      const [candidateB] = await db.insert(scheduleCandidates).values({ schoolId: ids.schoolB, scheduleRunId: runB.id, rank: 1, score: 9800, penalty: 2, penaltyBreakdown: {}, assignments: [] }).returning({ id: scheduleCandidates.id });
      await expect(db.insert(scheduleWorkspaces).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, scheduleRunId: runA.id, sourceCandidateId: candidateB.id, createdByUserId: ids.user, assignments: [], validationIssues: [] })).rejects.toThrow();
      const [workspaceB] = await db.insert(scheduleWorkspaces).values({ schoolId: ids.schoolB, academicYearId: ids.yearB, scheduleRunId: runB.id, sourceCandidateId: candidateB.id, createdByUserId: ids.user, assignments: [], validationIssues: [] }).returning({ id: scheduleWorkspaces.id });
      const [workspaceA] = await db.insert(scheduleWorkspaces).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, scheduleRunId: runA.id, sourceCandidateId: candidateA.id, createdByUserId: ids.user, assignments: [], validationIssues: [] }).returning({ id: scheduleWorkspaces.id });
      const [versionA] = await db.insert(scheduleVersions).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, scheduleRunId: runA.id, sourceCandidateId: candidateA.id, sourceWorkspaceId: workspaceA.id, createdByUserId: ids.user, versionNumber: 1, status: "DRAFT", score: 9900, assignments: [], validationIssues: [] }).returning({ id: scheduleVersions.id });
      const [versionB] = await db.insert(scheduleVersions).values({ schoolId: ids.schoolB, academicYearId: ids.yearB, scheduleRunId: runB.id, sourceCandidateId: candidateB.id, sourceWorkspaceId: workspaceB.id, createdByUserId: ids.user, versionNumber: 1, status: "DRAFT", score: 9800, assignments: [], validationIssues: [] }).returning({ id: scheduleVersions.id });
      expect((await createScheduleVersionRepository(db).get(contextA, versionA.id))?.id).toBe(versionA.id);
      expect(await createScheduleVersionRepository(db).get(contextA, versionB.id)).toBeNull();
      await expect(db.insert(scheduleVersions).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, scheduleRunId: runA.id, sourceCandidateId: candidateA.id, sourceWorkspaceId: workspaceB.id, createdByUserId: ids.user, versionNumber: 10, status: "DRAFT", score: 1, assignments: [], validationIssues: [] })).rejects.toThrow();
      const versionRepository = createScheduleVersionRepository(db);
      const storedWorkspaceA = await createTimetableRepository(db).getWorkspace(contextA, workspaceA.id);
      const firstPublished = await versionRepository.createSnapshot(contextA, storedWorkspaceA!, [], "PUBLISHED");
      const secondPublished = await versionRepository.createSnapshot(contextA, storedWorkspaceA!, [], "PUBLISHED");
      expect((await versionRepository.get(contextA, firstPublished.id))?.status).toBe("ARCHIVED");
      expect((await versionRepository.get(contextA, secondPublished.id))?.status).toBe("PUBLISHED");
      expect((await versionRepository.list(contextA, ids.yearA)).filter((item) => item.status === "PUBLISHED")).toHaveLength(1);
      expect(await createTimetableRepository(db).getWorkspace(contextA, workspaceB.id)).toBeNull();
      expect((await createTimetableRepository(db).getCandidate(contextA, runA.id, 1))?.candidateId).toBe(candidateA.id);
      expect(await createTimetableRepository(db).getCandidate(contextA, runB.id, 1)).toBeNull();

      const teacherRepository = createTeacherRepository(db);
      const teacherId = await teacherRepository.createTeacher(contextA, { firstName: "علی", lastName: "رضایی", personnelCode: "A-1", employmentType: "FULL_TIME", staffKind: "TEACHER", notes: null });
      await expect(teacherRepository.saveSubjectAssignments(contextA, ids.yearA, teacherId, [{ subjectId: ids.subjectB, assignedWeeklyHours: 12 }])).resolves.toBe(false);
      await expect(db.insert(teacherSubjectAssignments).values({ schoolId: ids.schoolA, academicYearId: ids.yearA, teacherId, subjectId: ids.subjectB, assignedWeeklyHours: 12 })).rejects.toThrow();
      await expect(teacherRepository.saveSubjectAssignments(contextA, ids.yearA, teacherId, [{ subjectId: ids.subjectA, assignedWeeklyHours: 24 }])).resolves.toBe(true);
      await expect(teacherRepository.saveSubjectAssignments(contextA, ids.yearA2, teacherId, [{ subjectId: ids.subjectA, assignedWeeklyHours: 16 }])).resolves.toBe(true);
      expect(await db.select({ academicYearId: teacherSubjectAssignments.academicYearId, hours: teacherSubjectAssignments.assignedWeeklyHours }).from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.teacherId, teacherId), eq(teacherSubjectAssignments.schoolId, ids.schoolA)))).toEqual(expect.arrayContaining([{ academicYearId: ids.yearA, hours: 24 }, { academicYearId: ids.yearA2, hours: 16 }]));
      const [foreignSubject] = await db.select().from(subjects).where(and(eq(subjects.id, ids.subjectB), eq(subjects.schoolId, ids.schoolB)));
      expect(foreignSubject.name).toBe("فیزیک");
    } finally { await client.close(); }
  }, 20_000);
});
