ALTER TABLE class_subject_teacher_assignments
  ADD COLUMN assigned_weekly_hours integer;

UPDATE class_subject_teacher_assignments assignment
SET assigned_weekly_hours = (
  SELECT curriculum.weekly_hours
  FROM class_groups school_class
  INNER JOIN curriculum_items curriculum
    ON curriculum.school_id = school_class.school_id
   AND curriculum.academic_year_id = school_class.academic_year_id
   AND curriculum.grade_id = school_class.grade_id
   AND (curriculum.major_id IS NULL OR curriculum.major_id = school_class.major_id)
   AND curriculum.subject_id = assignment.subject_id
   AND curriculum.is_active = true
  WHERE school_class.id = assignment.class_id
  ORDER BY curriculum.major_id NULLS LAST
  LIMIT 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM class_subject_teacher_assignments
    WHERE assigned_weekly_hours IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot infer assigned_weekly_hours for a legacy class/subject/teacher assignment';
  END IF;
END
$$;

ALTER TABLE class_subject_teacher_assignments
  ALTER COLUMN assigned_weekly_hours SET NOT NULL,
  ADD CONSTRAINT class_subject_teacher_assignments_hours_positive
    CHECK (assigned_weekly_hours > 0),
  DROP CONSTRAINT class_subject_teacher_assignments_pk,
  ADD CONSTRAINT class_subject_teacher_assignments_pk
    PRIMARY KEY (academic_year_id, class_id, subject_id, teacher_id);
