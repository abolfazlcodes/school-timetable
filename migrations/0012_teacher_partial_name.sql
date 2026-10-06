ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_name_not_blank;

ALTER TABLE teachers
  ADD CONSTRAINT teachers_name_not_blank CHECK (
    (length(trim(first_name)) = 0 OR length(trim(first_name)) >= 2)
    AND (length(trim(last_name)) = 0 OR length(trim(last_name)) >= 2)
    AND (length(trim(first_name)) >= 2 OR length(trim(last_name)) >= 2)
  );

COMMENT ON COLUMN teachers.first_name IS 'May be blank when only a family/known name is available; at least one name part is required.';
COMMENT ON COLUMN teachers.last_name IS 'May be blank when only a given/known name is available; at least one name part is required.';
