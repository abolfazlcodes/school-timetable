import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { hashPassword } from "../src/modules/auth/password.ts";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL تنظیم نشده است.");

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  vicePrincipal: "10000000-0000-4000-8000-000000000002",
  schoolA: "20000000-0000-4000-8000-000000000001",
  schoolB: "20000000-0000-4000-8000-000000000002",
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

const passwordHash = await hashPassword("Demo123!");
const sql = postgres(connectionString, { max: 1 });

try {
  await sql.begin(async (transaction) => {
    await transaction`INSERT INTO users (id, email, full_name, password_hash)
      VALUES (${ids.admin}, 'admin@madreseyar.ir', 'مریم نادری', ${passwordHash}),
             (${ids.vicePrincipal}, 'moaven@madreseyar.ir', 'رضا کریمی', ${passwordHash})
      ON CONFLICT (id) DO UPDATE SET full_name = excluded.full_name, password_hash = excluded.password_hash, is_active = true, updated_at = now()`;
    await transaction`INSERT INTO schools (id, name, code, province, city, phone)
      VALUES (${ids.schoolA}, 'دبیرستان فرزانگان', '29103', 'تهران', 'تهران', '02144000000'),
             (${ids.schoolB}, 'دبیرستان دانا', '47218', 'البرز', 'کرج', '02632000000')
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, code = excluded.code, is_active = true, updated_at = now()`;
    await transaction`INSERT INTO school_memberships (user_id, school_id, role)
      VALUES (${ids.admin}, ${ids.schoolA}, 'ADMIN'),
             (${ids.admin}, ${ids.schoolB}, 'ADMIN'),
             (${ids.vicePrincipal}, ${ids.schoolA}, 'VICE_PRINCIPAL')
      ON CONFLICT (user_id, school_id) DO UPDATE SET role = excluded.role`;

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
    await transaction`INSERT INTO curriculum_items (school_id, academic_year_id, grade_id, major_id, subject_id, weekly_periods, session_count, session_pattern)
      VALUES (${ids.schoolA}, ${ids.year}, ${ids.grade10}, ${ids.experimental}, ${ids.english}, 4, 2, '[2,2]'::jsonb),
             (${ids.schoolA}, ${ids.year}, ${ids.grade10}, ${ids.experimental}, ${ids.physics}, 3, 2, '[2,1]'::jsonb)
      ON CONFLICT (academic_year_id, grade_id, major_id, subject_id) WHERE major_id IS NOT NULL
      DO UPDATE SET weekly_periods = excluded.weekly_periods, session_count = excluded.session_count, session_pattern = excluded.session_pattern, is_active = true, updated_at = now()`;
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
    await transaction`INSERT INTO teacher_subjects (school_id, teacher_id, subject_id)
      VALUES (${ids.schoolA}, ${ids.teacherA}, ${ids.english}), (${ids.schoolA}, ${ids.teacherB}, ${ids.physics})
      ON CONFLICT (teacher_id, subject_id) DO NOTHING`;
    await transaction`INSERT INTO teacher_year_profiles (school_id, academic_year_id, teacher_id, minimum_workload, required_workload, maximum_workload, overtime_allowance, daily_minimum, daily_maximum, max_consecutive)
      VALUES (${ids.schoolA}, ${ids.year}, ${ids.teacherA}, 20, 24, 28, 4, 0, 6, 4),
             (${ids.schoolA}, ${ids.year}, ${ids.teacherB}, 4, 6, 10, 4, 0, 4, 4)
      ON CONFLICT (academic_year_id, teacher_id) DO UPDATE SET minimum_workload = excluded.minimum_workload, required_workload = excluded.required_workload, maximum_workload = excluded.maximum_workload, overtime_allowance = excluded.overtime_allowance, daily_maximum = excluded.daily_maximum, max_consecutive = excluded.max_consecutive, updated_at = now()`;
    await transaction`INSERT INTO teacher_availability (school_id, academic_year_id, teacher_id, school_day_id, period_id, status)
      SELECT ${ids.schoolA}, ${ids.year}, teacher.id, period.school_day_id, period.id,
        CASE WHEN teacher.id = ${ids.teacherB} AND day.day_of_week = 1 THEN 'UNAVAILABLE'::availability_status
             WHEN period.position = 1 THEN 'PREFERRED'::availability_status ELSE 'AVAILABLE'::availability_status END
      FROM teachers teacher CROSS JOIN periods period INNER JOIN school_days day ON day.id = period.school_day_id
      WHERE teacher.id IN (${ids.teacherA}, ${ids.teacherB}) AND period.school_id = ${ids.schoolA} AND period.academic_year_id = ${ids.year} AND period.is_active
      ON CONFLICT (academic_year_id, teacher_id, period_id) DO UPDATE SET status = excluded.status`;
  });
  console.log("Demo data seeded.");
  console.log("admin@madreseyar.ir / Demo123!");
  console.log("moaven@madreseyar.ir / Demo123!");
} finally {
  await sql.end();
}
