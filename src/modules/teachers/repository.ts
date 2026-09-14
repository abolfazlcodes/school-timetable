import { and, asc, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import {
  academicYears,
  periods,
  schoolDays,
  subjects,
  teacherAvailability,
  teacherSubjectAssignments,
  teacherYearProfiles,
  teachers,
} from "@/db/schema";
import type {
  AvailabilityStatus,
  EmploymentType,
  StaffKind,
} from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";

export interface TeacherListItem {
  id: string;
  firstName: string;
  lastName: string;
  personnelCode: string;
  employmentType: EmploymentType;
  staffKind: StaffKind;
  isActive: boolean;
}
export interface TeacherDetail extends TeacherListItem {
  notes: string | null;
  subjectAssignments: { subjectId: string; assignedWeeklyHours: number }[];
  profile: {
    minimumWorkload: number;
    requiredWorkload: number;
    maximumWorkload: number;
    overtimeAllowance: number;
    dailyMinimum: number;
    dailyMaximum: number;
    maxConsecutive: number;
  } | null;
  availability: Record<string, AvailabilityStatus>;
}
export interface TeacherPeriod {
  id: string;
  schoolDayId: string;
  position: number;
  label: string;
  startTime: string;
  endTime: string;
}
export interface TeacherDay {
  id: string;
  label: string;
  sortOrder: number;
  periods: TeacherPeriod[];
}
export interface TeacherWorkspaceData {
  activeAcademicYear: { id: string; title: string } | null;
  teachers: TeacherListItem[];
  selectedTeacher: TeacherDetail | null;
  subjects: { id: string; name: string; isActive: boolean }[];
  schoolDays: TeacherDay[];
}
export interface TeacherRepository {
  getWorkspace(
    context: TenantContext,
    selectedTeacherId?: string,
  ): Promise<TeacherWorkspaceData>;
  createTeacher(
    context: TenantContext,
    input: {
      firstName: string;
      lastName: string;
      personnelCode: string;
      employmentType: EmploymentType;
      staffKind: StaffKind;
      notes: string | null;
    },
  ): Promise<string>;
  updateTeacher(
    context: TenantContext,
    teacherId: string,
    input: {
      firstName: string;
      lastName: string;
      personnelCode: string;
      employmentType: EmploymentType;
      staffKind: StaffKind;
      notes: string | null;
      isActive: boolean;
    },
  ): Promise<boolean>;
  saveSubjectAssignments(
    context: TenantContext,
    academicYearId: string,
    teacherId: string,
    assignments: { subjectId: string; assignedWeeklyHours: number }[],
  ): Promise<boolean>;
  saveProfile(
    context: TenantContext,
    academicYearId: string,
    teacherId: string,
    input: {
      minimumWorkload: number;
      requiredWorkload: number;
      maximumWorkload: number;
      overtimeAllowance: number;
      dailyMinimum: number;
      dailyMaximum: number;
      maxConsecutive: number;
    },
  ): Promise<boolean>;
  saveAvailability(
    context: TenantContext,
    academicYearId: string,
    teacherId: string,
    slots: {
      periodId: string;
      schoolDayId: string;
      status: AvailabilityStatus;
    }[],
  ): Promise<boolean>;
}

export function createTeacherRepository<TQueryResult extends PgQueryResultHKT>(
  db: PgDatabase<TQueryResult, typeof schema>,
): TeacherRepository {
  return {
    async getWorkspace(context, selectedTeacherId) {
      const [activeYear] = await db
        .select({ id: academicYears.id, title: academicYears.title })
        .from(academicYears)
        .where(
          and(
            eq(academicYears.schoolId, context.schoolId),
            eq(academicYears.isActive, true),
          ),
        )
        .limit(1);
      const [teacherRows, subjectRows] = await Promise.all([
        db
          .select({
            id: teachers.id,
            firstName: teachers.firstName,
            lastName: teachers.lastName,
            personnelCode: teachers.personnelCode,
            employmentType: teachers.employmentType,
            staffKind: teachers.staffKind,
            isActive: teachers.isActive,
          })
          .from(teachers)
          .where(eq(teachers.schoolId, context.schoolId))
          .orderBy(asc(teachers.lastName), asc(teachers.firstName)),
        db
          .select({
            id: subjects.id,
            name: subjects.name,
            isActive: subjects.isActive,
          })
          .from(subjects)
          .where(eq(subjects.schoolId, context.schoolId))
          .orderBy(asc(subjects.name)),
      ]);
      const selectedId = teacherRows.some(
        (teacher) => teacher.id === selectedTeacherId,
      )
        ? selectedTeacherId
        : teacherRows[0]?.id;
      if (!activeYear)
        return {
          activeAcademicYear: null,
          teachers: teacherRows,
          selectedTeacher: null,
          subjects: subjectRows,
          schoolDays: [],
        };
      const [dayRows, periodRows] = await Promise.all([
        db
          .select({
            id: schoolDays.id,
            label: schoolDays.label,
            sortOrder: schoolDays.sortOrder,
          })
          .from(schoolDays)
          .where(
            and(
              eq(schoolDays.schoolId, context.schoolId),
              eq(schoolDays.academicYearId, activeYear.id),
              eq(schoolDays.isActive, true),
            ),
          )
          .orderBy(asc(schoolDays.sortOrder)),
        db
          .select({
            id: periods.id,
            schoolDayId: periods.schoolDayId,
            position: periods.position,
            label: periods.label,
            startTime: periods.startTime,
            endTime: periods.endTime,
          })
          .from(periods)
          .where(
            and(
              eq(periods.schoolId, context.schoolId),
              eq(periods.academicYearId, activeYear.id),
              eq(periods.isActive, true),
            ),
          )
          .orderBy(asc(periods.position)),
      ]);
      const schoolDaysView = dayRows.map((day) => ({
        ...day,
        periods: periodRows.filter((period) => period.schoolDayId === day.id),
      }));
      if (!selectedId)
        return {
          activeAcademicYear: activeYear,
          teachers: teacherRows,
          selectedTeacher: null,
          subjects: subjectRows,
          schoolDays: schoolDaysView,
        };
      const [base] = await db
        .select({
          id: teachers.id,
          firstName: teachers.firstName,
          lastName: teachers.lastName,
          personnelCode: teachers.personnelCode,
          employmentType: teachers.employmentType,
          staffKind: teachers.staffKind,
          isActive: teachers.isActive,
          notes: teachers.notes,
        })
        .from(teachers)
        .where(
          and(
            eq(teachers.id, selectedId),
            eq(teachers.schoolId, context.schoolId),
          ),
        )
        .limit(1);
      if (!base)
        return {
          activeAcademicYear: activeYear,
          teachers: teacherRows,
          selectedTeacher: null,
          subjects: subjectRows,
          schoolDays: schoolDaysView,
        };
      const [teacherSubjectRows, profileRows, availabilityRows] =
        await Promise.all([
          db
            .select({
              subjectId: teacherSubjectAssignments.subjectId,
              assignedWeeklyHours:
                teacherSubjectAssignments.assignedWeeklyHours,
            })
            .from(teacherSubjectAssignments)
            .where(
              and(
                eq(teacherSubjectAssignments.teacherId, selectedId),
                eq(teacherSubjectAssignments.academicYearId, activeYear.id),
                eq(teacherSubjectAssignments.schoolId, context.schoolId),
              ),
            ),
          db
            .select({
              minimumWorkload: teacherYearProfiles.minimumWorkload,
              requiredWorkload: teacherYearProfiles.requiredWorkload,
              maximumWorkload: teacherYearProfiles.maximumWorkload,
              overtimeAllowance: teacherYearProfiles.overtimeAllowance,
              dailyMinimum: teacherYearProfiles.dailyMinimum,
              dailyMaximum: teacherYearProfiles.dailyMaximum,
              maxConsecutive: teacherYearProfiles.maxConsecutive,
            })
            .from(teacherYearProfiles)
            .where(
              and(
                eq(teacherYearProfiles.teacherId, selectedId),
                eq(teacherYearProfiles.academicYearId, activeYear.id),
                eq(teacherYearProfiles.schoolId, context.schoolId),
              ),
            )
            .limit(1),
          db
            .select({
              periodId: teacherAvailability.periodId,
              status: teacherAvailability.status,
            })
            .from(teacherAvailability)
            .where(
              and(
                eq(teacherAvailability.teacherId, selectedId),
                eq(teacherAvailability.academicYearId, activeYear.id),
                eq(teacherAvailability.schoolId, context.schoolId),
              ),
            ),
        ]);
      return {
        activeAcademicYear: activeYear,
        teachers: teacherRows,
        selectedTeacher: {
          ...base,
          subjectAssignments: teacherSubjectRows,
          profile: profileRows[0] ?? null,
          availability: Object.fromEntries(
            availabilityRows.map((row) => [row.periodId, row.status]),
          ),
        },
        subjects: subjectRows,
        schoolDays: schoolDaysView,
      };
    },
    async createTeacher(context, input) {
      const [created] = await db
        .insert(teachers)
        .values({ schoolId: context.schoolId, ...input })
        .returning({ id: teachers.id });
      return created.id;
    },
    async updateTeacher(context, teacherId, input) {
      const [updated] = await db
        .update(teachers)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(teachers.id, teacherId),
            eq(teachers.schoolId, context.schoolId),
          ),
        )
        .returning({ id: teachers.id });
      return Boolean(updated);
    },
    async saveSubjectAssignments(
      context,
      academicYearId,
      teacherId,
      assignments,
    ) {
      return db.transaction(async (tx) => {
        const [teacher, year] = await Promise.all([
          tx
            .select({ id: teachers.id })
            .from(teachers)
            .where(
              and(
                eq(teachers.id, teacherId),
                eq(teachers.schoolId, context.schoolId),
              ),
            )
            .limit(1),
          tx
            .select({ id: academicYears.id })
            .from(academicYears)
            .where(
              and(
                eq(academicYears.id, academicYearId),
                eq(academicYears.schoolId, context.schoolId),
              ),
            )
            .limit(1),
        ]);
        if (!teacher[0] || !year[0]) return false;
        const subjectIds = assignments.map((item) => item.subjectId);
        if (assignments.length) {
          const ownedSubjects = await tx
            .select({ id: subjects.id })
            .from(subjects)
            .where(
              and(
                eq(subjects.schoolId, context.schoolId),
                inArray(subjects.id, subjectIds),
              ),
            );
          if (ownedSubjects.length !== new Set(subjectIds).size) return false;
        }
        await tx
          .delete(teacherSubjectAssignments)
          .where(
            and(
              eq(teacherSubjectAssignments.academicYearId, academicYearId),
              eq(teacherSubjectAssignments.teacherId, teacherId),
              eq(teacherSubjectAssignments.schoolId, context.schoolId),
            ),
          );
        if (assignments.length)
          await tx
            .insert(teacherSubjectAssignments)
            .values(
              assignments.map((item) => ({
                schoolId: context.schoolId,
                academicYearId,
                teacherId,
                ...item,
              })),
            );
        return true;
      });
    },
    async saveProfile(context, academicYearId, teacherId, input) {
      const [teacher, year] = await Promise.all([
        db
          .select({ id: teachers.id })
          .from(teachers)
          .where(
            and(
              eq(teachers.id, teacherId),
              eq(teachers.schoolId, context.schoolId),
            ),
          )
          .limit(1),
        db
          .select({ id: academicYears.id })
          .from(academicYears)
          .where(
            and(
              eq(academicYears.id, academicYearId),
              eq(academicYears.schoolId, context.schoolId),
            ),
          )
          .limit(1),
      ]);
      if (!teacher[0] || !year[0]) return false;
      const [existing] = await db
        .select({ id: teacherYearProfiles.id })
        .from(teacherYearProfiles)
        .where(
          and(
            eq(teacherYearProfiles.academicYearId, academicYearId),
            eq(teacherYearProfiles.teacherId, teacherId),
            eq(teacherYearProfiles.schoolId, context.schoolId),
          ),
        )
        .limit(1);
      if (existing)
        await db
          .update(teacherYearProfiles)
          .set({ ...input, updatedAt: new Date() })
          .where(
            and(
              eq(teacherYearProfiles.id, existing.id),
              eq(teacherYearProfiles.schoolId, context.schoolId),
            ),
          );
      else
        await db
          .insert(teacherYearProfiles)
          .values({
            schoolId: context.schoolId,
            academicYearId,
            teacherId,
            ...input,
          });
      return true;
    },
    async saveAvailability(context, academicYearId, teacherId, slots) {
      return db.transaction(async (tx) => {
        const [teacher, year] = await Promise.all([
          tx
            .select({ id: teachers.id })
            .from(teachers)
            .where(
              and(
                eq(teachers.id, teacherId),
                eq(teachers.schoolId, context.schoolId),
              ),
            )
            .limit(1),
          tx
            .select({ id: academicYears.id })
            .from(academicYears)
            .where(
              and(
                eq(academicYears.id, academicYearId),
                eq(academicYears.schoolId, context.schoolId),
              ),
            )
            .limit(1),
        ]);
        if (!teacher[0] || !year[0]) return false;
        if (slots.length) {
          const ids = slots.map((slot) => slot.periodId);
          const ownedPeriods = await tx
            .select({ id: periods.id, schoolDayId: periods.schoolDayId })
            .from(periods)
            .where(
              and(
                eq(periods.schoolId, context.schoolId),
                eq(periods.academicYearId, academicYearId),
                inArray(periods.id, ids),
              ),
            );
          const ownedMap = new Map(
            ownedPeriods.map((period) => [period.id, period.schoolDayId]),
          );
          if (
            ownedMap.size !== new Set(ids).size ||
            slots.some(
              (slot) => ownedMap.get(slot.periodId) !== slot.schoolDayId,
            )
          )
            return false;
        }
        await tx
          .delete(teacherAvailability)
          .where(
            and(
              eq(teacherAvailability.academicYearId, academicYearId),
              eq(teacherAvailability.teacherId, teacherId),
              eq(teacherAvailability.schoolId, context.schoolId),
            ),
          );
        if (slots.length)
          await tx
            .insert(teacherAvailability)
            .values(
              slots.map((slot) => ({
                schoolId: context.schoolId,
                academicYearId,
                teacherId,
                ...slot,
              })),
            );
        return true;
      });
    },
  };
}
