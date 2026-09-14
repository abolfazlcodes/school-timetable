import { and, asc, eq, isNull } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { academicYears, classGroups, curriculumItems, grades, majors, subjects, teacherSubjectAssignments } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";

export interface SubjectView { id: string; name: string; code: string | null; isActive: boolean }
export interface CurriculumItemView {
  id: string;
  gradeId: string;
  gradeName: string;
  majorId: string | null;
  majorName: string | null;
  subjectId: string;
  subjectName: string;
  weeklyHours: number;
  sessionCount: number;
  sessionPattern: number[];
  classCount: number;
  totalWorkload: number;
  isActive: boolean;
}
export interface CurriculumWorkspaceData {
  activeAcademicYear: { id: string; title: string } | null;
  grades: { id: string; name: string }[];
  majors: { id: string; name: string }[];
  subjects: SubjectView[];
  items: CurriculumItemView[];
  requirements: {
    subjectId: string;
    subjectName: string;
    totalRequiredHours: number;
    totalAssignedHours: number;
    scopes: { label: string; classCount: number; weeklyHours: number; requiredHours: number }[];
  }[];
}
export interface CurriculumScope { valid: boolean }
export interface CurriculumRepository {
  getWorkspace(context: TenantContext): Promise<CurriculumWorkspaceData>;
  createSubject(context: TenantContext, input: { name: string; code: string | null }): Promise<void>;
  updateSubjectStatus(context: TenantContext, subjectId: string, isActive: boolean): Promise<boolean>;
  resolveScope(context: TenantContext, input: { academicYearId: string; gradeId: string; majorId: string | null; subjectId: string }): Promise<CurriculumScope | null>;
  saveItem(context: TenantContext, input: { academicYearId: string; gradeId: string; majorId: string | null; subjectId: string; weeklyHours: number; sessionCount: number; sessionPattern: number[] }): Promise<void>;
}

