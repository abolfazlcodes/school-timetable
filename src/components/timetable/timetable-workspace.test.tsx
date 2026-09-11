import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeProblem } from "@/modules/scheduling/fixtures.test-helper";
import { validateSchedule } from "@/modules/scheduling/validator";
import type { TimetableViewData } from "@/modules/timetable/service";
import { TimetableWorkspace } from "./timetable-workspace";

vi.mock("@/modules/timetable/actions", () => ({
  createScheduleWorkspaceAction: vi.fn(),
  editTimetableAction: vi.fn(),
}));
vi.mock("@/modules/schedule-versions/actions", () => ({
  saveScheduleVersionAction: vi.fn(),
  forkScheduleVersionAction: vi.fn(),
  archiveScheduleVersionAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

function makeData(mode: TimetableViewData["mode"] = "workspace"): TimetableViewData {
  const problem = makeProblem();
  const assignments = [
    { sessionId: "r1:1", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 1, periodIds: ["sa-1"] },
    { sessionId: "r1:2", curriculumId: "r1", classId: "c1", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 1, periodIds: ["su-1"] },
    { sessionId: "r2:1", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sat", startPosition: 2, periodIds: ["sa-2"] },
    { sessionId: "r2:2", curriculumId: "r2", classId: "c2", subjectId: "math", teacherId: "t1", dayId: "sun", startPosition: 2, periodIds: ["su-2"] },
  ];
  return {
    mode,
    workspaceId: mode === "workspace" ? "40000000-0000-4000-8000-000000000001" : null,
    revision: 0,
    source: { candidateId: "candidate", runId: "run", rank: 1, score: 9800 },
    academicYearTitle: problem.academicYearTitle,
    generatedAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
    problem,
    assignments,
    issues: validateSchedule(problem, assignments),
    version: null,
    versions: [],
  };
}

describe("فضای کاری برنامه هفتگی", () => {
  beforeEach(() => vi.clearAllMocks());

  it("نمای کلاس و دبیر را در یک grid و بدون route جدا نمایش می‌دهد", () => {
    render(<TimetableWorkspace initialData={makeData()} />);
    expect(screen.getByRole("tab", { name: "کلاس‌ها" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("table")).toHaveTextContent("شنبه");
    expect(screen.getByRole("table")).toHaveTextContent("ریاضی");
    fireEvent.click(screen.getByRole("tab", { name: "دبیران" }));
    expect(screen.getByRole("tab", { name: "دبیران" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("انتخاب دبیر")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "کل مدرسه" }));
    expect(screen.getByRole("table")).toHaveTextContent("کلاس");
    expect(screen.getByRole("table")).toHaveTextContent("دبیر");
  });

  it("ساعت دقیق زنگ را داخل grid نمایش می‌دهد", () => {
    const data = makeData();
    data.problem.periods[0] = { ...data.problem.periods[0], startTime: "08:00", endTime: "09:15" };
    render(<TimetableWorkspace initialData={data} />);
    expect(screen.getAllByText("08:00–09:15").length).toBeGreaterThan(0);
  });

  it("با کلیک روی جلسه، drawer و عملیات ویرایش/تعویض/حذف را همان‌جا باز می‌کند", () => {
    render(<TimetableWorkspace initialData={makeData()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "ویرایش ریاضی" })[0]);
    expect(screen.getByRole("dialog", { name: "ویرایش جلسه" })).toBeInTheDocument();
    expect(screen.getByLabelText("دبیر جلسه")).toBeInTheDocument();
    expect(screen.getByText("تعویض با جلسه دیگر")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /برداشتن از جدول/ }));
    expect(screen.getByRole("button", { name: /تأیید و برداشتن/ })).toBeInTheDocument();
  });

  it("گزینه تولیدشده را قبل از ساخت نسخه کاری فقط‌خواندنی نگه می‌دارد", () => {
    render(<TimetableWorkspace initialData={makeData("candidate")} />);
    expect(screen.getByText(/نمای فقط‌خواندنی گزینه/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /آماده‌سازی برای اصلاح/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "ویرایش ریاضی" })[0]).toBeDisabled();
  });
});
