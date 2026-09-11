import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { WorkflowStepper, workflowSteps, type PlanningStep } from "@/components/planning/workflow-stepper";
import { StructureWorkspace } from "@/components/planning/structure-workspace";
import { CurriculumWorkspace } from "@/components/planning/curriculum-workspace";
import { TeacherWorkspace } from "@/components/teachers/teacher-workspace";
import { PreflightWorkspace } from "@/components/planning/preflight-workspace";
import { GenerateWorkspace } from "@/components/planning/generate-workspace";
import { TimetableWorkspace } from "@/components/timetable/timetable-workspace";
import { getDatabase } from "@/db/client";
import { getShellIdentity } from "@/modules/auth/dal";
import { createAcademicStructureRepository } from "@/modules/academic-structure/repository";
import { createCurriculumRepository } from "@/modules/curriculum/repository";
import { createTeacherRepository } from "@/modules/teachers/repository";
import { createSchedulingRepository } from "@/modules/scheduling/repository";
import { inspectSchedulingData } from "@/modules/scheduling/service";
import { createTimetableRepository } from "@/modules/timetable/repository";
import { getTimetableView } from "@/modules/timetable/service";
import { createScheduleVersionRepository } from "@/modules/schedule-versions/repository";

export const metadata: Metadata = { title: "برنامه‌ریزی" };

function isAvailableStep(value: string | undefined): value is PlanningStep { return workflowSteps.some((step) => step.key === value && step.available); }

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ step?: string; teacher?: string; run?: string; workspace?: string; version?: string; workspaceError?: string }> }) {
  const { context, schools } = await getShellIdentity();
  const params = await searchParams;
  const step: PlanningStep = isAvailableStep(params.step) ? params.step : "structure";
  const db = getDatabase();
  let content: React.ReactNode;
  if (step === "edit" || step === "publish") {
    const timetable = await getTimetableView(
      context,
      createSchedulingRepository(db),
      createTimetableRepository(db),
      createScheduleVersionRepository(db),
      { workspaceId: params.workspace, versionId: params.version },
    );
    content = timetable ? <TimetableWorkspace key={timetable.version?.id ?? timetable.workspaceId ?? timetable.source.candidateId} initialData={timetable} returnTo="planning" publishFocus={step === "publish"} /> : (
      <section className="panel timetable-empty">
        <CalendarDays size={30} />
        <h2>هنوز برنامه‌ای برای بررسی آماده نیست</h2>
        <p>ابتدا یک برنامه معتبر تولید و یکی از گزینه‌ها را برای اصلاح انتخاب کنید.</p>
        <a className="button button--primary button--md" href="/planning?step=generate">رفتن به تولید برنامه</a>
      </section>
    );
  } else if (step === "review" || step === "generate") {
    const repository = createSchedulingRepository(db); const inspection = await inspectSchedulingData(context, repository);
    content = step === "review"
      ? <PreflightWorkspace result={inspection.preflight} />
      : <GenerateWorkspace preflight={inspection.preflight} run={await repository.getRun(context, params.run)} workspaceError={params.workspaceError === "1"} />;
  } else if (step === "curriculum") content = <CurriculumWorkspace data={await createCurriculumRepository(db).getWorkspace(context)} />;
  else if (step === "teachers") content = <TeacherWorkspace embedded data={await createTeacherRepository(db).getWorkspace(context, params.teacher)} />;
  else content = <StructureWorkspace data={await createAcademicStructureRepository(db).getWorkspace(context)} />;
  return <AppShell context={context} schools={schools}><Breadcrumbs items={[{ label: "داشبورد", href: "/" }, { label: "برنامه‌ریزی" }]} /><section className="page-heading page-heading--compact"><div><h1>برنامه‌ریزی برنامه هفتگی</h1><p>اطلاعات مدرسه را یک‌بار وارد کنید؛ در تولیدهای بعدی دوباره استفاده می‌شوند.</p></div></section><WorkflowStepper activeStep={step} />{content}</AppShell>;
}
