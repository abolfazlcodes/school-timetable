"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleX,
  Download,
  History,
  LoaderCircle,
  Plus,
  Printer,
  RefreshCw,
  Repeat2,
  Save,
  Send,
  School,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn, formatPersianDateTime } from "@/lib/utils";
import { assignedHoursFor, expandSessions } from "@/modules/scheduling/types";
import { createScheduleWorkspaceAction, editTimetableAction } from "@/modules/timetable/actions";
import { listUnscheduledSessions, type TimetableEditInput, type TimetableEditResult, type TimetableViewData } from "@/modules/timetable/service";
import { archiveScheduleVersionAction, forkScheduleVersionAction, saveScheduleVersionAction } from "@/modules/schedule-versions/actions";

type ViewMode = "classes" | "teachers" | "school";
type ResourceViewMode = Exclude<ViewMode, "school">;
type EditorTarget = { kind: "edit"; sessionId: string } | { kind: "add"; dayId: string; startPosition: number };

function issueCounts(issues: TimetableViewData["issues"]) {
  return {
    errors: issues.filter((issue) => issue.severity === "ERROR").length,
    warnings: issues.filter((issue) => issue.severity === "WARNING").length,
  };
}

function EditDrawer({
  target,
  data,
  onClose,
  onResult,
}: {
  target: EditorTarget;
  data: TimetableViewData;
  onClose: () => void;
  onResult: (result: Extract<TimetableEditResult, { status: "success" }>) => void;
}) {
  const sessions = expandSessions(data.problem);
  const missingSessions = listUnscheduledSessions(data.problem, data.assignments);
  const currentAssignment = target.kind === "edit" ? data.assignments.find((item) => item.sessionId === target.sessionId) : undefined;
  const initialSession = currentAssignment
    ? sessions.find((item) => item.id === currentAssignment.sessionId)
    : missingSessions[0];
  const [sessionId, setSessionId] = useState(initialSession?.id ?? "");
  const selectedSession = sessions.find((item) => item.id === sessionId);
  const qualifiedTeachers = data.problem.teachers.filter((teacher) => selectedSession && assignedHoursFor(teacher, selectedSession.subjectId) > 0);
  const [teacherId, setTeacherId] = useState(currentAssignment?.teacherId ?? qualifiedTeachers[0]?.id ?? "");
  const [dayId, setDayId] = useState(currentAssignment?.dayId ?? (target.kind === "add" ? target.dayId : data.problem.periods[0]?.dayId ?? ""));
  const [startPosition, setStartPosition] = useState(currentAssignment?.startPosition ?? (target.kind === "add" ? target.startPosition : 1));
  const [swapTarget, setSwapTarget] = useState("");
  const [feedback, setFeedback] = useState<TimetableEditResult | null>(null);
  const [pendingCommand, setPendingCommand] = useState<TimetableEditInput | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const effectiveTeacherId = qualifiedTeachers.some((teacher) => teacher.id === teacherId) ? teacherId : qualifiedTeachers[0]?.id ?? "";

  const availableStarts = (() => {
    if (!selectedSession) return [];
    const dayPeriods = data.problem.periods.filter((period) => period.dayId === dayId).sort((a, b) => a.position - b.position);
    return dayPeriods;
  })();

  const effectiveStartPosition = availableStarts.some((period) => period.position === startPosition) ? startPosition : availableStarts[0]?.position ?? 1;

  const sameDurationAssignments = data.assignments.filter((assignment) => selectedSession && assignment.sessionId !== selectedSession.id);

  function execute(command: TimetableEditInput) {
    startTransition(async () => {
      const result = await editTimetableAction(command);
      setFeedback(result);
      if (result.status === "confirm-warning") setPendingCommand(command);
      if (result.status === "success") {
        setPendingCommand(null);
        onResult(result);
        onClose();
      }
    });
  }

  function savePlacement(confirmWarnings = false) {
    if (!data.workspaceId || !selectedSession || !effectiveTeacherId) return;
    execute({
      kind: "PLACE",
      workspaceId: data.workspaceId,
      revision: data.revision,
      sessionId: selectedSession.id,
      teacherId: effectiveTeacherId,
      dayId,
      startPosition: effectiveStartPosition,
      confirmWarnings,
    });
  }

  function saveSwap(confirmWarnings = false) {
    if (!data.workspaceId || !currentAssignment || !swapTarget) return;
    execute({
      kind: "SWAP",
      workspaceId: data.workspaceId,
      revision: data.revision,
      sessionId: currentAssignment.sessionId,
      targetSessionId: swapTarget,
      confirmWarnings,
    });
  }

  return (
    <>
      <button className="timetable-drawer-backdrop" onClick={onClose} aria-label="بستن پنل ویرایش" />
      <aside className="timetable-drawer" role="dialog" aria-modal="true" aria-labelledby="lesson-editor-title">
        <header>
          <div>
            <strong id="lesson-editor-title">{target.kind === "edit" ? "ویرایش جلسه" : "افزودن جلسه"}</strong>
            <span>{selectedSession ? `${selectedSession.subjectName} · ${selectedSession.className}` : "یک جلسه انتخاب کنید"}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="بستن"><X size={19} /></Button>
        </header>
        <div className="timetable-drawer__body">
          {target.kind === "add" ? (
            <label className="compact-field">
              <span>جلسه جایگذاری‌نشده</span>
              <Select value={sessionId} onChange={(event) => setSessionId(event.target.value)} aria-label="جلسه جایگذاری‌نشده">
                {missingSessions.map((session) => <option value={session.id} key={session.id}>{session.subjectName} · {session.className} · {session.workloadHours.toLocaleString("fa-IR")} ساعت آموزشی</option>)}
              </Select>
            </label>
          ) : null}
          {selectedSession ? (
            <div className="lesson-summary">
              <span>درس<strong>{selectedSession.subjectName}</strong></span>
              <span>کلاس<strong>{selectedSession.className}</strong></span>
              <span>بار جلسه<strong>{selectedSession.workloadHours.toLocaleString("fa-IR")} ساعت آموزشی</strong></span>
            </div>
          ) : <p className="inline-callout">جلسه‌ای برای جایگذاری باقی نمانده است.</p>}
          {selectedSession ? (
            <div className="editor-fields">
              <label className="compact-field"><span>دبیر</span><Select value={effectiveTeacherId} onChange={(event) => setTeacherId(event.target.value)} aria-label="دبیر جلسه">{qualifiedTeachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</Select></label>
              <label className="compact-field"><span>روز</span><Select value={dayId} onChange={(event) => setDayId(event.target.value)} aria-label="روز جلسه">{[...new Map(data.problem.periods.map((period) => [period.dayId, period])).values()].sort((a, b) => a.dayOrder - b.dayOrder).map((day) => <option value={day.dayId} key={day.dayId}>{day.dayLabel}</option>)}</Select></label>
              <label className="compact-field"><span>شروع جلسه</span><Select value={effectiveStartPosition} onChange={(event) => setStartPosition(Number(event.target.value))} aria-label="زنگ شروع">{availableStarts.map((period) => <option value={period.position} key={period.id}>{period.label} · {period.startTime.slice(0, 5)}</option>)}</Select></label>
            </div>
          ) : null}

          {feedback && feedback.status !== "success" ? (
            <div className={cn("editor-feedback", feedback.status === "error" || feedback.status === "confirm-invalid" ? "is-error" : "is-warning")} role={feedback.status === "error" ? "alert" : "status"}>
              {feedback.status === "error" || feedback.status === "confirm-invalid" ? <CircleX size={18} /> : <AlertTriangle size={18} />}
              <div><strong>{feedback.message}</strong>{"issues" in feedback && feedback.issues ? feedback.issues.slice(0, 3).map((issue) => <span key={`${issue.code}:${issue.entityId}`}>{issue.message}</span>) : null}</div>
            </div>
          ) : null}

          {feedback?.status === "confirm-warning" && pendingCommand ? (
            <Button className="editor-confirm-warning" variant="secondary" onClick={() => execute({ ...pendingCommand, confirmWarnings: true } as TimetableEditInput)} disabled={isPending}>
              <AlertTriangle size={16} />پذیرش هشدار و ذخیره
            </Button>
          ) : null}

          {target.kind === "edit" && currentAssignment ? (
            <details className="editor-swap">
              <summary><Repeat2 size={15} />تعویض با جلسه دیگر</summary>
              <label className="compact-field"><span>جلسه مقصد</span><Select value={swapTarget} onChange={(event) => setSwapTarget(event.target.value)} aria-label="جلسه مقصد"><option value="">انتخاب کنید</option>{sameDurationAssignments.map((assignment) => { const session = sessions.find((item) => item.id === assignment.sessionId)!; const period = data.problem.periods.find((item) => item.id === assignment.periodIds[0]); return <option value={assignment.sessionId} key={assignment.sessionId}>{session.subjectName} · {session.className} · {period?.dayLabel} {period?.label}</option>; })}</Select></label>
              <Button variant="secondary" size="sm" onClick={() => saveSwap()} disabled={!swapTarget || isPending}><Repeat2 size={15} />تعویض دو جلسه</Button>
            </details>
          ) : null}

          {target.kind === "edit" && currentAssignment ? (
            <div className="editor-delete">
              {!showDeleteConfirm ? <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={15} />برداشتن از جدول</Button> : (
                <div className="editor-delete__confirm">
                  <p>با حذف این جایگذاری، برنامه تا افزودن دوباره جلسه نامعتبر خواهد بود.</p>
                  <Button variant="danger" size="sm" disabled={isPending} onClick={() => data.workspaceId && execute({ kind: "REMOVE", workspaceId: data.workspaceId, revision: data.revision, sessionId: currentAssignment.sessionId, confirmInvalid: true })}><Trash2 size={15} />تأیید و برداشتن</Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>انصراف</Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <footer>
          <Button onClick={() => savePlacement()} disabled={!selectedSession || !effectiveTeacherId || !availableStarts.length || isPending}>{isPending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{isPending ? "در حال بررسی…" : target.kind === "edit" ? "ذخیره تغییر" : "افزودن به جدول"}</Button>
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
        </footer>
      </aside>
    </>
  );
}

function TimetableGrid({
  data,
  mode,
  selectedClassId,
  selectedTeacherId,
  editable,
  onSelect,
}: {
  data: TimetableViewData;
  mode: ResourceViewMode;
  selectedClassId: string;
  selectedTeacherId: string;
  editable: boolean;
  onSelect: (target: EditorTarget) => void;
}) {
  const days = [...new Map(data.problem.periods.map((period) => [period.dayId, period])).values()].sort((a, b) => a.dayOrder - b.dayOrder);
  const positions = [...new Set(data.problem.periods.map((period) => period.position))].sort((a, b) => a - b);
  const sessions = new Map(expandSessions(data.problem).map((session) => [session.id, session]));
  const teachers = new Map(data.problem.teachers.map((teacher) => [teacher.id, teacher]));
  const relevantAssignments = data.assignments.filter((assignment) => mode === "classes" ? assignment.classId === selectedClassId : assignment.teacherId === selectedTeacherId);

  return (
    <div className="timetable-grid-wrap">
      <table className="timetable-grid" style={{ minWidth: Math.max(760, positions.length * 145 + 100) }}>
        <thead><tr><th>روز</th>{positions.map((position) => { const times = [...new Set(data.problem.periods.filter((period) => period.position === position).map((period) => `${period.startTime.slice(0, 5)}–${period.endTime.slice(0, 5)}`))]; return <th key={position}><strong>زنگ {position.toLocaleString("fa-IR")}</strong><small>{times.length === 1 ? times[0] : "ساعت متغیر"}</small></th>; })}</tr></thead>
        <tbody>{days.map((day) => {
          const cells: React.ReactNode[] = [];
          for (const position of positions) {
            const period = data.problem.periods.find((item) => item.dayId === day.dayId && item.position === position);
            if (!period) {
              cells.push(<td className="is-unavailable" key={position}>—</td>);
              continue;
            }
            const assignment = relevantAssignments.find((item) => item.periodIds.includes(period.id));
            if (assignment && assignment.startPosition !== position) continue;
            if (assignment) {
              const session = sessions.get(assignment.sessionId);
              const teacher = teachers.get(assignment.teacherId);
              const cellIssues = data.issues.filter((issue) => issue.entityType === "session" && issue.entityId === assignment.sessionId);
              const hasError = cellIssues.some((issue) => issue.severity === "ERROR");
              const hasWarning = cellIssues.some((issue) => issue.severity === "WARNING");
              cells.push(
                <td colSpan={assignment.periodIds.length} key={position} className={cn("has-lesson", hasError && "has-error", !hasError && hasWarning && "has-warning")}>
                  <button type="button" className="lesson-cell" onClick={() => editable && onSelect({ kind: "edit", sessionId: assignment.sessionId })} disabled={!editable} aria-label={`ویرایش ${session?.subjectName ?? "جلسه"}`}>
                    <strong>{session?.subjectName}</strong>
                    <span>{mode === "classes" ? teacher?.name : session?.className}</span>
                    <small><bdi>{period.startTime.slice(0, 5)}–{data.problem.periods.find((item) => item.id === assignment.periodIds.at(-1))?.endTime.slice(0, 5)}</bdi>{assignment.periodIds.length > 1 ? ` · ${assignment.periodIds.length.toLocaleString("fa-IR")} زنگ` : ""}{hasError ? " · خطا" : hasWarning ? " · هشدار" : ""}</small>
                  </button>
                </td>,
              );
            } else {
              cells.push(
                <td className="is-empty" key={position}>
                  {editable ? <button type="button" onClick={() => onSelect({ kind: "add", dayId: day.dayId, startPosition: position })} aria-label={`افزودن جلسه در ${day.dayLabel} زنگ ${position.toLocaleString("fa-IR")}`}><small><bdi>{period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}</bdi></small><span><Plus size={14} /> افزودن</span></button> : <span className="empty-period-time"><bdi>{period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}</bdi></span>}
                </td>,
              );
            }
          }
          return <tr key={day.dayId}><th><strong>{day.dayLabel}</strong></th>{cells}</tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function SchoolWideGrid({ data, majorId }: { data: TimetableViewData; majorId: string }) {
  const days = [...new Map(data.problem.periods.map((period) => [period.dayId, period])).values()].sort((a, b) => a.dayOrder - b.dayOrder);
  const positions = [...new Set(data.problem.periods.map((period) => period.position))].sort((a, b) => a - b);
  const timesByPosition = new Map(positions.map((position) => [position, [...new Set(data.problem.periods.filter((period) => period.position === position).map((period) => `${period.startTime.slice(0, 5)}–${period.endTime.slice(0, 5)}`))]]));
  const sessions = new Map(expandSessions(data.problem).map((session) => [session.id, session]));
  const teachers = new Map(data.problem.teachers.map((teacher) => [teacher.id, teacher.name]));
  const classes = data.problem.classes.filter((schoolClass) => majorId ? schoolClass.majorId === majorId : true);
  const assignmentsBySlot = new Map<string, TimetableViewData["assignments"][number]>();

  for (const assignment of data.assignments) {
    for (const periodId of assignment.periodIds) assignmentsBySlot.set(`${assignment.classId}:${periodId}`, assignment);
  }

  if (!classes.length) {
    return <div className="major-timetable-empty"><School size={24} /><strong>برای این رشته کلاسی تعریف نشده است.</strong><span>ساختار مدرسه و کلاس‌های فعال سال تحصیلی را بررسی کنید.</span></div>;
  }

  return (
    <div className="timetable-grid-wrap major-timetable-wrap">
      <table className="major-timetable-grid" style={{ minWidth: Math.max(820, classes.length * positions.length * 74 + 104) }} aria-label="برنامه یکپارچه کلاس‌های رشته">
        <thead>
          <tr>
            <th rowSpan={2} className="major-timetable-grid__corner" scope="col">ایام هفته</th>
            {classes.map((schoolClass) => <th key={schoolClass.id} colSpan={positions.length} scope="colgroup" className="major-timetable-grid__class"><strong>{schoolClass.name}</strong><small>{schoolClass.gradeName}</small></th>)}
          </tr>
          <tr>
            {classes.flatMap((schoolClass) => positions.map((position, positionIndex) => {
              const times = timesByPosition.get(position) ?? [];
              return <th key={`${schoolClass.id}:${position}`} scope="col" className={cn("major-timetable-grid__period", positionIndex === 0 && "is-class-start")}><strong>زنگ {position.toLocaleString("fa-IR")}</strong><small>{times.length === 1 ? times[0] : "ساعت متغیر"}</small></th>;
            }))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.dayId}>
              <th scope="row" className="major-timetable-grid__day">{day.dayLabel}</th>
              {classes.flatMap((schoolClass) => positions.map((position, positionIndex) => {
                const period = data.problem.periods.find((item) => item.dayId === day.dayId && item.position === position);
                if (!period) return <td key={`${schoolClass.id}:${position}`} className={cn("major-timetable-grid__cell", "is-unavailable", positionIndex === 0 && "is-class-start")}>—</td>;
                const assignment = assignmentsBySlot.get(`${schoolClass.id}:${period.id}`);
                if (!assignment) return <td key={`${schoolClass.id}:${position}`} className={cn("major-timetable-grid__cell", "is-empty", positionIndex === 0 && "is-class-start")}><span>—</span></td>;
                const session = sessions.get(assignment.sessionId);
                const hasVariableTime = (timesByPosition.get(position)?.length ?? 0) > 1;
                const cellIssues = data.issues.filter((issue) => issue.entityType === "session" && issue.entityId === assignment.sessionId);
                const hasError = cellIssues.some((issue) => issue.severity === "ERROR");
                const hasWarning = cellIssues.some((issue) => issue.severity === "WARNING");
                return (
                  <td key={`${schoolClass.id}:${position}`} className={cn("major-timetable-grid__cell", "has-lesson", hasError && "has-error", !hasError && hasWarning && "has-warning", positionIndex === 0 && "is-class-start")}>
                    <strong>{session?.subjectName ?? "درس"}</strong>
                    <span>{teachers.get(assignment.teacherId) ?? "دبیر تعیین نشده"}</span>
                    {hasVariableTime || assignment.startPosition !== position ? <small>{hasVariableTime ? <bdi>{period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}</bdi> : null}{assignment.startPosition !== position ? `${hasVariableTime ? " · " : ""}ادامه جلسه` : ""}</small> : null}
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const versionLabels = { DRAFT: "پیش‌نویس", PUBLISHED: "منتشرشده", ARCHIVED: "بایگانی‌شده" } as const;

export function TimetableWorkspace({ initialData, returnTo = "timetable", publishFocus = false }: { initialData: TimetableViewData; returnTo?: "planning" | "timetable"; publishFocus?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState<ViewMode>("classes");
  const [gradeId, setGradeId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [schoolMajorId, setSchoolMajorId] = useState(initialData.problem.classes.find((schoolClass) => schoolClass.majorId)?.majorId ?? "");
  const filteredClasses = data.problem.classes.filter((schoolClass) => (!gradeId || schoolClass.gradeId === gradeId) && (!majorId || schoolClass.majorId === majorId));
  const [selectedClassId, setSelectedClassId] = useState(data.problem.classes[0]?.id ?? "");
  const [selectedTeacherId, setSelectedTeacherId] = useState(data.problem.teachers.find((teacher) => data.assignments.some((assignment) => assignment.teacherId === teacher.id))?.id ?? data.problem.teachers[0]?.id ?? "");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [notice, setNotice] = useState("");
  const [versionFeedback, setVersionFeedback] = useState<{ status: "error" | "confirm-warning"; message: string } | null>(null);
  const [isVersionPending, startVersionTransition] = useTransition();
  const counts = issueCounts(data.issues);
  const grades = [...new Map(data.problem.classes.map((item) => [item.gradeId, item.gradeName])).entries()];
  const majors = [...new Map(data.problem.classes.filter((item) => item.majorId).map((item) => [item.majorId!, item.majorName ?? "بدون رشته"])).entries()];
  const missingSessions = listUnscheduledSessions(data.problem, data.assignments);

  const effectiveClassId = filteredClasses.some((item) => item.id === selectedClassId) ? selectedClassId : filteredClasses[0]?.id ?? "";
  const effectiveSchoolMajorId = majors.some(([id]) => id === schoolMajorId) ? schoolMajorId : majors[0]?.[0] ?? "";
  const schoolMajorName = majors.find(([id]) => id === effectiveSchoolMajorId)?.[1];
  const exportSource = data.mode === "version" && data.version
    ? `version=${data.version.id}`
    : data.workspaceId
      ? `workspace=${data.workspaceId}`
      : `run=${data.source.runId}&rank=${data.source.rank}`;
  const exportView = mode === "classes" ? `class&resource=${effectiveClassId}` : mode === "teachers" ? `teacher&resource=${selectedTeacherId}` : "school";

  function saveVersion(publish: boolean, confirmWarnings = false) {
    if (!data.workspaceId) return;
    setVersionFeedback(null);
    startVersionTransition(async () => {
      const result = await saveScheduleVersionAction({ workspaceId: data.workspaceId!, publish, confirmWarnings });
      if (result.status === "success") {
        setNotice(result.message);
        if (result.version) {
          const item = {
            id: result.version.id,
            versionNumber: result.version.versionNumber,
            status: result.version.status,
            createdAt: result.version.createdAt.toISOString(),
            publishedAt: result.version.publishedAt?.toISOString() ?? null,
          };
          setData((current) => ({
            ...current,
            versions: [item, ...current.versions.map((version) => publish && version.status === "PUBLISHED" ? { ...version, status: "ARCHIVED" as const } : version)],
          }));
        }
        router.refresh();
      } else setVersionFeedback(result);
    });
  }

  function forkVersion() {
    if (!data.version) return;
    startVersionTransition(async () => {
      const result = await forkScheduleVersionAction(data.version!.id);
      if (result.status === "success" && result.workspaceId) router.push(returnTo === "planning" ? `/planning?step=edit&workspace=${result.workspaceId}` : `/timetable?workspace=${result.workspaceId}`);
      else if (result.status !== "success") setVersionFeedback(result);
    });
  }

  function archiveVersion() {
    if (!data.version) return;
    startVersionTransition(async () => {
      const result = await archiveScheduleVersionAction(data.version!.id);
      if (result.status === "success") {
        setNotice(result.message);
        setData((current) => ({ ...current, version: current.version ? { ...current.version, status: "ARCHIVED" } : null, versions: current.versions.map((version) => version.id === data.version!.id ? { ...version, status: "ARCHIVED" } : version) }));
        router.refresh();
      } else setVersionFeedback(result);
    });
  }

  function applyResult(result: Extract<TimetableEditResult, { status: "success" }>) {
    setData((current) => ({ ...current, revision: result.revision, assignments: result.assignments, issues: result.issues, updatedAt: result.updatedAt }));
    setNotice(result.message);
  }

  return (
    <section className="timetable-workspace">
      <div className="timetable-toolbar panel">
        <div className="timetable-tabs" role="tablist" aria-label="نوع نمایش برنامه">
          <button role="tab" aria-selected={mode === "classes"} className={mode === "classes" ? "is-active" : ""} onClick={() => setMode("classes")}><CalendarDays size={16} />کلاس‌ها</button>
          <button role="tab" aria-selected={mode === "teachers"} className={mode === "teachers" ? "is-active" : ""} onClick={() => setMode("teachers")}><UsersRound size={16} />دبیران</button>
          <button role="tab" aria-selected={mode === "school"} className={mode === "school" ? "is-active" : ""} onClick={() => setMode("school")}><School size={16} />کل مدرسه</button>
        </div>
        <div className="timetable-filters">
          {mode === "classes" ? <>
            <Select value={gradeId} onChange={(event) => setGradeId(event.target.value)} aria-label="فیلتر پایه"><option value="">همه پایه‌ها</option>{grades.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select>
            <Select value={majorId} onChange={(event) => setMajorId(event.target.value)} aria-label="فیلتر رشته"><option value="">همه رشته‌ها</option>{majors.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select>
            <Select value={effectiveClassId} onChange={(event) => setSelectedClassId(event.target.value)} aria-label="انتخاب کلاس">{filteredClasses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>
          </> : mode === "teachers" ? <Select value={selectedTeacherId} onChange={(event) => setSelectedTeacherId(event.target.value)} aria-label="انتخاب دبیر">{data.problem.teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</Select> : majors.length ? <><Select value={effectiveSchoolMajorId} onChange={(event) => setSchoolMajorId(event.target.value)} aria-label="انتخاب رشته نمای کل مدرسه">{majors.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select><span className="school-wide-hint">همه پایه‌ها و کلاس‌های رشته در یک جدول</span></> : <span className="school-wide-hint">همه کلاس‌های سال تحصیلی در یک جدول</span>}
        </div>
        <div className="timetable-actions">
          {data.mode === "candidate" ? (
            <form action={createScheduleWorkspaceAction}>
              <input type="hidden" name="runId" value={data.source.runId} />
              <input type="hidden" name="rank" value={data.source.rank} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="button button--primary button--sm" type="submit"><RefreshCw size={15} />آماده‌سازی برای اصلاح</button>
            </form>
          ) : null}
          {data.mode === "workspace" ? <>
            <Button variant="secondary" size="sm" onClick={() => saveVersion(false)} disabled={isVersionPending}><Save size={15} />ذخیره نسخه</Button>
            <Button size="sm" onClick={() => saveVersion(true)} disabled={isVersionPending || counts.errors > 0}>{isVersionPending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}تأیید و انتشار</Button>
          </> : null}
          {data.mode === "version" ? <>
            <Button size="sm" onClick={forkVersion} disabled={isVersionPending}><RefreshCw size={15} />ایجاد نسخهٔ کاری</Button>
            {data.version?.status !== "ARCHIVED" ? <Button variant="ghost" size="sm" onClick={archiveVersion} disabled={isVersionPending}><Archive size={15} />بایگانی</Button> : null}
          </> : null}
          <details className="version-menu">
            <summary className="button button--secondary button--sm"><History size={15} />نسخه‌ها</summary>
            <div className="version-menu__popover">
              <strong>تاریخچه نسخه‌ها</strong>
              {data.versions.length ? data.versions.map((version) => <Link key={version.id} href={returnTo === "planning" ? `/planning?step=publish&version=${version.id}` : `/timetable?version=${version.id}`} className={data.version?.id === version.id ? "is-active" : ""}><span>نسخه {version.versionNumber.toLocaleString("fa-IR")}<small>{formatPersianDateTime(version.createdAt)}</small></span><Badge variant={version.status === "PUBLISHED" ? "success" : version.status === "DRAFT" ? "warning" : undefined}>{versionLabels[version.status]}</Badge></Link>) : <span className="version-menu__empty">نسخه‌ای ذخیره نشده است.</span>}
            </div>
          </details>
          <details className="version-menu export-menu">
            <summary className="button button--secondary button--sm"><Download size={15} />خروجی</summary>
            <div className="version-menu__popover">
              <strong>خروجی نمای جاری</strong>
              <a href={`/api/timetable/export/pdf?${exportSource}&view=${exportView}`}>PDF فارسی</a>
              <a href={`/api/timetable/export/excel?${exportSource}&view=${exportView}`}>Excel</a>
              <strong>کل مدرسه</strong>
              <a href={`/api/timetable/export/pdf?${exportSource}&view=school`}>PDF کل مدرسه</a>
              <a href={`/api/timetable/export/excel?${exportSource}&view=school`}>Excel کل مدرسه</a>
            </div>
          </details>
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={15} />چاپ</Button>
        </div>
      </div>

      {publishFocus && data.mode === "workspace" ? <div className="publish-focus"><ShieldCheck size={20} /><span><strong>بازبینی نهایی برای انتشار</strong>نسخه منتشرشده، برنامه جاری مدرسه می‌شود و نسخه منتشرشده قبلی خودکار بایگانی خواهد شد.</span></div> : null}
      {versionFeedback ? <div className={cn("editor-feedback version-feedback", versionFeedback.status === "error" ? "is-error" : "is-warning")} role={versionFeedback.status === "error" ? "alert" : "status"}><AlertTriangle size={18} /><div><strong>{versionFeedback.message}</strong>{versionFeedback.status === "confirm-warning" ? <Button variant="secondary" size="sm" onClick={() => saveVersion(true, true)} disabled={isVersionPending}>پذیرش هشدارها و انتشار</Button> : null}</div></div> : null}

      <div className={cn("validation-strip", counts.errors ? "is-error" : counts.warnings ? "is-warning" : "is-valid")}>
        <div>{counts.errors ? <CircleX size={20} /> : counts.warnings ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}<span><strong>{counts.errors ? "برنامه نیازمند اصلاح است" : "برنامه از نظر قیود سخت معتبر است"}</strong><small>{counts.errors ? `${counts.errors.toLocaleString("fa-IR")} خطا مانع تأیید برنامه است.` : counts.warnings ? `${counts.warnings.toLocaleString("fa-IR")} هشدار قابل بررسی وجود دارد.` : "تداخل یا جلسه جایگذاری‌نشده‌ای وجود ندارد."}</small></span></div>
        <div className="validation-strip__counts"><Badge variant={counts.errors ? "danger" : "success"}>{counts.errors.toLocaleString("fa-IR")} خطا</Badge><Badge variant={counts.warnings ? "warning" : "success"}>{counts.warnings.toLocaleString("fa-IR")} هشدار</Badge></div>
      </div>

      {notice ? <div className="form-message form-message--success timetable-notice" role="status"><ShieldCheck size={16} />{notice}<button onClick={() => setNotice("")} aria-label="بستن پیام"><X size={14} /></button></div> : null}
      {data.mode === "candidate" ? <div className="candidate-readonly-note"><ShieldCheck size={17} /><span><strong>نمای فقط‌خواندنی گزینه {data.source.rank.toLocaleString("fa-IR")}</strong>برای شروع اصلاح، نسخهٔ کاری بسازید؛ نتیجه تولیدشده بدون تغییر حفظ می‌شود.</span></div> : null}
      {data.mode === "version" && data.version ? <div className="candidate-readonly-note"><History size={17} /><span><strong>نسخه {data.version.versionNumber.toLocaleString("fa-IR")} · {versionLabels[data.version.status]}</strong>این snapshot فقط‌خواندنی است؛ برای اصلاح، یک نسخهٔ کاری مستقل از آن بسازید.</span></div> : null}

      <article className="panel timetable-board">
        <header>
          <div><h2>{mode === "classes" ? data.problem.classes.find((item) => item.id === effectiveClassId)?.name ?? "برنامه کلاس" : mode === "teachers" ? data.problem.teachers.find((item) => item.id === selectedTeacherId)?.name ?? "برنامه دبیر" : schoolMajorName ? `برنامه همه کلاس‌های ${schoolMajorName}` : "برنامه کل مدرسه"}</h2><p>{data.academicYearTitle} · {data.version ? `نسخه ${data.version.versionNumber.toLocaleString("fa-IR")}` : `گزینه ${data.source.rank.toLocaleString("fa-IR")}`} · امتیاز {(data.source.score / 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}</p></div>
          <span>آخرین تغییر: {formatPersianDateTime(data.updatedAt)}</span>
        </header>
        {mode === "school" ? <SchoolWideGrid data={data} majorId={effectiveSchoolMajorId} /> : <TimetableGrid data={data} mode={mode} selectedClassId={effectiveClassId} selectedTeacherId={selectedTeacherId} editable={data.mode === "workspace"} onSelect={setEditor} />}
      </article>

      <details className="panel timetable-issues" open={counts.errors > 0}>
        <summary><span>{counts.errors ? <CircleX size={17} /> : <AlertTriangle size={17} />}خطاها و هشدارهای همین برنامه</span><Badge variant={counts.errors ? "danger" : counts.warnings ? "warning" : "success"}>{(counts.errors + counts.warnings).toLocaleString("fa-IR")} مورد</Badge></summary>
        <ul>{data.issues.filter((issue) => issue.severity !== "INFO").map((issue, index) => <li key={`${issue.code}:${issue.entityId}:${index}`}><Badge variant={issue.severity === "ERROR" ? "danger" : "warning"}>{issue.severity === "ERROR" ? "خطا" : "هشدار"}</Badge><span>{issue.message}</span></li>)}{!counts.errors && !counts.warnings ? <li className="is-valid"><CheckCircle2 size={17} />موردی برای اصلاح وجود ندارد.</li> : null}</ul>
      </details>

      {data.mode === "workspace" && missingSessions.length ? <div className="unscheduled-callout"><CircleX size={18} /><span><strong>{missingSessions.length.toLocaleString("fa-IR")} جلسه خارج از جدول است.</strong>روی یک خانه خالی بزنید و جلسه را دوباره جایگذاری کنید.</span></div> : null}
      {returnTo === "planning" ? <div className="step-footer"><Link className="button button--secondary button--md" href={`/planning?step=generate&run=${data.source.runId}`}>بازگشت به گزینه‌ها</Link>{data.mode === "workspace" ? <Link className="button button--primary button--md" href={`/planning?step=publish&workspace=${data.workspaceId}`}>رفتن به انتشار</Link> : <span className="muted">برای ادامه، یک نسخهٔ کاری بسازید.</span>}</div> : null}
      {editor && data.mode === "workspace" ? <EditDrawer key={`${editor.kind}:${editor.kind === "edit" ? editor.sessionId : `${editor.dayId}:${editor.startPosition}`}:${data.revision}`} target={editor} data={data} onClose={() => setEditor(null)} onResult={applyResult} /> : null}
    </section>
  );
}
