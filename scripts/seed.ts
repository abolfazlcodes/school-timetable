import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { hashPassword } from "../src/modules/auth/password.ts";
import { defaultPattern, referenceClasses, referenceCurriculum, referenceId, referenceSubjectNames, referenceTeachers } from "./reference-school-data.ts";
import { resolveSeedIdentity, resolveSeedProfile } from "./seed-profile.ts";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL تنظیم نشده است.");
const seedProfile = resolveSeedProfile(process.env.SEED_PROFILE);
const isDeliverySeed = seedProfile === "shahid-beheshti";
const seedIdentity = resolveSeedIdentity(seedProfile);

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  vicePrincipal: "10000000-0000-4000-8000-000000000002",
  schoolA: "20000000-0000-4000-8000-000000000001",
  schoolB: "20000000-0000-4000-8000-000000000002",
  schoolC: "20000000-0000-4000-8000-000000000003",
  year: "30000000-0000-4000-8000-000000000001",
  grade10: "31000000-0000-4000-8000-000000000001",
  grade11: "31000000-0000-4000-8000-000000000002",
  experimental: "32000000-0000-4000-8000-000000000001",
  classPlan: "33000000-0000-4000-8000-000000000001",
  english: "34000000-0000-4000-8000-000000000001",
  physics: "34000000-0000-4000-8000-000000000002",
  teacherA: "35000000-0000-4000-8000-000000000001",
  teacherB: "35000000-0000-4000-8000-000000000002",
};

const [adminPasswordHash, vicePrincipalPasswordHash] = await Promise.all([
  hashPassword(seedIdentity.admin.password),
  hashPassword(seedIdentity.vicePrincipal.password),
]);
const sql = postgres(connectionString, { max: 1 });

