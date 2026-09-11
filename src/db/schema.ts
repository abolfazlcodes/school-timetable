import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const schoolRole = pgEnum("school_role", ["ADMIN", "VICE_PRINCIPAL"]);
export const employmentType = pgEnum("employment_type", ["FULL_TIME", "PART_TIME", "CONTRACT"]);
export const staffKind = pgEnum("staff_kind", ["TEACHER", "VICE_PRINCIPAL", "EDUCATIONAL_DEPUTY", "EXECUTIVE_DEPUTY", "CULTURAL_DEPUTY", "OTHER"]);
export const availabilityStatus = pgEnum("availability_status", ["AVAILABLE", "UNAVAILABLE", "PREFERRED", "RESTRICTED"]);
export const scheduleRunStatus = pgEnum("schedule_run_status", ["SUCCEEDED", "NO_SOLUTION", "PREFLIGHT_FAILED"]);
export const scheduleVersionStatus = pgEnum("schedule_version_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const dayScheduleMode = pgEnum("day_schedule_mode", ["AUTO", "MANUAL"]);
export const intermissionKind = pgEnum("intermission_kind", ["BREAK", "TRANSITION"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_lower_unique").on(table.email)]);

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 32 }),
  province: varchar("province", { length: 80 }),
  city: varchar("city", { length: 80 }),
  phone: varchar("phone", { length: 24 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("schools_code_unique").on(table.code)]);

export const schoolMemberships = pgTable("school_memberships", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  role: schoolRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "school_memberships_pk", columns: [table.userId, table.schoolId] }),
  index("school_memberships_school_idx").on(table.schoolId),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activeSchoolId: uuid("active_school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  index("sessions_user_idx").on(table.userId),
  index("sessions_expiry_idx").on(table.expiresAt),
]);

export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 40 }).notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("academic_years_school_idx").on(table.schoolId)]);

export const grades = pgTable("grades", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  code: varchar("code", { length: 24 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [uniqueIndex("grades_school_code_unique").on(table.schoolId, table.code)]);

export const majors = pgTable("majors", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  code: varchar("code", { length: 24 }),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [index("majors_school_idx").on(table.schoolId)]);

export const classPlans = pgTable("class_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  gradeId: uuid("grade_id").notNull().references(() => grades.id, { onDelete: "restrict" }),
  majorId: uuid("major_id").references(() => majors.id, { onDelete: "restrict" }),
  studentCount: integer("student_count").notNull(),
  maxClassCapacity: integer("max_class_capacity").notNull(),
  classCountOverride: integer("class_count_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("class_plans_school_year_idx").on(table.schoolId, table.academicYearId)]);

export const classGroups = pgTable("class_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  classPlanId: uuid("class_plan_id").notNull().references(() => classPlans.id, { onDelete: "cascade" }),
  gradeId: uuid("grade_id").notNull().references(() => grades.id, { onDelete: "restrict" }),
  majorId: uuid("major_id").references(() => majors.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 80 }).notNull(),
  studentCount: integer("student_count").notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("class_groups_school_year_idx").on(table.schoolId, table.academicYearId)]);

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 24 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("subjects_school_idx").on(table.schoolId)]);

export const curriculumItems = pgTable("curriculum_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  gradeId: uuid("grade_id").notNull().references(() => grades.id, { onDelete: "restrict" }),
  majorId: uuid("major_id").references(() => majors.id, { onDelete: "restrict" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "restrict" }),
  weeklyPeriods: integer("weekly_periods").notNull(),
  sessionCount: integer("session_count").notNull(),
  sessionPattern: jsonb("session_pattern").$type<number[]>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("curriculum_items_school_year_idx").on(table.schoolId, table.academicYearId)]);

export const schoolDays = pgTable("school_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  label: varchar("label", { length: 24 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [uniqueIndex("school_days_year_day_unique").on(table.academicYearId, table.dayOfWeek)]);

export const periods = pgTable("periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  schoolDayId: uuid("school_day_id").notNull().references(() => schoolDays.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  label: varchar("label", { length: 32 }).notNull(),
  startTime: time("start_time", { withTimezone: false }).notNull(),
  endTime: time("end_time", { withTimezone: false }).notNull(),
  breakAfterMinutes: integer("break_after_minutes").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [uniqueIndex("periods_day_position_unique").on(table.schoolDayId, table.position)]);

export const schoolDaySchedules = pgTable("school_day_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  schoolDayId: uuid("school_day_id").notNull().references(() => schoolDays.id, { onDelete: "cascade" }),
  mode: dayScheduleMode("mode").notNull(),
  startTime: time("start_time", { withTimezone: false }).notNull(),
  endTime: time("end_time", { withTimezone: false }).notNull(),
  periodCount: integer("period_count").notNull(),
  defaultBreakMinutes: integer("default_break_minutes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("school_day_schedules_day_unique").on(table.schoolDayId), index("school_day_schedules_school_year_idx").on(table.schoolId, table.academicYearId)]);

export const schoolBreaks = pgTable("school_breaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  schoolDayId: uuid("school_day_id").notNull().references(() => schoolDays.id, { onDelete: "cascade" }),
  afterPeriodPosition: integer("after_period_position").notNull(),
  kind: intermissionKind("kind").notNull(),
  startTime: time("start_time", { withTimezone: false }).notNull(),
  endTime: time("end_time", { withTimezone: false }).notNull(),
}, (table) => [uniqueIndex("school_breaks_day_position_unique").on(table.schoolDayId, table.afterPeriodPosition), index("school_breaks_school_year_idx").on(table.schoolId, table.academicYearId)]);

export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 60 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  personnelCode: varchar("personnel_code", { length: 32 }).notNull(),
  employmentType: employmentType("employment_type").notNull(),
  staffKind: staffKind("staff_kind").notNull().default("TEACHER"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("teachers_school_personnel_unique").on(table.schoolId, table.personnelCode)]);

export const teacherSubjects = pgTable("teacher_subjects", {
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ name: "teacher_subjects_pk", columns: [table.teacherId, table.subjectId] }), index("teacher_subjects_school_idx").on(table.schoolId)]);

