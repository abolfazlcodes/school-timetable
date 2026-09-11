CREATE TYPE employment_type AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');
CREATE TYPE staff_kind AS ENUM ('TEACHER', 'VICE_PRINCIPAL', 'EDUCATIONAL_DEPUTY', 'EXECUTIVE_DEPUTY', 'CULTURAL_DEPUTY', 'OTHER');
CREATE TYPE availability_status AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PREFERRED', 'RESTRICTED');

CREATE TABLE academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title varchar(40) NOT NULL,
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_valid_range CHECK (start_year BETWEEN 1300 AND 1600 AND end_year > start_year),
  CONSTRAINT academic_years_title_not_blank CHECK (length(trim(title)) >= 3),
  CONSTRAINT academic_years_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT academic_years_school_title_unique UNIQUE (school_id, title)
);
CREATE INDEX academic_years_school_idx ON academic_years (school_id);
CREATE UNIQUE INDEX academic_years_one_active_per_school ON academic_years (school_id) WHERE is_active;

CREATE TABLE grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(60) NOT NULL,
  code varchar(24) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT grades_name_not_blank CHECK (length(trim(name)) >= 2),
  CONSTRAINT grades_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT grades_school_code_unique UNIQUE (school_id, code)
);

CREATE TABLE majors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  code varchar(24),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT majors_name_not_blank CHECK (length(trim(name)) >= 2),
  CONSTRAINT majors_id_school_unique UNIQUE (id, school_id)
);
CREATE UNIQUE INDEX majors_school_name_unique ON majors (school_id, lower(name));

CREATE TABLE class_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  major_id uuid,
  student_count integer NOT NULL,
  max_class_capacity integer NOT NULL,
  class_count_override integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_plans_positive_values CHECK (student_count > 0 AND max_class_capacity > 0 AND (class_count_override IS NULL OR class_count_override > 0)),
  CONSTRAINT class_plans_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT class_plans_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT class_plans_grade_school_fk FOREIGN KEY (grade_id, school_id) REFERENCES grades(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT class_plans_major_school_fk FOREIGN KEY (major_id, school_id) REFERENCES majors(id, school_id) ON DELETE RESTRICT
);
CREATE INDEX class_plans_school_year_idx ON class_plans (school_id, academic_year_id);
CREATE UNIQUE INDEX class_plans_scope_with_major_unique ON class_plans (academic_year_id, grade_id, major_id) WHERE major_id IS NOT NULL;
CREATE UNIQUE INDEX class_plans_scope_without_major_unique ON class_plans (academic_year_id, grade_id) WHERE major_id IS NULL;

CREATE TABLE class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  class_plan_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  major_id uuid,
  name varchar(80) NOT NULL,
  student_count integer NOT NULL,
  max_capacity integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_groups_capacity_valid CHECK (student_count >= 0 AND max_capacity > 0 AND student_count <= max_capacity),
  CONSTRAINT class_groups_name_not_blank CHECK (length(trim(name)) >= 2),
  CONSTRAINT class_groups_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT class_groups_plan_school_fk FOREIGN KEY (class_plan_id, school_id) REFERENCES class_plans(id, school_id) ON DELETE CASCADE,
  CONSTRAINT class_groups_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT class_groups_grade_school_fk FOREIGN KEY (grade_id, school_id) REFERENCES grades(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT class_groups_major_school_fk FOREIGN KEY (major_id, school_id) REFERENCES majors(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT class_groups_plan_name_unique UNIQUE (class_plan_id, name)
);
CREATE INDEX class_groups_school_year_idx ON class_groups (school_id, academic_year_id);

CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  code varchar(24),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subjects_name_not_blank CHECK (length(trim(name)) >= 2),
  CONSTRAINT subjects_id_school_unique UNIQUE (id, school_id)
);
CREATE UNIQUE INDEX subjects_school_name_unique ON subjects (school_id, lower(name));

