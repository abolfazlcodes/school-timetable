CREATE OR REPLACE FUNCTION prevent_active_period_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    SELECT 1
    FROM periods existing
    WHERE existing.school_day_id = NEW.school_day_id
      AND existing.id <> NEW.id
      AND existing.position <> NEW.position
      AND existing.is_active
      AND NEW.start_time < existing.end_time
      AND NEW.end_time > existing.start_time
  ) THEN
    RAISE EXCEPTION 'active periods cannot overlap'
      USING ERRCODE = '23514', CONSTRAINT = 'periods_no_active_overlap';
  END IF;
  RETURN NEW;
END;
$$;
