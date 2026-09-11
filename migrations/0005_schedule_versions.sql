CREATE TYPE schedule_version_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE schedule_workspaces
  DROP CONSTRAINT schedule_workspaces_source_unique,
  ADD CONSTRAINT schedule_workspaces_id_school_unique UNIQUE (id, school_id);

CREATE TABLE schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  schedule_run_id uuid NOT NULL,
  source_candidate_id uuid NOT NULL,
  source_workspace_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  status schedule_version_status NOT NULL,
  score integer NOT NULL,
  assignments jsonb NOT NULL,
  validation_issues jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT schedule_versions_number_valid CHECK (version_number > 0),
  CONSTRAINT schedule_versions_assignments_array CHECK (jsonb_typeof(assignments) = 'array'),
  CONSTRAINT schedule_versions_issues_array CHECK (jsonb_typeof(validation_issues) = 'array'),
  CONSTRAINT schedule_versions_publish_fields_valid CHECK (
    (status = 'PUBLISHED' AND published_at IS NOT NULL AND published_by_user_id IS NOT NULL)
    OR (status <> 'PUBLISHED')
  ),
  CONSTRAINT schedule_versions_school_year_number_unique UNIQUE (school_id, academic_year_id, version_number),
  CONSTRAINT schedule_versions_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT schedule_versions_year_school_fk
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_versions_run_school_fk
    FOREIGN KEY (schedule_run_id, school_id)
    REFERENCES schedule_runs(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_versions_candidate_run_school_fk
    FOREIGN KEY (source_candidate_id, schedule_run_id, school_id)
    REFERENCES schedule_candidates(id, schedule_run_id, school_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_versions_workspace_school_fk
    FOREIGN KEY (source_workspace_id, school_id)
    REFERENCES schedule_workspaces(id, school_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX schedule_versions_one_published_per_year
  ON schedule_versions (school_id, academic_year_id)
  WHERE status = 'PUBLISHED';

CREATE INDEX schedule_versions_school_year_idx
  ON schedule_versions (school_id, academic_year_id, created_at DESC);

ALTER TABLE schedule_workspaces
  ADD COLUMN source_version_id uuid,
  ADD CONSTRAINT schedule_workspaces_source_version_school_fk
    FOREIGN KEY (source_version_id, school_id)
    REFERENCES schedule_versions(id, school_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX schedule_workspaces_candidate_base_unique
  ON schedule_workspaces (source_candidate_id)
  WHERE source_version_id IS NULL;