CREATE TABLE curriculum_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  major_id uuid,
  subject_id uuid NOT NULL,
  weekly_periods integer NOT NULL,
  session_count integer NOT NULL,
  session_pattern jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_positive_values CHECK (weekly_periods > 0 AND session_count > 0),
  CONSTRAINT curriculum_pattern_array CHECK (jsonb_typeof(session_pattern) = 'array'),
  CONSTRAINT curriculum_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT curriculum_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT curriculum_grade_school_fk FOREIGN KEY (grade_id, school_id) REFERENCES grades(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT curriculum_major_school_fk FOREIGN KEY (major_id, school_id) REFERENCES majors(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT curriculum_subject_school_fk FOREIGN KEY (subject_id, school_id) REFERENCES subjects(id, school_id) ON DELETE RESTRICT
);
CREATE INDEX curriculum_items_school_year_idx ON curriculum_items (school_id, academic_year_id);
CREATE UNIQUE INDEX curriculum_scope_with_major_unique ON curriculum_items (academic_year_id, grade_id, major_id, subject_id) WHERE major_id IS NOT NULL;
CREATE UNIQUE INDEX curriculum_scope_without_major_unique ON curriculum_items (academic_year_id, grade_id, subject_id) WHERE major_id IS NULL;

CREATE TABLE school_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  label varchar(24) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT school_days_valid_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT school_days_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT school_days_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT school_days_year_day_unique UNIQUE (academic_year_id, day_of_week)
);

CREATE TABLE periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  school_day_id uuid NOT NULL,
  position integer NOT NULL,
  label varchar(32) NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_after_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT periods_valid_values CHECK (position > 0 AND end_time > start_time AND break_after_minutes BETWEEN 0 AND 180),
  CONSTRAINT periods_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT periods_day_school_fk FOREIGN KEY (school_day_id, school_id) REFERENCES school_days(id, school_id) ON DELETE CASCADE,
  CONSTRAINT periods_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT periods_day_position_unique UNIQUE (school_day_id, position)
);

CREATE TABLE teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  first_name varchar(60) NOT NULL,
  last_name varchar(80) NOT NULL,
  personnel_code varchar(32) NOT NULL,
  employment_type employment_type NOT NULL,
  staff_kind staff_kind NOT NULL DEFAULT 'TEACHER',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teachers_name_not_blank CHECK (length(trim(first_name)) >= 2 AND length(trim(last_name)) >= 2),
  CONSTRAINT teachers_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT teachers_school_personnel_unique UNIQUE (school_id, personnel_code)
);

CREATE TABLE teacher_subjects (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  CONSTRAINT teacher_subjects_pk PRIMARY KEY (teacher_id, subject_id),
  CONSTRAINT teacher_subjects_teacher_school_fk FOREIGN KEY (teacher_id, school_id) REFERENCES teachers(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_subjects_subject_school_fk FOREIGN KEY (subject_id, school_id) REFERENCES subjects(id, school_id) ON DELETE CASCADE
);
CREATE INDEX teacher_subjects_school_idx ON teacher_subjects (school_id);

CREATE TABLE teacher_year_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  minimum_workload integer NOT NULL DEFAULT 0,
  required_workload integer NOT NULL,
  maximum_workload integer NOT NULL,
  overtime_allowance integer NOT NULL DEFAULT 0,
  daily_minimum integer NOT NULL DEFAULT 0,
  daily_maximum integer NOT NULL,
  max_consecutive integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_profiles_workload_valid CHECK (minimum_workload >= 0 AND minimum_workload <= required_workload AND required_workload <= maximum_workload AND overtime_allowance >= 0),
  CONSTRAINT teacher_profiles_daily_valid CHECK (daily_minimum >= 0 AND daily_minimum <= daily_maximum AND daily_maximum > 0 AND max_consecutive > 0 AND max_consecutive <= daily_maximum),
  CONSTRAINT teacher_profiles_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT teacher_profiles_year_teacher_unique UNIQUE (academic_year_id, teacher_id),
  CONSTRAINT teacher_profiles_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_profiles_teacher_school_fk FOREIGN KEY (teacher_id, school_id) REFERENCES teachers(id, school_id) ON DELETE CASCADE
);
CREATE INDEX teacher_year_profiles_school_idx ON teacher_year_profiles (school_id);

CREATE TABLE teacher_availability (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  school_day_id uuid NOT NULL,
  period_id uuid NOT NULL,
  status availability_status NOT NULL,
  CONSTRAINT teacher_availability_pk PRIMARY KEY (academic_year_id, teacher_id, period_id),
  CONSTRAINT teacher_availability_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_availability_teacher_school_fk FOREIGN KEY (teacher_id, school_id) REFERENCES teachers(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_availability_day_school_fk FOREIGN KEY (school_day_id, school_id) REFERENCES school_days(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_availability_period_school_fk FOREIGN KEY (period_id, school_id) REFERENCES periods(id, school_id) ON DELETE CASCADE
);
CREATE INDEX teacher_availability_school_idx ON teacher_availability (school_id);

-- FKهای مرکب، علاوه بر queryهای tenant-aware، نشت بین مدرسه‌ای را در خود DB متوقف می‌کنند.
