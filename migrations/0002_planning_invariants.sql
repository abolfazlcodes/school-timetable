CREATE FUNCTION valid_session_pattern(pattern jsonb, weekly_periods integer, session_count integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(pattern) = 'array'
    AND jsonb_array_length(pattern) = session_count
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(pattern) AS part(value)
      WHERE value !~ '^[1-9][0-9]*$'
    )
    AND COALESCE((SELECT sum(value::integer) FROM jsonb_array_elements_text(pattern) AS part(value)), 0) = weekly_periods;
$$;

ALTER TABLE curriculum_items
  ADD CONSTRAINT curriculum_session_pattern_valid
  CHECK (valid_session_pattern(session_pattern, weekly_periods, session_count));

ALTER TABLE class_plans
  ADD CONSTRAINT class_plans_override_capacity_sufficient
  CHECK (class_count_override IS NULL OR class_count_override * max_class_capacity >= student_count);

-- period باید دقیقاً به همان روز و سال ثبت‌شده تعلق داشته باشد.
ALTER TABLE school_days
  ADD CONSTRAINT school_days_id_school_year_unique UNIQUE (id, school_id, academic_year_id);

ALTER TABLE periods
  ADD CONSTRAINT periods_id_school_year_day_unique UNIQUE (id, school_id, academic_year_id, school_day_id),
  ADD CONSTRAINT periods_day_school_year_fk
    FOREIGN KEY (school_day_id, school_id, academic_year_id)
    REFERENCES school_days(id, school_id, academic_year_id)
    ON DELETE CASCADE;

ALTER TABLE teacher_availability
  ADD CONSTRAINT teacher_availability_period_scope_fk
    FOREIGN KEY (period_id, school_id, academic_year_id, school_day_id)
    REFERENCES periods(id, school_id, academic_year_id, school_day_id)
    ON DELETE CASCADE;
