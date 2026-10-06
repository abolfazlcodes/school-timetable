ALTER TABLE class_groups
  ADD CONSTRAINT class_groups_id_school_year_unique
  UNIQUE (id, school_id, academic_year_id);

CREATE TABLE class_subject_teacher_assignments (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  CONSTRAINT class_subject_teacher_assignments_pk
    PRIMARY KEY (academic_year_id, class_id, subject_id),
  CONSTRAINT class_subject_teacher_assignments_year_school_fk
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT class_subject_teacher_assignments_class_scope_fk
    FOREIGN KEY (class_id, school_id, academic_year_id)
    REFERENCES class_groups(id, school_id, academic_year_id) ON DELETE CASCADE,
  CONSTRAINT class_subject_teacher_assignments_subject_school_fk
    FOREIGN KEY (subject_id, school_id)
    REFERENCES subjects(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT class_subject_teacher_assignments_teacher_school_fk
    FOREIGN KEY (teacher_id, school_id)
    REFERENCES teachers(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX class_subject_teacher_assignments_school_year_idx
  ON class_subject_teacher_assignments (school_id, academic_year_id);
CREATE INDEX class_subject_teacher_assignments_teacher_idx
  ON class_subject_teacher_assignments (school_id, academic_year_id, teacher_id);
