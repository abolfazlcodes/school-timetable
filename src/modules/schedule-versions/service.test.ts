import { describe, expect, it, vi } from "vitest";
import { makeProblem } from "@/modules/scheduling/fixtures.test-helper";
import type { SchedulingRepository } from "@/modules/scheduling/repository";
import type { ScheduleAssignment } from "@/modules/scheduling/types";
import type { TenantContext } from "@/modules/tenancy/types";
import type { TimetableRepository } from "@/modules/timetable/repository";
import type { ScheduleVersionRepository, StoredScheduleVersion } from "./repository";
import { forkScheduleVersion, snapshotWorkspace } from "./service";

const context: TenantContext = { sessionId: "s", userId: "10000000-0000-4000-8000-000000000001", userName: "مدیر", schoolId: "20000000-0000-4000-8000-000000000001", schoolName: "مدرسه", schoolCode: null, role: "ADMIN" };
const workspaceId = "40000000-0000-4000-8000-000000000001";
const versionId = "50000000-0000-4000-8000-000000000001";
const assignments: ScheduleAssignment[] = [
  { sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
  { sessionId: "r1:2", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 1, periodIds: ["su-1"] },
  { sessionId: "r2:1", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 2, periodIds: ["sa-2"] },
  { sessionId: "r2:2", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 2, periodIds: ["su-2"] },
];

function setup(problem = makeProblem()) {
  const workspace = { id: workspaceId, academicYearId: "year", scheduleRunId: "run", sourceCandidateId: "candidate", sourceVersionId: null, sourceRank: 1, sourceScore: 9900, assignments, validationIssues: [], revision: 0, createdAt: new Date(), updatedAt: new Date() };
  const created = { id: versionId, academicYearId: "year", scheduleRunId: "run", sourceCandidateId: "candidate", sourceWorkspaceId: workspaceId, sourceRank: 1, versionNumber: 1, status: "PUBLISHED" as const, score: 9900, assignments, validationIssues: [], createdAt: new Date(), publishedAt: new Date() };
  const scheduling = { loadProblem: vi.fn().mockResolvedValue(problem) } as unknown as SchedulingRepository;
  const timetable = { getWorkspace: vi.fn().mockResolvedValue(workspace) } as unknown as TimetableRepository;
  const versions = { createSnapshot: vi.fn().mockResolvedValue(created), get: vi.fn().mockResolvedValue(created), fork: vi.fn().mockResolvedValue(workspaceId) } as unknown as ScheduleVersionRepository;
  return { scheduling, timetable, versions, created: created as StoredScheduleVersion };
}

describe("نسخه‌بندی و انتشار", () => {
  it("برنامه دارای خطای سخت را منتشر نمی‌کند ولی پیش‌نویس را نگه می‌دارد", async () => {
    const deps = setup();
    const workspace = await deps.timetable.getWorkspace(context, workspaceId);
    workspace!.assignments = assignments.slice(1);
    const published = await snapshotWorkspace(context, deps.scheduling, deps.timetable, deps.versions, { workspaceId, publish: true });
    expect(published).toMatchObject({ status: "error", message: expect.stringContaining("انتشار ممکن نیست") });
    expect(deps.versions.createSnapshot).not.toHaveBeenCalled();
    const draft = await snapshotWorkspace(context, deps.scheduling, deps.timetable, deps.versions, { workspaceId, publish: false });
    expect(draft.status).toBe("success");
    expect(deps.versions.createSnapshot).toHaveBeenCalledWith(context, workspace, expect.any(Array), "DRAFT");
  });

  it("برای انتشار همراه هشدار، تأیید صریح می‌خواهد", async () => {
    const problem = makeProblem();
    problem.periods = problem.periods.map((period) => ({ ...period, isLast: period.id === "sa-1" }));
    const deps = setup(problem);
    expect((await snapshotWorkspace(context, deps.scheduling, deps.timetable, deps.versions, { workspaceId, publish: true })).status).toBe("confirm-warning");
    expect((await snapshotWorkspace(context, deps.scheduling, deps.timetable, deps.versions, { workspaceId, publish: true, confirmWarnings: true })).status).toBe("success");
  });

  it("از snapshot قدیمی نسخه کاری مستقل می‌سازد", async () => {
    const deps = setup();
    const result = await forkScheduleVersion(context, deps.scheduling, deps.versions, versionId);
    expect(result).toMatchObject({ status: "success", workspaceId });
    expect(deps.versions.fork).toHaveBeenCalledWith(context, deps.created, expect.any(Array));
  });
});
