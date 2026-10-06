// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  academicYears,
  classGroups,
  classPlans,
  curriculumItems,
  grades,
  schools,
  subjects,
  teachers,
  teacherSubjectAssignments,
} from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";
import { createCurriculumRepository } from "./repository";

const migrationNames = [
  "0000_auth_and_schools.sql",
  "0001_planning_inputs.sql",
  "0002_planning_invariants.sql",
  "0003_schedule_runs.sql",
  "0004_schedule_workspaces.sql",
  "0005_schedule_versions.sql",
  "0006_hardening_invariants.sql",
  "0007_period_overlap_upsert.sql",
  "0008_school_day_timeline.sql",
  "0009_real_school_calibration.sql",
  "0010_class_subject_teacher_assignments.sql",
  "0011_period_instructional_units.sql",
  "0012_teacher_partial_name.sql",
];

const ids = {
  school: "20000000-0000-4000-8000-000000000001",
  year: "30000000-0000-4000-8000-000000000001",
  grade: "31000000-0000-4000-8000-000000000001",
  plan: "32000000-0000-4000-8000-000000000001",
  classGroup: "33000000-0000-4000-8000-000000000001",
  subject: "34000000-0000-4000-8000-000000000001",
  legacySubject: "34000000-0000-4000-8000-000000000002",
  activeTeacher: "35000000-0000-4000-8000-000000000001",
  inactiveTeacher: "35000000-0000-4000-8000-000000000002",
};

const context: TenantContext = {
  sessionId: "session",
  userId: "user",
  userName: "معاون",
  schoolId: ids.school,
  schoolName: "مدرسه آزمون",
  schoolCode: null,
  role: "VICE_PRINCIPAL",
};

describe("خلاصه برنامه درسی سال فعال", () => {
  it("ردیف‌های غیرفعال و تخصیص دبیر غیرفعال را در نیاز و پوشش حساب نمی‌کند", async () => {
    const client = new PGlite();
    try {
      for (const migrationName of migrationNames) {
        await client.exec(
          await readFile(
            new URL(`../../../migrations/${migrationName}`, import.meta.url),
            "utf8",
          ),
        );
      }
      const db = drizzle(client, { schema });
      await db.insert(schools).values({ id: ids.school, name: "مدرسه آزمون" });
      await db.insert(academicYears).values({
        id: ids.year,
        schoolId: ids.school,
        title: "۱۴۰۵–۱۴۰۶",
        startYear: 1405,
        endYear: 1406,
        isActive: true,
      });
      await db.insert(grades).values({
        id: ids.grade,
        schoolId: ids.school,
        name: "پایه دهم",
        code: "10",
      });
      await db.insert(classPlans).values({
        id: ids.plan,
        schoolId: ids.school,
        academicYearId: ids.year,
        gradeId: ids.grade,
        majorId: null,
        studentCount: 24,
        maxClassCapacity: 30,
      });
      await db.insert(classGroups).values({
        id: ids.classGroup,
        schoolId: ids.school,
        academicYearId: ids.year,
        classPlanId: ids.plan,
        gradeId: ids.grade,
        majorId: null,
        name: "دهم آزمون",
        studentCount: 24,
        maxCapacity: 30,
      });
      await db.insert(subjects).values([
        { id: ids.subject, schoolId: ids.school, name: "زبان انگلیسی" },
        { id: ids.legacySubject, schoolId: ids.school, name: "درس قدیمی" },
      ]);
      await db.insert(curriculumItems).values([
        {
          schoolId: ids.school,
          academicYearId: ids.year,
          gradeId: ids.grade,
          subjectId: ids.subject,
          weeklyHours: 4,
          sessionCount: 2,
          sessionPattern: [2, 2],
        },
        {
          schoolId: ids.school,
          academicYearId: ids.year,
          gradeId: ids.grade,
          subjectId: ids.legacySubject,
          weeklyHours: 2,
          sessionCount: 1,
          sessionPattern: [2],
          isActive: false,
        },
      ]);
      await db.insert(teachers).values([
        {
          id: ids.activeTeacher,
          schoolId: ids.school,
          firstName: "دبیر",
          lastName: "فعال",
          personnelCode: "T-ACTIVE",
          employmentType: "FULL_TIME",
        },
        {
          id: ids.inactiveTeacher,
          schoolId: ids.school,
          firstName: "دبیر",
          lastName: "قدیمی",
          personnelCode: "T-INACTIVE",
          employmentType: "FULL_TIME",
          isActive: false,
        },
      ]);
      await db.insert(teacherSubjectAssignments).values([
        {
          schoolId: ids.school,
          academicYearId: ids.year,
          teacherId: ids.activeTeacher,
          subjectId: ids.subject,
          assignedWeeklyHours: 4,
        },
        {
          schoolId: ids.school,
          academicYearId: ids.year,
          teacherId: ids.inactiveTeacher,
          subjectId: ids.subject,
          assignedWeeklyHours: 12,
        },
      ]);

      const workspace = await createCurriculumRepository(db).getWorkspace(context);

      expect(workspace.items).toHaveLength(1);
      expect(workspace.items[0]).toMatchObject({
        subjectName: "زبان انگلیسی",
        totalWorkload: 4,
      });
      expect(workspace.requirements).toEqual([
        expect.objectContaining({
          subjectName: "زبان انگلیسی",
          totalRequiredHours: 4,
          totalAssignedHours: 4,
        }),
      ]);
    } finally {
      await client.close();
    }
  }, 20_000);
});
