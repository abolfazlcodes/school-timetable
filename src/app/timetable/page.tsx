import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TimetableWorkspace } from "@/components/timetable/timetable-workspace";
import { getDatabase } from "@/db/client";
import { getShellIdentity } from "@/modules/auth/dal";
import { createSchedulingRepository } from "@/modules/scheduling/repository";
import { createScheduleVersionRepository } from "@/modules/schedule-versions/repository";
import { createTimetableRepository } from "@/modules/timetable/repository";
import { getTimetableView } from "@/modules/timetable/service";

export const metadata: Metadata = { title: "برنامه هفتگی" };

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; run?: string; rank?: string; version?: string; workspaceError?: string }>;
}) {
  const { context, schools } = await getShellIdentity();
  const params = await searchParams;
  const db = getDatabase();
  const parsedRank = params.rank ? Number(params.rank) : undefined;
  const rank = parsedRank && Number.isInteger(parsedRank) && parsedRank > 0 ? parsedRank : undefined;
  const data = await getTimetableView(
    context,
    createSchedulingRepository(db),
    createTimetableRepository(db),
    createScheduleVersionRepository(db),
    { workspaceId: params.workspace, runId: params.run, rank, versionId: params.version },
  );
  return (
    <AppShell context={context} schools={schools}>
      <Breadcrumbs items={[{ label: "داشبورد", href: "/" }, { label: "برنامه هفتگی" }]} />
      <section className="page-heading page-heading--compact">
        <div><h1>برنامه هفتگی</h1><p>مشاهده، بررسی تداخل‌ها و اصلاح برنامه در یک فضای کاری</p></div>
      </section>
      {params.workspaceError === "1" ? <p className="form-message form-message--error" role="alert">آماده‌سازی گزینه برای اصلاح انجام نشد.</p> : null}
      {data ? <TimetableWorkspace key={data.version?.id ?? data.workspaceId ?? data.source.candidateId} initialData={data} /> : (
        <section className="panel timetable-empty">
          <CalendarDays size={30} />
          <h2>هنوز برنامه‌ای تولید نشده است</h2>
          <p>پس از تکمیل اطلاعات و تولید برنامه، جدول کلاس‌ها و دبیران اینجا نمایش داده می‌شود.</p>
          <Link className="button button--primary button--md" href="/planning?step=generate">تولید برنامه</Link>
        </section>
      )}
    </AppShell>
  );
}
