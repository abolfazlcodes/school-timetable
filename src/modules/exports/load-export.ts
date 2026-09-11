import { getDatabase } from "@/db/client";
import { requireTenantContext } from "@/modules/auth/dal";
import { createScheduleVersionRepository } from "@/modules/schedule-versions/repository";
import { createSchedulingRepository } from "@/modules/scheduling/repository";
import { createTimetableRepository } from "@/modules/timetable/repository";
import { getTimetableView } from "@/modules/timetable/service";
import { buildTimetableExport, type ExportView } from "./timetable-export";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ExportQuery {
  view: ExportView;
  resourceId?: string;
  workspaceId?: string;
  versionId?: string;
  runId?: string;
  rank?: number;
}

export function parseExportQuery(url: URL): ExportQuery {
  const view = url.searchParams.get("view");
  if (view !== "class" && view !== "teacher" && view !== "school") throw new Error("نوع نمای خروجی معتبر نیست.");
  const workspaceId = url.searchParams.get("workspace") ?? undefined;
  const versionId = url.searchParams.get("version") ?? undefined;
  const runId = url.searchParams.get("run") ?? undefined;
  const sources = [workspaceId, versionId, runId].filter(Boolean);
  if (sources.length !== 1 || sources.some((value) => !uuidPattern.test(value!))) throw new Error("منبع برنامه برای خروجی معتبر نیست.");
  const rankValue = url.searchParams.get("rank");
  const rank = rankValue === null ? undefined : Number(rankValue);
  if (runId && (!Number.isInteger(rank) || rank! < 1)) throw new Error("گزینه برنامه برای خروجی معتبر نیست.");
  if (!runId && rankValue !== null) throw new Error("شماره گزینه فقط همراه اجرای برنامه معتبر است.");
  const resourceId = url.searchParams.get("resource") ?? undefined;
  if ((view === "class" || view === "teacher") && (!resourceId || !uuidPattern.test(resourceId))) throw new Error("کلاس یا دبیر خروجی معتبر نیست.");
  if (view === "school" && resourceId) throw new Error("نمای کل مدرسه به فیلتر کلاس یا دبیر نیاز ندارد.");
  return { view, resourceId, workspaceId, versionId, runId, rank };
}

export async function loadTimetableExport(request: Request) {
  const url = new URL(request.url);
  const query = parseExportQuery(url);
  const context = await requireTenantContext();
  const db = getDatabase();
  const data = await getTimetableView(
    context,
    createSchedulingRepository(db),
    createTimetableRepository(db),
    createScheduleVersionRepository(db),
    {
      workspaceId: query.workspaceId,
      versionId: query.versionId,
      runId: query.runId,
      rank: query.rank,
    },
  );
  if (!data) throw new Error("برنامه‌ای برای خروجی پیدا نشد.");
  return buildTimetableExport(data, query.view, query.resourceId);
}
