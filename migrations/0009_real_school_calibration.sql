ALTER TABLE curriculum_items RENAME COLUMN weekly_periods TO weekly_hours;

CREATE TABLE teacher_subject_assignments (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  assigned_weekly_hours integer NOT NULL,
  CONSTRAINT teacher_subject_assignments_pk PRIMARY KEY (academic_year_id, teacher_id, subject_id),
  CONSTRAINT teacher_subject_assignments_hours_valid CHECK (assigned_weekly_hours BETWEEN 0 AND 100),
  CONSTRAINT teacher_subject_assignments_year_school_fk
    FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_subject_assignments_teacher_school_fk
    FOREIGN KEY (teacher_id, school_id) REFERENCES teachers(id, school_id) ON DELETE CASCADE,
  CONSTRAINT teacher_subject_assignments_subject_school_fk
    FOREIGN KEY (subject_id, school_id) REFERENCES subjects(id, school_id) ON DELETE CASCADE
);
CREATE INDEX teacher_subject_assignments_school_year_idx
  ON teacher_subject_assignments (school_id, academic_year_id);

-- رابطه قدیمی سال نداشت؛ آن را فقط به تازه‌ترین سال موجود منتقل می‌کنیم و
-- ساعت صفر یعنی «نیازمند بازبینی مدیر»، نه یک تخصیص حدس‌زده‌شده.
INSERT INTO teacher_subject_assignments (school_id, academic_year_id, teacher_id, subject_id, assigned_weekly_hours)
SELECT legacy.school_id, year.id, legacy.teacher_id, legacy.subject_id, 0
FROM teacher_subjects legacy
JOIN LATERAL (
  SELECT academic_years.id
  FROM academic_years
  WHERE academic_years.school_id = legacy.school_id
  ORDER BY academic_years.is_active DESC, academic_years.start_year DESC, academic_years.id
  LIMIT 1
) year ON true;

DROP TABLE teacher_subjects;
