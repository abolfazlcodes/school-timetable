import { createPersianPdf } from "@/modules/exports/timetable-export";
import { loadTimetableExport } from "@/modules/exports/load-export";
import { unstable_rethrow } from "next/navigation";

export async function GET(request: Request) {
  try {
    const model = await loadTimetableExport(request);
    const file = await createPersianPdf(model);
    return new Response(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=school-wide-timetable.pdf", "Cache-Control": "private, no-store" } });
  } catch (error) {
    unstable_rethrow(error);
    return Response.json({ message: error instanceof Error ? error.message : "ساخت خروجی PDF انجام نشد." }, { status: 400 });
  }
}