export const teacherYearProfiles = pgTable("teacher_year_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  minimumWorkload: integer("minimum_workload").notNull().default(0),
  requiredWorkload: integer("required_workload").notNull(),
  maximumWorkload: integer("maximum_workload").notNull(),
  overtimeAllowance: integer("overtime_allowance").notNull().default(0),
  dailyMinimum: integer("daily_minimum").notNull().default(0),
  dailyMaximum: integer("daily_maximum").notNull(),
  maxConsecutive: integer("max_consecutive").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("teacher_year_profiles_year_teacher_unique").on(table.academicYearId, table.teacherId), index("teacher_year_profiles_school_idx").on(table.schoolId)]);

export const teacherAvailability = pgTable("teacher_availability", {
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  schoolDayId: uuid("school_day_id").notNull().references(() => schoolDays.id, { onDelete: "cascade" }),
  periodId: uuid("period_id").notNull().references(() => periods.id, { onDelete: "cascade" }),
  status: availabilityStatus("status").notNull(),
}, (table) => [primaryKey({ name: "teacher_availability_pk", columns: [table.academicYearId, table.teacherId, table.periodId] }), index("teacher_availability_school_idx").on(table.schoolId)]);

export const scheduleRuns = pgTable("schedule_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  status: scheduleRunStatus("status").notNull(),
  inputFingerprint: varchar("input_fingerprint", { length: 64 }).notNull(),
  engineVersion: varchar("engine_version", { length: 24 }).notNull(),
  generationTimeMs: integer("generation_time_ms").notNull(),
  exploredNodes: integer("explored_nodes").notNull(),
  issues: jsonb("issues").$type<unknown[]>().notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("schedule_runs_school_year_idx").on(table.schoolId, table.academicYearId, table.createdAt)]);

export const scheduleCandidates = pgTable("schedule_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  scheduleRunId: uuid("schedule_run_id").notNull().references(() => scheduleRuns.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  score: integer("score").notNull(),
  penalty: integer("penalty").notNull(),
  penaltyBreakdown: jsonb("penalty_breakdown").$type<Record<string, number>>().notNull(),
  assignments: jsonb("assignments").$type<unknown[]>().notNull(),
}, (table) => [uniqueIndex("schedule_candidates_run_rank_unique").on(table.scheduleRunId, table.rank), index("schedule_candidates_school_idx").on(table.schoolId)]);

export const scheduleWorkspaces = pgTable("schedule_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  scheduleRunId: uuid("schedule_run_id").notNull().references(() => scheduleRuns.id, { onDelete: "restrict" }),
  sourceCandidateId: uuid("source_candidate_id").notNull().references(() => scheduleCandidates.id, { onDelete: "restrict" }),
  sourceVersionId: uuid("source_version_id"),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  assignments: jsonb("assignments").$type<unknown[]>().notNull(),
  validationIssues: jsonb("validation_issues").$type<unknown[]>().notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("schedule_workspaces_school_year_idx").on(table.schoolId, table.academicYearId, table.updatedAt),
]);

export const scheduleVersions = pgTable("schedule_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  scheduleRunId: uuid("schedule_run_id").notNull().references(() => scheduleRuns.id, { onDelete: "restrict" }),
  sourceCandidateId: uuid("source_candidate_id").notNull().references(() => scheduleCandidates.id, { onDelete: "restrict" }),
  sourceWorkspaceId: uuid("source_workspace_id").notNull().references(() => scheduleWorkspaces.id, { onDelete: "restrict" }),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  publishedByUserId: uuid("published_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  status: scheduleVersionStatus("status").notNull(),
  score: integer("score").notNull(),
  assignments: jsonb("assignments").$type<unknown[]>().notNull(),
  validationIssues: jsonb("validation_issues").$type<unknown[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("schedule_versions_school_year_number_unique").on(table.schoolId, table.academicYearId, table.versionNumber),
  index("schedule_versions_school_year_idx").on(table.schoolId, table.academicYearId, table.createdAt),
]);

export type SchoolRole = (typeof schoolRole.enumValues)[number];
export type UserRecord = typeof users.$inferSelect;
export type SchoolRecord = typeof schools.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type AvailabilityStatus = (typeof availabilityStatus.enumValues)[number];
export type EmploymentType = (typeof employmentType.enumValues)[number];
export type StaffKind = (typeof staffKind.enumValues)[number];
export type ScheduleVersionStatus = (typeof scheduleVersionStatus.enumValues)[number];
