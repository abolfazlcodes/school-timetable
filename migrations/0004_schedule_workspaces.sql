ALTER TABLE schedule_candidates
  ADD CONSTRAINT schedule_candidates_id_run_school_unique UNIQUE (id, schedule_run_id, school_id);

CREATE TABLE schedule_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  schedule_run_id uuid NOT NULL,
  source_candidate_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignments jsonb NOT NULL,
  validation_issues jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_workspaces_revision_valid CHECK (revision >= 0),
  CONSTRAINT schedule_workspaces_assignments_array CHECK (jsonb_typeof(assignments) = 'array'),
  CONSTRAINT schedule_workspaces_issues_array CHECK (jsonb_typeof(validation_issues) = 'array'),
  CONSTRAINT schedule_workspaces_source_unique UNIQUE (source_candidate_id),
  CONSTRAINT schedule_workspaces_year_school_fk
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_workspaces_run_school_fk
    FOREIGN KEY (schedule_run_id, school_id)
    REFERENCES schedule_runs(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_workspaces_candidate_run_school_fk
    FOREIGN KEY (source_candidate_id, schedule_run_id, school_id)
    REFERENCES schedule_candidates(id, schedule_run_id, school_id) ON DELETE RESTRICT
);

CREATE INDEX schedule_workspaces_school_year_idx
  ON schedule_workspaces (school_id, academic_year_id, updated_at DESC);
