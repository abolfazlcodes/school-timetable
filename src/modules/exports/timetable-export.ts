import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expandSessions } from "@/modules/scheduling/types";
import type { TimetableViewData } from "@/modules/timetable/service";

export type ExportView = "class" | "teacher" | "school";

interface ExportRow {
  day: string;
  period: string;
  time: string;
  className: string;
  subject: string;
  teacher: string;
}

export interface TimetableExportModel {
  title: string;
  subtitle: string;
  rows: ExportRow[];
}

export function buildTimetableExport(data: TimetableViewData, view: ExportView, resourceId?: string): TimetableExportModel {
  const sessions = new Map(expandSessions(data.problem).map((session) => [session.id, session]));
  const teachers = new Map(data.problem.teachers.map((teacher) => [teacher.id, teacher.name]));
  const periods = new Map(data.problem.periods.map((period) => [period.id, period]));
  const selectedClass = data.problem.classes.find((item) => item.id === resourceId);
  const selectedTeacher = data.problem.teachers.find((item) => item.id === resourceId);
  if (view === "class" && !selectedClass) throw new Error("کلاس انتخاب‌شده معتبر نیست.");
  if (view === "teacher" && !selectedTeacher) throw new Error("دبیر انتخاب‌شده معتبر نیست.");

  const assignments = data.assignments
    .filter((item) => view === "school" || (view === "class" ? item.classId === resourceId : item.teacherId === resourceId))
    .sort((a, b) => {
      const periodA = periods.get(a.periodIds[0]);
      const periodB = periods.get(b.periodIds[0]);
      return (periodA?.dayOrder ?? 0) - (periodB?.dayOrder ?? 0) || a.startPosition - b.startPosition || a.classId.localeCompare(b.classId);
    });
  const rows = assignments.map((assignment) => {
    const session = sessions.get(assignment.sessionId);
    const first = periods.get(assignment.periodIds[0]);
    const last = periods.get(assignment.periodIds.at(-1) ?? "");
    return {
      day: first?.dayLabel ?? "—",
      period: assignment.periodIds.length === 1 ? first?.label ?? "—" : `${first?.label ?? "—"} تا ${last?.label ?? "—"}`,
      time: first && last ? `${first.startTime.slice(0, 5)} تا ${last.endTime.slice(0, 5)}` : "—",
      className: session?.className ?? "—",
      subject: session?.subjectName ?? "—",
      teacher: teachers.get(assignment.teacherId) ?? "—",
    };
  });
  const subject = view === "class" ? `کلاس ${selectedClass!.name}` : view === "teacher" ? `دبیر ${selectedTeacher!.name}` : "کل مدرسه";
  return {
    title: `برنامه هفتگی ${subject}`,
    subtitle: `${data.academicYearTitle} · ${data.version ? `نسخه ${data.version.versionNumber.toLocaleString("fa-IR")}` : "نسخه کاری"}`,
    rows,
  };
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function createExcelWorkbook(model: TimetableExportModel): Uint8Array {
  const headers = ["روز", "زنگ", "ساعت", "کلاس", "درس", "دبیر"];
  const rows = model.rows.map((row) => [row.day, row.period, row.time, row.className, row.subject, row.teacher]);
  const xmlRows = [headers, ...rows].map((row, rowIndex) => `<Row>${row.map((cell) => `<Cell ss:StyleID="${rowIndex === 0 ? "Header" : "Cell"}"><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join("")}</Row>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Vazirmatn" ss:Size="11"/></Style><Style ss:ID="Header"><Font ss:FontName="Vazirmatn" ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/></Style><Style ss:ID="Cell"><Alignment ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/></Style></Styles>
<Worksheet ss:Name="برنامه هفتگی"><Table><Row><Cell ss:MergeAcross="5" ss:StyleID="Header"><Data ss:Type="String">${escapeXml(model.title)}</Data></Cell></Row><Row><Cell ss:MergeAcross="5"><Data ss:Type="String">${escapeXml(model.subtitle)}</Data></Cell></Row>${xmlRows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/></WorksheetOptions></Worksheet></Workbook>`;
  return new TextEncoder().encode(`\ufeff${xml}`);
}

export async function createPersianPdf(model: TimetableExportModel): Promise<Uint8Array> {
  const document = new PDFDocument({ size: "A4", margin: 42, info: { Title: model.title, Author: "مدرسه‌یار" } });
  const chunks: Uint8Array[] = [];
  document.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  const complete = new Promise<Uint8Array>((resolve, reject) => {
    document.on("end", () => {
      const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
      const output = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
      resolve(output);
    });
    document.on("error", reject);
  });
  const fontPath = path.join(process.cwd(), "node_modules", "vazirmatn", "misc", "UI", "fonts", "ttf", "Vazirmatn-UI-Regular.ttf");
  document.registerFont("Vazirmatn", readFileSync(fontPath));
  document.font("Vazirmatn").fontSize(18).text(model.title, { align: "right" });
  document.moveDown(0.25).fontSize(10).fillColor("#475569").text(model.subtitle, { align: "right" });
  document.moveDown(0.7).fillColor("#0F172A");
  if (!model.rows.length) document.fontSize(11).text("جلسه‌ای برای این نما ثبت نشده است.", { align: "right" });
  for (const row of model.rows) {
    if (document.y > 760) document.addPage();
    document.fontSize(10).fillColor("#0F172A").text(`${row.day} · ${row.period} · ${row.time}`, { align: "right" });
    document.fontSize(11).text(`${row.subject} — ${row.className} — ${row.teacher}`, { align: "right" });
    document.moveDown(0.35).strokeColor("#CBD5E1").moveTo(42, document.y).lineTo(553, document.y).stroke().moveDown(0.4);
  }
  document.end();
  return complete;
}
