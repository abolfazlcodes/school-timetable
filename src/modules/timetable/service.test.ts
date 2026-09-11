import { describe, expect, it, vi } from "vitest";
import { makeProblem } from "@/modules/scheduling/fixtures.test-helper";
import type { SchedulingRepository } from "@/modules/scheduling/repository";
import type { ScheduleAssignment } from "@/modules/scheduling/types";
import type { TenantContext } from "@/modules/tenancy/types";
import type { TimetableRepository } from "./repository";
import { editTimetable } from "./service";

const context: TenantContext = { sessionId: "s", userId: "10000000-0000-4000-8000-000000000001", userName: "مدیر", schoolId: "20000000-0000-4000-8000-000000000001", schoolName: "مدرسه", schoolCode: null, role: "ADMIN" };
const workspaceId = "40000000-0000-4000-8000-000000000001";
const assignments: ScheduleAssignment[] = [
  { sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
  { sessionId: "r1:2", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 1, periodIds: ["su-1"] },
  { sessionId: "r2:1", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 2, periodIds: ["sa-2"] },
  { sessionId: "r2:2", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 2, periodIds: ["su-2"] },
];

function repositories() {
  const problem = makeProblem();
  const updateWorkspace = vi.fn().mockResolvedValue({ revision: 1, updatedAt: new Date("2026-09-10T08:00:00Z") });
  const timetableRepository: TimetableRepository = {
    getCandidate: vi.fn(),
    createWorkspace: vi.fn(),
    getWorkspace: vi.fn().mockResolvedValue({ id: workspaceId, academicYearId: "year", scheduleRunId: "run", sourceCandidateId: "candidate", sourceVersionId: null, sourceRank: 1, sourceScore: 9900, assignments, validationIssues: [], revision: 0, createdAt: new Date(), updatedAt: new Date() }),
    updateWorkspace,
  };
  const schedulingRepository = { loadProblem: vi.fn().mockResolvedValue(problem) } as unknown as SchedulingRepository;
  return { schedulingRepository, timetableRepository, updateWorkspace };
}

describe("سرویس اصلاح برنامه", () => {
  it("هشدار تازه را بدون تأیید ذخیره نمی‌کند", async () => {
    const { schedulingRepository, timetableRepository, updateWorkspace } = repositories();
    const input = { kind: "PLACE" as const, workspaceId, revision: 0, sessionId: "r1:1", teacherId: "00000000-0000-4000-8000-000000000001", dayId: "00000000-0000-4000-8000-000000000002", startPosition: 3, confirmWarnings: false };
    const problem = makeProblem();
    problem.schoolId = context.schoolId;
    problem.academicYearId = "year";
    problem.teachers[0].id = input.teacherId;
    problem.teachers[0].availability = Object.fromEntries(problem.periods.map((period) => [period.id, period.position === 1 ? "PREFERRED" : "AVAILABLE"]));
    problem.periods = problem.periods.map((period) => ({ ...period, dayId: period.dayId === "sat" ? input.dayId : "00000000-0000-4000-8000-000000000003" }));
    problem.teachers[0].availability = Object.fromEntries(problem.periods.map((period) => [period.id, period.position === 1 ? "PREFERRED" : "AVAILABLE"]));
    (schedulingRepository.loadProblem as ReturnType<typeof vi.fn>).mockResolvedValue(problem);
    const workspace = await timetableRepository.getWorkspace(context, workspaceId);
    workspace!.assignments = assignments.map((item) => ({ ...item, teacherId: input.teacherId, dayId: item.dayId === "sat" ? input.dayId : "00000000-0000-4000-8000-000000000003" }));
    (timetableRepository.getWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(workspace);
    const result = await editTimetable(context, schedulingRepository, timetableRepository, input);
    expect(result.status).toBe("confirm-warning");
    expect(updateWorkspace).not.toHaveBeenCalled();
    const accepted = await editTimetable(context, schedulingRepository, timetableRepository, { ...input, confirmWarnings: true });
    expect(accepted.status).toBe("success");
    expect(updateWorkspace).toHaveBeenCalledOnce();
  });

  it("حذف را فقط با تأیید آگاهانه ذخیره می‌کند", async () => {
    const { schedulingRepository, timetableRepository, updateWorkspace } = repositories();
    const base = { kind: "REMOVE" as const, workspaceId, revision: 0, sessionId: "r1:1" };
    expect((await editTimetable(context, schedulingRepository, timetableRepository, { ...base, confirmInvalid: false })).status).toBe("confirm-invalid");
    expect(updateWorkspace).not.toHaveBeenCalled();
    const accepted = await editTimetable(context, schedulingRepository, timetableRepository, { ...base, confirmInvalid: true });
    expect(accepted.status).toBe("success");
    expect(updateWorkspace).toHaveBeenCalledOnce();
  });

  it("revision قدیمی را برای جلوگیری از overwrite رد می‌کند", async () => {
    const { schedulingRepository, timetableRepository, updateWorkspace } = repositories();
    const result = await editTimetable(context, schedulingRepository, timetableRepository, { kind: "REMOVE", workspaceId, revision: 2, sessionId: "r1:1", confirmInvalid: true });
    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("هم‌زمان") });
    expect(updateWorkspace).not.toHaveBeenCalled();
  });
});
