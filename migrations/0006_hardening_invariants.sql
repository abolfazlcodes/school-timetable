ALTER TABLE school_days
  ADD CONSTRAINT school_days_label_not_blank CHECK (length(trim(label)) >= 2),
  ADD CONSTRAINT school_days_sort_order_valid CHECK (sort_order BETWEEN 0 AND 6);

ALTER TABLE periods
  ADD CONSTRAINT periods_label_not_blank CHECK (length(trim(label)) >= 2),
  ADD CONSTRAINT periods_position_bounded CHECK (position BETWEEN 1 AND 20);

ALTER TABLE schedule_runs
  ADD CONSTRAINT schedule_runs_issues_array CHECK (jsonb_typeof(issues) = 'array'),
  ADD CONSTRAINT schedule_runs_summary_object CHECK (jsonb_typeof(summary) = 'object'),
  ADD CONSTRAINT schedule_runs_creator_membership_fk
    FOREIGN KEY (created_by_user_id, school_id)
    REFERENCES school_memberships(user_id, school_id) ON DELETE RESTRICT;

ALTER TABLE schedule_candidates
  ADD CONSTRAINT schedule_candidates_penalty_object CHECK (jsonb_typeof(penalty_breakdown) = 'object');

ALTER TABLE schedule_workspaces
  ADD CONSTRAINT schedule_workspaces_creator_membership_fk
    FOREIGN KEY (created_by_user_id, school_id)
    REFERENCES school_memberships(user_id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_workspaces_source_scope_unique
    UNIQUE (id, school_id, academic_year_id, schedule_run_id, source_candidate_id);

ALTER TABLE schedule_versions
  ADD CONSTRAINT schedule_versions_score_valid CHECK (score BETWEEN 0 AND 10000),
  ADD CONSTRAINT schedule_versions_published_without_errors CHECK (
    status <> 'PUBLISHED'
    OR NOT jsonb_path_exists(validation_issues, '$[*] ? (@.severity == "ERROR")')
  ),
  ADD CONSTRAINT schedule_versions_creator_membership_fk
    FOREIGN KEY (created_by_user_id, school_id)
    REFERENCES school_memberships(user_id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_versions_publisher_membership_fk
    FOREIGN KEY (published_by_user_id, school_id)
    REFERENCES school_memberships(user_id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_versions_source_workspace_scope_fk
    FOREIGN KEY (source_workspace_id, school_id, academic_year_id, schedule_run_id, source_candidate_id)
    REFERENCES schedule_workspaces(id, school_id, academic_year_id, schedule_run_id, source_candidate_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_versions_source_scope_unique
    UNIQUE (id, school_id, academic_year_id, schedule_run_id, source_candidate_id);

ALTER TABLE schedule_workspaces
  ADD CONSTRAINT schedule_workspaces_source_version_scope_fk
    FOREIGN KEY (source_version_id, school_id, academic_year_id, schedule_run_id, source_candidate_id)
    REFERENCES schedule_versions(id, school_id, academic_year_id, schedule_run_id, source_candidate_id)
    ON DELETE RESTRICT;

CREATE FUNCTION prevent_active_period_overlap()
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

CREATE TRIGGER periods_no_active_overlap_trigger
BEFORE INSERT OR UPDATE OF school_day_id, start_time, end_time, is_active
ON periods
FOR EACH ROW EXECUTE FUNCTION prevent_active_period_overlap();

CREATE FUNCTION enforce_class_group_plan_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM class_plans plan
    WHERE plan.id = NEW.class_plan_id
      AND plan.school_id = NEW.school_id
      AND plan.academic_year_id = NEW.academic_year_id
      AND plan.grade_id = NEW.grade_id
      AND plan.major_id IS NOT DISTINCT FROM NEW.major_id
  ) THEN
    RAISE EXCEPTION 'class group scope must match its plan'
      USING ERRCODE = '23503', CONSTRAINT = 'class_groups_plan_scope_match';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER class_groups_plan_scope_trigger
BEFORE INSERT OR UPDATE OF class_plan_id, school_id, academic_year_id, grade_id, major_id
ON class_groups
FOR EACH ROW EXECUTE FUNCTION enforce_class_group_plan_scope();
