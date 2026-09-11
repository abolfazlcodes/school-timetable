CREATE TYPE schedule_run_status AS ENUM ('SUCCEEDED', 'NO_SOLUTION', 'PREFLIGHT_FAILED');

CREATE TABLE schedule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status schedule_run_status NOT NULL,
  input_fingerprint varchar(64) NOT NULL,
  engine_version varchar(24) NOT NULL,
  generation_time_ms integer NOT NULL,
  explored_nodes integer NOT NULL,
  issues jsonb NOT NULL,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_runs_metrics_valid CHECK (generation_time_ms >= 0 AND explored_nodes >= 0),
  CONSTRAINT schedule_runs_fingerprint_valid CHECK (length(input_fingerprint) = 64),
  CONSTRAINT schedule_runs_id_school_unique UNIQUE (id, school_id),
  CONSTRAINT schedule_runs_year_school_fk FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT
);
CREATE INDEX schedule_runs_school_year_idx ON schedule_runs (school_id, academic_year_id, created_at DESC);

CREATE TABLE schedule_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  schedule_run_id uuid NOT NULL,
  rank integer NOT NULL,
  score integer NOT NULL,
  penalty integer NOT NULL,
  penalty_breakdown jsonb NOT NULL,
  assignments jsonb NOT NULL,
  CONSTRAINT schedule_candidates_metrics_valid CHECK (rank > 0 AND score BETWEEN 0 AND 10000 AND penalty >= 0),
  CONSTRAINT schedule_candidates_assignments_array CHECK (jsonb_typeof(assignments) = 'array'),
  CONSTRAINT schedule_candidates_run_rank_unique UNIQUE (schedule_run_id, rank),
  CONSTRAINT schedule_candidates_run_school_fk FOREIGN KEY (schedule_run_id, school_id) REFERENCES schedule_runs(id, school_id) ON DELETE CASCADE
);
CREATE INDEX schedule_candidates_school_idx ON schedule_candidates (school_id);
