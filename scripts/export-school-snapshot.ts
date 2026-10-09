import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";

const connectionString = process.env.SNAPSHOT_DATABASE_URL;
const schoolCode = process.env.SNAPSHOT_SCHOOL_CODE ?? "140506";

if (!connectionString) {
  throw new Error(
    "SNAPSHOT_DATABASE_URL تنظیم نشده است. برای جلوگیری از اتصال اشتباه، این ابزار عمداً از DATABASE_URL استفاده نمی‌کند.",
  );
}

const sql = postgres(connectionString, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});

try {
  const [school] = await sql`
    SELECT id, name, code, province, city, phone, is_active AS "isActive"
    FROM schools
    WHERE code = ${schoolCode}
    LIMIT 1
  `;

  if (!school) {
    throw new Error(`مدرسه‌ای با کد ${schoolCode} پیدا نشد.`);
  }

  const [activeYear] = await sql`
    SELECT id, title, start_year AS "startYear", end_year AS "endYear"
    FROM academic_years
    WHERE school_id = ${school.id} AND is_active = true
    LIMIT 1
  `;

  if (!activeYear) {
    throw new Error("سال تحصیلی فعالی برای مدرسه پیدا نشد.");
  }

  const [
    grades,
    majors,
    classes,
    subjects,
    curriculum,
    teachers,
    teacherProfiles,
    teacherSubjects,
    teacherAvailability,
    classTeacherAssignments,
    schoolDays,
    periods,
    daySchedules,
    breaks,
  ] = await Promise.all([
    sql`
      SELECT id, name, code, sort_order AS "sortOrder", is_active AS "isActive"
      FROM grades
      WHERE school_id = ${school.id}
      ORDER BY sort_order, name
    `,
    sql`
      SELECT id, name, code, is_active AS "isActive"
      FROM majors
      WHERE school_id = ${school.id}
      ORDER BY name
    `,
    sql`
      SELECT cg.id, cg.name, cg.student_count AS "studentCount",
             cg.max_capacity AS "maxCapacity", cg.is_active AS "isActive",
             g.name AS "gradeName", g.code AS "gradeCode",
             m.name AS "majorName", m.code AS "majorCode"
      FROM class_groups cg
      JOIN grades g ON g.id = cg.grade_id
      LEFT JOIN majors m ON m.id = cg.major_id
      WHERE cg.school_id = ${school.id} AND cg.academic_year_id = ${activeYear.id}
      ORDER BY g.sort_order, m.name NULLS FIRST, cg.name
    `,
    sql`
      SELECT id, name, code, is_active AS "isActive"
      FROM subjects
      WHERE school_id = ${school.id}
      ORDER BY name
    `,
    sql`
      SELECT ci.id, g.name AS "gradeName", g.code AS "gradeCode",
             m.name AS "majorName", m.code AS "majorCode",
             s.name AS "subjectName", s.code AS "subjectCode",
             ci.weekly_hours AS "weeklyHours",
             ci.session_count AS "sessionCount",
             ci.session_pattern AS "sessionPattern",
             ci.is_active AS "isActive"
      FROM curriculum_items ci
      JOIN grades g ON g.id = ci.grade_id
      LEFT JOIN majors m ON m.id = ci.major_id
      JOIN subjects s ON s.id = ci.subject_id
      WHERE ci.school_id = ${school.id} AND ci.academic_year_id = ${activeYear.id}
      ORDER BY g.sort_order, m.name NULLS FIRST, s.name
    `,
    sql`
      SELECT id, first_name AS "firstName", last_name AS "lastName",
             personnel_code AS "personnelCode",
             employment_type AS "employmentType", staff_kind AS "staffKind",
             is_active AS "isActive", notes
      FROM teachers
      WHERE school_id = ${school.id}
      ORDER BY last_name, first_name
    `,
    sql`
      SELECT t.first_name AS "firstName", t.last_name AS "lastName",
             t.personnel_code AS "personnelCode",
             typ.minimum_workload AS "minimumWorkload",
             typ.required_workload AS "requiredWorkload",
             typ.maximum_workload AS "maximumWorkload",
             typ.overtime_allowance AS "overtimeAllowance",
             typ.daily_minimum AS "dailyMinimum",
             typ.daily_maximum AS "dailyMaximum",
             typ.max_consecutive AS "maxConsecutive"
      FROM teacher_year_profiles typ
      JOIN teachers t ON t.id = typ.teacher_id
      WHERE typ.school_id = ${school.id} AND typ.academic_year_id = ${activeYear.id}
      ORDER BY t.last_name, t.first_name
    `,
    sql`
      SELECT t.first_name AS "firstName", t.last_name AS "lastName",
             t.personnel_code AS "personnelCode", s.name AS "subjectName",
             tsa.assigned_weekly_hours AS "assignedWeeklyHours"
      FROM teacher_subject_assignments tsa
      JOIN teachers t ON t.id = tsa.teacher_id
      JOIN subjects s ON s.id = tsa.subject_id
      WHERE tsa.school_id = ${school.id} AND tsa.academic_year_id = ${activeYear.id}
      ORDER BY t.last_name, t.first_name, s.name
    `,
    sql`
      SELECT t.first_name AS "firstName", t.last_name AS "lastName",
             t.personnel_code AS "personnelCode", sd.label AS "dayLabel",
             sd.day_of_week AS "dayOfWeek", p.position AS "periodPosition",
             p.label AS "periodLabel", ta.status
      FROM teacher_availability ta
      JOIN teachers t ON t.id = ta.teacher_id
      JOIN school_days sd ON sd.id = ta.school_day_id
      JOIN periods p ON p.id = ta.period_id
      WHERE ta.school_id = ${school.id} AND ta.academic_year_id = ${activeYear.id}
      ORDER BY t.last_name, t.first_name, sd.sort_order, p.position
    `,
    sql`
      SELECT cg.name AS "className", g.name AS "gradeName", m.name AS "majorName",
             s.name AS "subjectName", t.first_name AS "teacherFirstName",
             t.last_name AS "teacherLastName", t.personnel_code AS "personnelCode"
      FROM class_subject_teacher_assignments csta
      JOIN class_groups cg ON cg.id = csta.class_id
      JOIN grades g ON g.id = cg.grade_id
      LEFT JOIN majors m ON m.id = cg.major_id
      JOIN subjects s ON s.id = csta.subject_id
      JOIN teachers t ON t.id = csta.teacher_id
      WHERE csta.school_id = ${school.id} AND csta.academic_year_id = ${activeYear.id}
      ORDER BY g.sort_order, m.name NULLS FIRST, cg.name, s.name
    `,
    sql`
      SELECT id, day_of_week AS "dayOfWeek", label, sort_order AS "sortOrder",
             is_active AS "isActive"
      FROM school_days
      WHERE school_id = ${school.id} AND academic_year_id = ${activeYear.id}
      ORDER BY sort_order
    `,
    sql`
      SELECT sd.label AS "dayLabel", p.position, p.label,
             p.start_time AS "startTime", p.end_time AS "endTime",
             p.instructional_units AS "instructionalUnits",
             p.break_after_minutes AS "breakAfterMinutes", p.is_active AS "isActive"
      FROM periods p
      JOIN school_days sd ON sd.id = p.school_day_id
      WHERE p.school_id = ${school.id} AND p.academic_year_id = ${activeYear.id}
      ORDER BY sd.sort_order, p.position
    `,
    sql`
      SELECT sd.label AS "dayLabel", sds.mode,
             sds.start_time AS "startTime", sds.end_time AS "endTime",
             sds.period_count AS "periodCount",
             sds.default_break_minutes AS "defaultBreakMinutes"
      FROM school_day_schedules sds
      JOIN school_days sd ON sd.id = sds.school_day_id
      WHERE sds.school_id = ${school.id} AND sds.academic_year_id = ${activeYear.id}
      ORDER BY sd.sort_order
    `,
    sql`
      SELECT sd.label AS "dayLabel", sb.after_period_position AS "afterPeriodPosition",
             sb.kind, sb.start_time AS "startTime", sb.end_time AS "endTime"
      FROM school_breaks sb
      JOIN school_days sd ON sd.id = sb.school_day_id
      WHERE sb.school_id = ${school.id} AND sb.academic_year_id = ${activeYear.id}
      ORDER BY sd.sort_order, sb.after_period_position
    `,
  ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    source: "production-school-data-only",
    school,
    activeAcademicYear: activeYear,
    grades,
    majors,
    classes,
    subjects,
    curriculum,
    teachers,
    teacherProfiles,
    teacherSubjectAssignments: teacherSubjects,
    teacherAvailability,
    classSubjectTeacherAssignments: classTeacherAssignments,
    schoolDays,
    periods,
    schoolDaySchedules: daySchedules,
    schoolBreaks: breaks,
  };

  const outputDirectory = new URL("../docs-assets/exports/", import.meta.url);
  const outputFile = new URL(
    `shahid-beheshti-${schoolCode}-production-snapshot.json`,
    outputDirectory,
  );
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`خروجی امن مدرسه ساخته شد: ${outputFile.pathname}`);
  console.log(
    `سال ${activeYear.title}: ${classes.length} کلاس، ${teachers.length} دبیر، ${curriculum.length} ردیف برنامه درسی`,
  );
} finally {
  await sql.end();
}