try {
  await sql.begin(async (transaction) => {
    if (isDeliverySeed) {
      const [unexpectedSchool] = await transaction`SELECT name FROM schools WHERE id <> ${ids.schoolC} LIMIT 1`;
      const [unexpectedUser] = await transaction`SELECT email FROM users WHERE id <> ${ids.admin} AND id <> ${ids.vicePrincipal} LIMIT 1`;
      if (unexpectedSchool || unexpectedUser) {
        throw new Error("seed تحویلی فقط باید روی پایگاه داده تازه اجرا شود؛ مدرسه یا کاربر دیگری در پایگاه داده وجود دارد.");
      }
    }

    await transaction`INSERT INTO users (id, email, full_name, password_hash)
      VALUES (${ids.admin}, ${seedIdentity.admin.email}, ${seedIdentity.admin.fullName}, ${adminPasswordHash}),
             (${ids.vicePrincipal}, ${seedIdentity.vicePrincipal.email}, ${seedIdentity.vicePrincipal.fullName}, ${vicePrincipalPasswordHash})
      ON CONFLICT (id) DO UPDATE SET email = excluded.email, full_name = excluded.full_name, password_hash = excluded.password_hash, is_active = true, updated_at = now()`;

    if (isDeliverySeed) {
      await transaction`INSERT INTO schools (id, name, code, province, city, phone)
        VALUES (${ids.schoolC}, 'دبیرستان شهید بهشتی', '140506', 'مرکزی', 'خنداب', null)
        ON CONFLICT (id) DO UPDATE SET name = excluded.name, code = excluded.code, is_active = true, updated_at = now()`;
      await transaction`INSERT INTO school_memberships (user_id, school_id, role)
        VALUES (${ids.admin}, ${ids.schoolC}, 'ADMIN'),
               (${ids.vicePrincipal}, ${ids.schoolC}, 'VICE_PRINCIPAL')
        ON CONFLICT (user_id, school_id) DO UPDATE SET role = excluded.role`;
    } else {
      await transaction`INSERT INTO schools (id, name, code, province, city, phone)
        VALUES (${ids.schoolA}, 'دبیرستان فرزانگان', '29103', 'تهران', 'تهران', '02144000000'),
               (${ids.schoolB}, 'دبیرستان دانا', '47218', 'البرز', 'کرج', '02632000000'),
               (${ids.schoolC}, 'دبیرستان شهید بهشتی', '140506', 'مرکزی', 'خنداب', null)
        ON CONFLICT (id) DO UPDATE SET name = excluded.name, code = excluded.code, is_active = true, updated_at = now()`;
      await transaction`INSERT INTO school_memberships (user_id, school_id, role)
        VALUES (${ids.admin}, ${ids.schoolA}, 'ADMIN'),
               (${ids.admin}, ${ids.schoolB}, 'ADMIN'),
               (${ids.admin}, ${ids.schoolC}, 'ADMIN'),
               (${ids.vicePrincipal}, ${ids.schoolA}, 'VICE_PRINCIPAL')
        ON CONFLICT (user_id, school_id) DO UPDATE SET role = excluded.role`;
    }

    if (!isDeliverySeed) {
    await transaction`INSERT INTO academic_years (id, school_id, title, start_year, end_year, is_active)
      VALUES (${ids.year}, ${ids.schoolA}, '۱۴۰۵–۱۴۰۶', 1405, 1406, true)
      ON CONFLICT (id) DO UPDATE SET title = excluded.title, is_active = true`;
    await transaction`INSERT INTO grades (id, school_id, name, code, sort_order)
      VALUES (${ids.grade10}, ${ids.schoolA}, 'پایه دهم', '10', 10),
             (${ids.grade11}, ${ids.schoolA}, 'پایه یازدهم', '11', 11)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, is_active = true`;
    await transaction`INSERT INTO majors (id, school_id, name, code)
      VALUES (${ids.experimental}, ${ids.schoolA}, 'علوم تجربی', 'EXP')
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, is_active = true`;
    await transaction`INSERT INTO class_plans (id, school_id, academic_year_id, grade_id, major_id, student_count, max_class_capacity)
      VALUES (${ids.classPlan}, ${ids.schoolA}, ${ids.year}, ${ids.grade10}, ${ids.experimental}, 73, 28)
      ON CONFLICT (id) DO UPDATE SET student_count = excluded.student_count, max_class_capacity = excluded.max_class_capacity, updated_at = now()`;
    await transaction`INSERT INTO class_groups (id, school_id, academic_year_id, class_plan_id, grade_id, major_id, name, student_count, max_capacity)
      VALUES ('33100000-0000-4000-8000-000000000001', ${ids.schoolA}, ${ids.year}, ${ids.classPlan}, ${ids.grade10}, ${ids.experimental}, 'دهم تجربی ۱', 25, 28),
             ('33100000-0000-4000-8000-000000000002', ${ids.schoolA}, ${ids.year}, ${ids.classPlan}, ${ids.grade10}, ${ids.experimental}, 'دهم تجربی ۲', 24, 28),
             ('33100000-0000-4000-8000-000000000003', ${ids.schoolA}, ${ids.year}, ${ids.classPlan}, ${ids.grade10}, ${ids.experimental}, 'دهم تجربی ۳', 24, 28)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, student_count = excluded.student_count, max_capacity = excluded.max_capacity, is_active = true, updated_at = now()`;
    await transaction`INSERT INTO subjects (id, school_id, name, code)
      VALUES (${ids.english}, ${ids.schoolA}, 'زبان انگلیسی', 'ENG'),
             (${ids.physics}, ${ids.schoolA}, 'فیزیک', 'PHY')
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, is_active = true`;
    await transaction`INSERT INTO curriculum_items (school_id, academic_year_id, grade_id, major_id, subject_id, weekly_hours, session_count, session_pattern)
      VALUES (${ids.schoolA}, ${ids.year}, ${ids.grade10}, ${ids.experimental}, ${ids.english}, 4, 2, '[2,2]'::jsonb),
             (${ids.schoolA}, ${ids.year}, ${ids.grade10}, ${ids.experimental}, ${ids.physics}, 3, 2, '[2,1]'::jsonb)
      ON CONFLICT (academic_year_id, grade_id, major_id, subject_id) WHERE major_id IS NOT NULL
      DO UPDATE SET weekly_hours = excluded.weekly_hours, session_count = excluded.session_count, session_pattern = excluded.session_pattern, is_active = true, updated_at = now()`;
    await transaction`INSERT INTO school_days (id, school_id, academic_year_id, day_of_week, label, sort_order)
      VALUES ('36000000-0000-4000-8000-000000000001', ${ids.schoolA}, ${ids.year}, 0, 'شنبه', 0),
             ('36000000-0000-4000-8000-000000000002', ${ids.schoolA}, ${ids.year}, 1, 'یکشنبه', 1),
             ('36000000-0000-4000-8000-000000000003', ${ids.schoolA}, ${ids.year}, 2, 'دوشنبه', 2),
             ('36000000-0000-4000-8000-000000000004', ${ids.schoolA}, ${ids.year}, 3, 'سه‌شنبه', 3),
             ('36000000-0000-4000-8000-000000000005', ${ids.schoolA}, ${ids.year}, 4, 'چهارشنبه', 4),
             ('36000000-0000-4000-8000-000000000006', ${ids.schoolA}, ${ids.year}, 5, 'پنجشنبه', 5)
      ON CONFLICT (academic_year_id, day_of_week) DO UPDATE SET label = excluded.label, sort_order = excluded.sort_order, is_active = true`;
    await transaction`UPDATE periods SET is_active = false
      WHERE school_id = ${ids.schoolA} AND academic_year_id = ${ids.year}`;
    await transaction`INSERT INTO periods (school_id, academic_year_id, school_day_id, position, label, start_time, end_time, break_after_minutes)
      SELECT ${ids.schoolA}, ${ids.year}, day.id, slot.position, 'زنگ ' || slot.position,
        (ARRAY['08:00','09:25','11:00','12:30']::time[])[slot.position],
        (ARRAY['09:15','10:45','12:25','13:20']::time[])[slot.position],
        (ARRAY[10,15,0,0]::integer[])[slot.position]
      FROM school_days day CROSS JOIN generate_series(1, 4) AS slot(position)
      WHERE day.school_id = ${ids.schoolA} AND day.academic_year_id = ${ids.year}
      ON CONFLICT (school_day_id, position) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time, break_after_minutes = excluded.break_after_minutes, is_active = true`;
    await transaction`INSERT INTO school_day_schedules (school_id, academic_year_id, school_day_id, mode, start_time, end_time, period_count, default_break_minutes)
      SELECT ${ids.schoolA}, ${ids.year}, day.id, 'MANUAL', '08:00', '13:20', 4, 10
      FROM school_days day
      WHERE day.school_id = ${ids.schoolA} AND day.academic_year_id = ${ids.year}
      ON CONFLICT (school_day_id) DO UPDATE SET mode = excluded.mode, start_time = excluded.start_time, end_time = excluded.end_time, period_count = excluded.period_count, default_break_minutes = excluded.default_break_minutes, updated_at = now()`;
    await transaction`DELETE FROM school_breaks WHERE school_id = ${ids.schoolA} AND academic_year_id = ${ids.year}`;
    await transaction`INSERT INTO school_breaks (school_id, academic_year_id, school_day_id, after_period_position, kind, start_time, end_time)
      SELECT ${ids.schoolA}, ${ids.year}, day.id, pause.position, pause.kind::intermission_kind, pause.start_time::time, pause.end_time::time
      FROM school_days day CROSS JOIN (VALUES
        (1, 'BREAK', '09:15', '09:25'),
        (2, 'BREAK', '10:45', '11:00'),
        (3, 'TRANSITION', '12:25', '12:30')
      ) AS pause(position, kind, start_time, end_time)
      WHERE day.school_id = ${ids.schoolA} AND day.academic_year_id = ${ids.year}`;
    await transaction`INSERT INTO teachers (id, school_id, first_name, last_name, personnel_code, employment_type, staff_kind, notes)
      VALUES (${ids.teacherA}, ${ids.schoolA}, 'ابوالفضل', 'جمشیدی', 'T-1042', 'FULL_TIME', 'TEACHER', 'دبیر زبان انگلیسی'),
             (${ids.teacherB}, ${ids.schoolA}, 'سارا', 'رضایی', 'T-1088', 'FULL_TIME', 'VICE_PRINCIPAL', 'معاون دارای ساعت تدریس')
      ON CONFLICT (id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, is_active = true, updated_at = now()`;
    await transaction`INSERT INTO teacher_subject_assignments (school_id, academic_year_id, teacher_id, subject_id, assigned_weekly_hours)
      VALUES (${ids.schoolA}, ${ids.year}, ${ids.teacherA}, ${ids.english}, 12), (${ids.schoolA}, ${ids.year}, ${ids.teacherB}, ${ids.physics}, 9)
      ON CONFLICT (academic_year_id, teacher_id, subject_id) DO UPDATE SET assigned_weekly_hours = excluded.assigned_weekly_hours`;
    await transaction`INSERT INTO teacher_year_profiles (school_id, academic_year_id, teacher_id, minimum_workload, required_workload, maximum_workload, overtime_allowance, daily_minimum, daily_maximum, max_consecutive)
      VALUES (${ids.schoolA}, ${ids.year}, ${ids.teacherA}, 8, 12, 16, 4, 0, 6, 4),
             (${ids.schoolA}, ${ids.year}, ${ids.teacherB}, 4, 9, 10, 4, 0, 4, 4)
      ON CONFLICT (academic_year_id, teacher_id) DO UPDATE SET minimum_workload = excluded.minimum_workload, required_workload = excluded.required_workload, maximum_workload = excluded.maximum_workload, overtime_allowance = excluded.overtime_allowance, daily_maximum = excluded.daily_maximum, max_consecutive = excluded.max_consecutive, updated_at = now()`;
    await transaction`INSERT INTO teacher_availability (school_id, academic_year_id, teacher_id, school_day_id, period_id, status)
      SELECT ${ids.schoolA}, ${ids.year}, teacher.id, period.school_day_id, period.id,
        CASE WHEN teacher.id = ${ids.teacherB} AND day.day_of_week = 1 THEN 'UNAVAILABLE'::availability_status
             WHEN period.position = 1 THEN 'PREFERRED'::availability_status ELSE 'AVAILABLE'::availability_status END
      FROM teachers teacher CROSS JOIN periods period INNER JOIN school_days day ON day.id = period.school_day_id
      WHERE teacher.id IN (${ids.teacherA}, ${ids.teacherB}) AND period.school_id = ${ids.schoolA} AND period.academic_year_id = ${ids.year} AND period.is_active
      ON CONFLICT (academic_year_id, teacher_id, period_id) DO UPDATE SET status = excluded.status`;
    }

    const referenceTargets = isDeliverySeed
      ? [{ schoolId: ids.schoolC, yearId: referenceId(ids.schoolC, "year:1405"), includeStructure: true }]
      : [
          { schoolId: ids.schoolA, yearId: ids.year, includeStructure: false },
          { schoolId: ids.schoolB, yearId: referenceId(ids.schoolB, "year:1405"), includeStructure: true },
          { schoolId: ids.schoolC, yearId: referenceId(ids.schoolC, "year:1405"), includeStructure: true },
        ];
    const gradeLabels = { "10": "پایه دهم", "11": "پایه یازدهم", "12": "پایه دوازدهم" } as const;
    const majorLabels = { MATH: "ریاضی", SCIENCE: "علوم تجربی", HUMANITIES: "ادبیات و علوم انسانی" } as const;

    for (const target of referenceTargets) {
      const gradeIds = new Map<string, string>();
      const majorIds = new Map<string, string>();
      if (target.includeStructure) {
        await transaction`UPDATE academic_years SET is_active = false WHERE school_id = ${target.schoolId}`;
        const [year] = await transaction`INSERT INTO academic_years (id, school_id, title, start_year, end_year, is_active)
          VALUES (${target.yearId}, ${target.schoolId}, '۱۴۰۵–۱۴۰۶', 1405, 1406, true)
          ON CONFLICT (school_id, title) DO UPDATE SET start_year = excluded.start_year, end_year = excluded.end_year, is_active = true
          RETURNING id`;
        target.yearId = year.id;
        await transaction`UPDATE class_groups SET is_active = false, updated_at = now() WHERE school_id = ${target.schoolId} AND academic_year_id = ${target.yearId}`;
        await transaction`UPDATE curriculum_items SET is_active = false, updated_at = now() WHERE school_id = ${target.schoolId} AND academic_year_id = ${target.yearId}`;
        for (const [code, name] of Object.entries(gradeLabels)) {
          const [grade] = await transaction`INSERT INTO grades (id, school_id, name, code, sort_order)
            VALUES (${referenceId(target.schoolId, `grade:${code}`)}, ${target.schoolId}, ${name}, ${code}, ${Number(code)})
            ON CONFLICT (school_id, code) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order, is_active = true
            RETURNING id`;
          gradeIds.set(code, grade.id);
        }
        for (const [code, name] of Object.entries(majorLabels)) {
          const [existingMajor] = await transaction`SELECT id FROM majors WHERE school_id = ${target.schoolId} AND lower(name) = lower(${name}) LIMIT 1`;
          const majorId = existingMajor?.id ?? referenceId(target.schoolId, `major:${code}`);
          await transaction`INSERT INTO majors (id, school_id, name, code)
            VALUES (${majorId}, ${target.schoolId}, ${name}, ${code})
            ON CONFLICT (id) DO UPDATE SET name = excluded.name, code = excluded.code, is_active = true`;
          majorIds.set(code, majorId);
        }
      }

      const subjectIds = new Map<string, string>();
      for (const [index, name] of referenceSubjectNames.entries()) {
        const subjectId = target.schoolId === ids.schoolA && name === "زبان انگلیسی" ? ids.english
          : target.schoolId === ids.schoolA && name === "فیزیک" ? ids.physics
          : referenceId(target.schoolId, `subject:${name}`);
        const [existingSubject] = await transaction`SELECT id FROM subjects WHERE school_id = ${target.schoolId} AND lower(name) = lower(${name}) LIMIT 1`;
        const resolvedSubjectId = existingSubject?.id ?? subjectId;
        subjectIds.set(name, resolvedSubjectId);
        await transaction`INSERT INTO subjects (id, school_id, name, code)
          VALUES (${resolvedSubjectId}, ${target.schoolId}, ${name}, ${`REF-${String(index + 1).padStart(2, "0")}`})
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, code = excluded.code, is_active = true`;
      }

      if (target.includeStructure) {
        const scopes = new Map<string, typeof referenceClasses[number][]>();
        for (const schoolClass of referenceClasses) {
          const scopeKey = `${schoolClass.grade}:${schoolClass.major}`;
          scopes.set(scopeKey, [...(scopes.get(scopeKey) ?? []), schoolClass]);
        }
        for (const [scopeKey, scopedClasses] of scopes) {
          const [gradeCode, majorCode] = scopeKey.split(":") as [keyof typeof gradeLabels, keyof typeof majorLabels];
          const gradeId = gradeIds.get(gradeCode)!;
          const majorId = majorIds.get(majorCode)!;
          const studentCount = scopedClasses.reduce((sum, schoolClass) => sum + schoolClass.students, 0);
          const [plan] = await transaction`INSERT INTO class_plans (id, school_id, academic_year_id, grade_id, major_id, student_count, max_class_capacity, class_count_override)
            VALUES (${referenceId(target.schoolId, `plan:${gradeId}:${majorId}`)}, ${target.schoolId}, ${target.yearId}, ${gradeId}, ${majorId}, ${studentCount}, 28, ${scopedClasses.length})
            ON CONFLICT (academic_year_id, grade_id, major_id) WHERE major_id IS NOT NULL
            DO UPDATE SET student_count = excluded.student_count, max_class_capacity = excluded.max_class_capacity, class_count_override = excluded.class_count_override, updated_at = now()
            RETURNING id`;
          for (const schoolClass of scopedClasses) {
            await transaction`INSERT INTO class_groups (id, school_id, academic_year_id, class_plan_id, grade_id, major_id, name, student_count, max_capacity)
              VALUES (${referenceId(target.schoolId, `class:${schoolClass.key}`)}, ${target.schoolId}, ${target.yearId}, ${plan.id}, ${gradeId}, ${majorId}, ${schoolClass.name}, ${schoolClass.students}, 28)
              ON CONFLICT (id) DO UPDATE SET academic_year_id = excluded.academic_year_id, class_plan_id = excluded.class_plan_id, grade_id = excluded.grade_id, major_id = excluded.major_id, name = excluded.name, student_count = excluded.student_count, max_capacity = excluded.max_capacity, is_active = true, updated_at = now()`;
          }
        }
        for (const item of referenceCurriculum) {
          const pattern = item.pattern ?? defaultPattern(item.hours);
          await transaction`INSERT INTO curriculum_items (school_id, academic_year_id, grade_id, major_id, subject_id, weekly_hours, session_count, session_pattern)
            VALUES (${target.schoolId}, ${target.yearId}, ${gradeIds.get(item.grade)!}, ${majorIds.get(item.major)!}, ${subjectIds.get(item.subject)!}, ${item.hours}, ${pattern.length}, ${transaction.json(pattern)})
            ON CONFLICT (academic_year_id, grade_id, major_id, subject_id) WHERE major_id IS NOT NULL
            DO UPDATE SET weekly_hours = excluded.weekly_hours, session_count = excluded.session_count, session_pattern = excluded.session_pattern, is_active = true, updated_at = now()`;
        }
        const dayLabels = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"];
        for (const [dayOfWeek, label] of dayLabels.entries()) {
          await transaction`INSERT INTO school_days (id, school_id, academic_year_id, day_of_week, label, sort_order)
            VALUES (${referenceId(target.schoolId, `day:${dayOfWeek}`)}, ${target.schoolId}, ${target.yearId}, ${dayOfWeek}, ${label}, ${dayOfWeek})
            ON CONFLICT (academic_year_id, day_of_week) DO UPDATE SET label = excluded.label, sort_order = excluded.sort_order, is_active = true`;
        }
        await transaction`INSERT INTO periods (school_id, academic_year_id, school_day_id, position, label, start_time, end_time, break_after_minutes)
          SELECT ${target.schoolId}, ${target.yearId}, day.id, slot.position, 'زنگ ' || slot.position,
            (ARRAY['08:00','09:25','11:00','12:30']::time[])[slot.position],
            (ARRAY['09:15','10:45','12:25','13:20']::time[])[slot.position],
            (ARRAY[10,15,5,0]::integer[])[slot.position]
          FROM school_days day CROSS JOIN generate_series(1, 4) AS slot(position)
          WHERE day.school_id = ${target.schoolId} AND day.academic_year_id = ${target.yearId}
          ON CONFLICT (school_day_id, position) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time, break_after_minutes = excluded.break_after_minutes, is_active = true`;
        await transaction`INSERT INTO school_day_schedules (school_id, academic_year_id, school_day_id, mode, start_time, end_time, period_count, default_break_minutes)
          SELECT ${target.schoolId}, ${target.yearId}, day.id, 'MANUAL', '08:00', '13:20', 4, 10
          FROM school_days day WHERE day.school_id = ${target.schoolId} AND day.academic_year_id = ${target.yearId}
          ON CONFLICT (school_day_id) DO UPDATE SET mode = excluded.mode, start_time = excluded.start_time, end_time = excluded.end_time, period_count = excluded.period_count, default_break_minutes = excluded.default_break_minutes, updated_at = now()`;
        await transaction`DELETE FROM school_breaks WHERE school_id = ${target.schoolId} AND academic_year_id = ${target.yearId}`;
        await transaction`INSERT INTO school_breaks (school_id, academic_year_id, school_day_id, after_period_position, kind, start_time, end_time)
          SELECT ${target.schoolId}, ${target.yearId}, day.id, pause.position, pause.kind::intermission_kind, pause.start_time::time, pause.end_time::time
          FROM school_days day CROSS JOIN (VALUES (1, 'BREAK', '09:15', '09:25'), (2, 'BREAK', '10:45', '11:00'), (3, 'TRANSITION', '12:25', '12:30')) AS pause(position, kind, start_time, end_time)
          WHERE day.school_id = ${target.schoolId} AND day.academic_year_id = ${target.yearId}`;
      }

      for (const [index, teacher] of referenceTeachers.entries()) {
        const teacherId = target.schoolId === ids.schoolA && teacher.key === "abolfazl-jamshidi" ? ids.teacherA : referenceId(target.schoolId, `teacher:${teacher.key}`);
        const personnelCode = target.schoolId === ids.schoolA && teacher.key === "abolfazl-jamshidi" ? "T-1042" : `REF-1405-${String(index + 1).padStart(2, "0")}`;
        if (target.includeStructure) await transaction`UPDATE teachers SET is_active = false, updated_at = now() WHERE school_id = ${target.schoolId} AND first_name = ${teacher.firstName} AND last_name = ${teacher.lastName} AND id <> ${teacherId}`;
        await transaction`INSERT INTO teachers (id, school_id, first_name, last_name, personnel_code, employment_type, staff_kind, notes)
          VALUES (${teacherId}, ${target.schoolId}, ${teacher.firstName}, ${teacher.lastName}, ${personnelCode}, ${teacher.workload >= 18 ? "FULL_TIME" : "PART_TIME"}::employment_type, 'TEACHER', 'داده مرجع دبیرستان شهید بهشتی، سال ۱۴۰۵–۱۴۰۶')
          ON CONFLICT (id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, employment_type = excluded.employment_type, notes = excluded.notes, is_active = true, updated_at = now()`;
        await transaction`DELETE FROM teacher_subject_assignments WHERE school_id = ${target.schoolId} AND academic_year_id = ${target.yearId} AND teacher_id = ${teacherId}`;
        for (const [subjectName, assignedWeeklyHours] of Object.entries(teacher.assignments)) {
          await transaction`INSERT INTO teacher_subject_assignments (school_id, academic_year_id, teacher_id, subject_id, assigned_weekly_hours)
            VALUES (${target.schoolId}, ${target.yearId}, ${teacherId}, ${subjectIds.get(subjectName)!}, ${assignedWeeklyHours})`;
        }
        await transaction`INSERT INTO teacher_year_profiles (school_id, academic_year_id, teacher_id, minimum_workload, required_workload, maximum_workload, overtime_allowance, daily_minimum, daily_maximum, max_consecutive)
          VALUES (${target.schoolId}, ${target.yearId}, ${teacherId}, ${teacher.workload}, ${teacher.workload}, ${teacher.workload}, 0, 0, 4, 4)
          ON CONFLICT (academic_year_id, teacher_id) DO UPDATE SET minimum_workload = excluded.minimum_workload, required_workload = excluded.required_workload, maximum_workload = excluded.maximum_workload, overtime_allowance = excluded.overtime_allowance, daily_maximum = excluded.daily_maximum, max_consecutive = excluded.max_consecutive, updated_at = now()`;
        await transaction`INSERT INTO teacher_availability (school_id, academic_year_id, teacher_id, school_day_id, period_id, status)
          SELECT ${target.schoolId}, ${target.yearId}, ${teacherId}, period.school_day_id, period.id,
            CASE WHEN day.day_of_week = ANY(${teacher.attendanceDays}::integer[]) THEN 'PREFERRED'::availability_status ELSE 'AVAILABLE'::availability_status END
          FROM periods period INNER JOIN school_days day ON day.id = period.school_day_id
          WHERE period.school_id = ${target.schoolId} AND period.academic_year_id = ${target.yearId} AND period.is_active
          ON CONFLICT (academic_year_id, teacher_id, period_id) DO UPDATE SET status = excluded.status`;
      }

      if (isDeliverySeed && target.schoolId === ids.schoolC) {
        const hamidTeacherId = referenceId(ids.schoolC, "teacher:hamid-bagheri");
        const persianSubjectId = subjectIds.get("فارسی");
        if (!persianSubjectId) throw new Error("درس فارسی در داده مرجع پیدا نشد.");
        await transaction`INSERT INTO teachers (id, school_id, first_name, last_name, personnel_code, employment_type, staff_kind, notes)
          VALUES (${hamidTeacherId}, ${ids.schoolC}, 'حمید', 'باقری', 'PENDING-HB', 'FULL_TIME', 'VICE_PRINCIPAL', 'معاون و دبیر فارسی؛ کد پرسنلی، موظفی، ساعات تخصیص و حضور باید توسط مدرسه تکمیل شود.')
          ON CONFLICT (id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, staff_kind = excluded.staff_kind, notes = excluded.notes, is_active = true, updated_at = now()`;
        await transaction`INSERT INTO teacher_subject_assignments (school_id, academic_year_id, teacher_id, subject_id, assigned_weekly_hours)
          VALUES (${ids.schoolC}, ${target.yearId}, ${hamidTeacherId}, ${persianSubjectId}, 0)
          ON CONFLICT (academic_year_id, teacher_id, subject_id) DO NOTHING`;
      }
    }
  });
  if (isDeliverySeed) {
    console.log("Delivery data seeded: دبیرستان شهید بهشتی و دو حساب مجاز.");
    console.log(`Admin: ${seedIdentity.admin.email}`);
    console.log(`Vice principal: ${seedIdentity.vicePrincipal.email} / حمید باقری`);
    console.log("Passwords were read from environment variables and are not printed.");
  } else {
    console.log("Demo data seeded.");
    console.log(`${seedIdentity.admin.email} / ${seedIdentity.admin.password}`);
    console.log(`${seedIdentity.vicePrincipal.email} / ${seedIdentity.vicePrincipal.password}`);
  }
} finally {
  await sql.end();
}
