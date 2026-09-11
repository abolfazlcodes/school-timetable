import { createExcelWorkbook } from "@/modules/exports/timetable-export";
import { loadTimetableExport } from "@/modules/exports/load-export";
import { unstable_rethrow } from "next/navigation";

export async function GET(request: Request) {
  try {
    const model = await loadTimetableExport(request);
    const file = createExcelWorkbook(model);
    return new Response(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": "attachment; filename=school-timetable.xls", "Cache-Control": "private, no-store" } });
  } catch (error) {
    unstable_rethrow(error);
    return Response.json({ message: error instanceof Error ? error.message : "ساخت خروجی Excel انجام نشد." }, { status: 400 });
  }
}
