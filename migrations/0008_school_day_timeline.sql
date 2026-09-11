CREATE TYPE day_schedule_mode AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE intermission_kind AS ENUM ('BREAK', 'TRANSITION');

CREATE TABLE school_day_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  school_day_id uuid NOT NULL,
  mode day_schedule_mode NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  period_count integer NOT NULL,
  default_break_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_day_schedules_values_valid CHECK (
    end_time > start_time
    AND period_count BETWEEN 1 AND 20
    AND default_break_minutes BETWEEN 0 AND 180
  ),
  CONSTRAINT school_day_schedules_day_unique UNIQUE (school_day_id),
  CONSTRAINT school_day_schedules_id_scope_unique UNIQUE (id, school_id, academic_year_id, school_day_id),
  CONSTRAINT school_day_schedules_day_scope_fk
    FOREIGN KEY (school_day_id, school_id, academic_year_id)
    REFERENCES school_days(id, school_id, academic_year_id)
    ON DELETE CASCADE
);
CREATE INDEX school_day_schedules_school_year_idx ON school_day_schedules(school_id, academic_year_id);

CREATE TABLE school_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  school_day_id uuid NOT NULL,
  after_period_position integer NOT NULL,
  kind intermission_kind NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CONSTRAINT school_breaks_values_valid CHECK (
    after_period_position BETWEEN 1 AND 19
    AND end_time > start_time
  ),
  CONSTRAINT school_breaks_day_position_unique UNIQUE (school_day_id, after_period_position),
  CONSTRAINT school_breaks_day_scope_fk
    FOREIGN KEY (school_day_id, school_id, academic_year_id)
    REFERENCES school_days(id, school_id, academic_year_id)
    ON DELETE CASCADE
);
CREATE INDEX school_breaks_school_year_idx ON school_breaks(school_id, academic_year_id);

INSERT INTO school_day_schedules (school_id, academic_year_id, school_day_id, mode, start_time, end_time, period_count, default_break_minutes)
SELECT
  school_id,
  academic_year_id,
  school_day_id,
  'MANUAL',
  min(start_time),
  max(end_time),
  count(*)::integer,
  COALESCE(round(avg(NULLIF(break_after_minutes, 0)))::integer, 0)
FROM periods
WHERE is_active
GROUP BY school_id, academic_year_id, school_day_id;

WITH ordered_periods AS (
  SELECT
    school_id,
    academic_year_id,
    school_day_id,
    position,
    end_time,
    break_after_minutes,
    lead(position) OVER (PARTITION BY school_day_id ORDER BY position) AS next_position,
    lead(start_time) OVER (PARTITION BY school_day_id ORDER BY position) AS next_start_time
  FROM periods
  WHERE is_active
)
INSERT INTO school_breaks (school_id, academic_year_id, school_day_id, after_period_position, kind, start_time, end_time)
SELECT
  school_id,
  academic_year_id,
  school_day_id,
  position,
  CASE WHEN break_after_minutes > 0 THEN 'BREAK'::intermission_kind ELSE 'TRANSITION'::intermission_kind END,
  end_time,
  next_start_time
FROM ordered_periods
WHERE next_position = position + 1 AND next_start_time > end_time;

CREATE FUNCTION school_day_timeline_is_valid(target_day_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  config school_day_schedules%ROWTYPE;
  current_period periods%ROWTYPE;
  next_period periods%ROWTYPE;
  pause school_breaks%ROWTYPE;
  active_count integer;
  position_index integer;
BEGIN
  SELECT * INTO config FROM school_day_schedules WHERE school_day_id = target_day_id;
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO active_count FROM periods WHERE school_day_id = target_day_id AND is_active;
  IF active_count <> config.period_count THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM periods
    WHERE school_day_id = target_day_id AND is_active
      AND (position < 1 OR position > config.period_count OR start_time < config.start_time OR end_time > config.end_time)
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM school_breaks
    WHERE school_day_id = target_day_id
      AND (after_period_position < 1 OR after_period_position >= config.period_count OR start_time < config.start_time OR end_time > config.end_time)
  ) THEN RETURN false; END IF;

  FOR position_index IN 1..config.period_count LOOP
    SELECT * INTO current_period FROM periods WHERE school_day_id = target_day_id AND is_active AND position = position_index;
    IF NOT FOUND THEN RETURN false; END IF;
    IF position_index = 1 AND current_period.start_time <> config.start_time THEN RETURN false; END IF;
    IF position_index = config.period_count THEN
      IF current_period.end_time <> config.end_time THEN RETURN false; END IF;
    ELSE
      SELECT * INTO next_period FROM periods WHERE school_day_id = target_day_id AND is_active AND position = position_index + 1;
      IF NOT FOUND THEN RETURN false; END IF;
      SELECT * INTO pause FROM school_breaks WHERE school_day_id = target_day_id AND after_period_position = position_index;
      IF FOUND THEN
        IF pause.start_time <> current_period.end_time OR pause.end_time <> next_period.start_time THEN RETURN false; END IF;
      ELSIF current_period.end_time <> next_period.start_time THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE FUNCTION enforce_school_day_timeline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_day_id uuid;
BEGIN
  target_day_id := COALESCE(NEW.school_day_id, OLD.school_day_id);
  IF NOT school_day_timeline_is_valid(target_day_id) THEN
    RAISE EXCEPTION 'school day timeline is invalid'
      USING ERRCODE = '23514', CONSTRAINT = 'school_day_timeline_valid';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER school_day_schedules_timeline_trigger
AFTER INSERT OR UPDATE OR DELETE ON school_day_schedules
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_school_day_timeline();

CREATE CONSTRAINT TRIGGER periods_timeline_trigger
AFTER INSERT OR UPDATE OR DELETE ON periods
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_school_day_timeline();

CREATE CONSTRAINT TRIGGER school_breaks_timeline_trigger
AFTER INSERT OR UPDATE OR DELETE ON school_breaks
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_school_day_timeline();