export function createCurriculumRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): CurriculumRepository {
  return {
    async getWorkspace(context) {
      const [activeYear] = await db.select({ id: academicYears.id, title: academicYears.title }).from(academicYears).where(and(eq(academicYears.schoolId, context.schoolId), eq(academicYears.isActive, true))).limit(1);
      const [gradeRows, majorRows, subjectRows] = await Promise.all([
        db.select({ id: grades.id, name: grades.name }).from(grades).where(and(eq(grades.schoolId, context.schoolId), eq(grades.isActive, true))).orderBy(asc(grades.sortOrder)),
        db.select({ id: majors.id, name: majors.name }).from(majors).where(and(eq(majors.schoolId, context.schoolId), eq(majors.isActive, true))).orderBy(asc(majors.name)),
        db.select({ id: subjects.id, name: subjects.name, code: subjects.code, isActive: subjects.isActive }).from(subjects).where(eq(subjects.schoolId, context.schoolId)).orderBy(asc(subjects.name)),
      ]);
      if (!activeYear) return { activeAcademicYear: null, grades: gradeRows, majors: majorRows, subjects: subjectRows, items: [], requirements: [] };
      const [itemRows, classes, assignmentRows] = await Promise.all([
        db.select({ id: curriculumItems.id, gradeId: curriculumItems.gradeId, gradeName: grades.name, majorId: curriculumItems.majorId, majorName: majors.name, subjectId: curriculumItems.subjectId, subjectName: subjects.name, weeklyHours: curriculumItems.weeklyHours, sessionCount: curriculumItems.sessionCount, sessionPattern: curriculumItems.sessionPattern, isActive: curriculumItems.isActive })
          .from(curriculumItems)
          .innerJoin(grades, and(eq(grades.id, curriculumItems.gradeId), eq(grades.schoolId, context.schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, curriculumItems.subjectId), eq(subjects.schoolId, context.schoolId)))
          .leftJoin(majors, and(eq(majors.id, curriculumItems.majorId), eq(majors.schoolId, context.schoolId)))
          .where(and(eq(curriculumItems.schoolId, context.schoolId), eq(curriculumItems.academicYearId, activeYear.id)))
          .orderBy(asc(grades.sortOrder), asc(subjects.name)),
        db.select({ gradeId: classGroups.gradeId, majorId: classGroups.majorId }).from(classGroups).where(and(eq(classGroups.schoolId, context.schoolId), eq(classGroups.academicYearId, activeYear.id), eq(classGroups.isActive, true))),
        db.select({ subjectId: teacherSubjectAssignments.subjectId, assignedWeeklyHours: teacherSubjectAssignments.assignedWeeklyHours }).from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.schoolId, context.schoolId), eq(teacherSubjectAssignments.academicYearId, activeYear.id))),
      ]);
      const items = itemRows.map((item) => {
        const classCount = classes.filter((group) => group.gradeId === item.gradeId && (item.majorId === null || group.majorId === item.majorId)).length;
        return { ...item, classCount, totalWorkload: classCount * item.weeklyHours };
      });
      const requirements = [...new Set(items.filter((item) => item.isActive).map((item) => item.subjectId))].map((subjectId) => {
        const scopedItems = items.filter((item) => item.isActive && item.subjectId === subjectId);
        return {
          subjectId,
          subjectName: scopedItems[0].subjectName,
          totalRequiredHours: scopedItems.reduce((sum, item) => sum + item.totalWorkload, 0),
          totalAssignedHours: assignmentRows.filter((item) => item.subjectId === subjectId).reduce((sum, item) => sum + item.assignedWeeklyHours, 0),
          scopes: scopedItems.map((item) => ({ label: `${item.gradeName}${item.majorName ? ` · ${item.majorName}` : " · همه رشته‌ها"}`, classCount: item.classCount, weeklyHours: item.weeklyHours, requiredHours: item.totalWorkload })),
        };
      }).sort((a, b) => a.subjectName.localeCompare(b.subjectName, "fa"));
      return { activeAcademicYear: activeYear, grades: gradeRows, majors: majorRows, subjects: subjectRows, items, requirements };
    },
    async createSubject(context, input) { await db.insert(subjects).values({ schoolId: context.schoolId, ...input }); },
    async updateSubjectStatus(context, subjectId, isActive) {
      const [updated] = await db.update(subjects).set({ isActive }).where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, context.schoolId))).returning({ id: subjects.id });
      return Boolean(updated);
    },
    async resolveScope(context, input) {
      const [year, grade, subject, major] = await Promise.all([
        db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, input.academicYearId), eq(academicYears.schoolId, context.schoolId))).limit(1),
        db.select({ id: grades.id }).from(grades).where(and(eq(grades.id, input.gradeId), eq(grades.schoolId, context.schoolId))).limit(1),
        db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, context.schoolId))).limit(1),
        input.majorId ? db.select({ id: majors.id }).from(majors).where(and(eq(majors.id, input.majorId), eq(majors.schoolId, context.schoolId))).limit(1) : Promise.resolve([{ id: "none" }]),
      ]);
      return year[0] && grade[0] && subject[0] && major[0] ? { valid: true } : null;
    },
    async saveItem(context, input) {
      const majorCondition = input.majorId ? eq(curriculumItems.majorId, input.majorId) : isNull(curriculumItems.majorId);
      const [existing] = await db.select({ id: curriculumItems.id }).from(curriculumItems).where(and(eq(curriculumItems.schoolId, context.schoolId), eq(curriculumItems.academicYearId, input.academicYearId), eq(curriculumItems.gradeId, input.gradeId), eq(curriculumItems.subjectId, input.subjectId), majorCondition)).limit(1);
      if (existing) {
        await db.update(curriculumItems).set({ weeklyHours: input.weeklyHours, sessionCount: input.sessionCount, sessionPattern: input.sessionPattern, isActive: true, updatedAt: new Date() }).where(and(eq(curriculumItems.id, existing.id), eq(curriculumItems.schoolId, context.schoolId)));
      } else {
        await db.insert(curriculumItems).values({ schoolId: context.schoolId, ...input });
      }
    },
  };
}
