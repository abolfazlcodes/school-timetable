import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expandSessions, normalizedWeekPattern, weekPatternLabel } from "@/modules/scheduling/types";
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

export interface SchoolTimetableLesson {
  sessionId: string;
  subject: string;
  teacher: string;
  weekLabel: string | null;
  continuation: boolean;
  time: string | null;
}

export interface SchoolTimetableCell {
  unavailable: boolean;
  severity: "ERROR" | "WARNING" | null;
  lessons: SchoolTimetableLesson[];
}

export interface SchoolTimetablePage {
  majorId: string;
  majorName: string;
  classes: Array<{ id: string; name: string; gradeName: string }>;
  positions: Array<{ position: number; label: string; time: string }>;
  days: Array<{ id: string; label: string }>;
  cells: Record<string, SchoolTimetableCell>;
}

export interface TimetableExportModel {
  title: string;
  subtitle: string;
  rows: ExportRow[];
  schoolPages?: SchoolTimetablePage[];
}

function schoolCellKey(dayId: string, classId: string, position: number) {
  return `${dayId}:${classId}:${position}`;
}

function majorPriority(name: string) {
  if (name.includes("تجربی")) return 0;
  if (name.includes("ریاضی")) return 1;
  if (name.includes("انسانی")) return 2;
  return 3;
}

export function buildSchoolTimetablePages(data: TimetableViewData): SchoolTimetablePage[] {
  const sortedPeriods = [...data.problem.periods].sort(
    (a, b) => a.dayOrder - b.dayOrder || a.position - b.position,
  );
  const days = [
    ...new Map(
      sortedPeriods.map((period) => [
        period.dayId,
        { id: period.dayId, label: period.dayLabel },
      ]),
    ).values(),
  ];
  const positionNumbers = [
    ...new Set(sortedPeriods.map((period) => period.position)),
  ].sort((a, b) => a - b);
  const positions = positionNumbers.map((position) => {
    const matching = sortedPeriods.filter((period) => period.position === position);
    const times = [
      ...new Set(
        matching.map(
          (period) =>
            `${period.startTime.slice(0, 5)}–${period.endTime.slice(0, 5)}`,
        ),
      ),
    ];
    return {
      position,
      label: matching[0]?.label ?? `زنگ ${position.toLocaleString("fa-IR")}`,
      time: times.length === 1 ? times[0] : "ساعت متغیر",
    };
  });

  const sessions = new Map(
    expandSessions(data.problem).map((session) => [session.id, session]),
  );
  const teachers = new Map(
    data.problem.teachers.map((teacher) => [teacher.id, teacher.name]),
  );
  const periods = new Map(
    data.problem.periods.map((period) => [period.id, period]),
  );
  const issuesBySession = new Map<string, TimetableViewData["issues"]>();
  for (const issue of data.issues) {
    if (issue.entityType !== "session" || !issue.entityId) continue;
    issuesBySession.set(issue.entityId, [
      ...(issuesBySession.get(issue.entityId) ?? []),
      issue,
    ]);
  }

  const assignmentsBySlot = new Map<string, TimetableViewData["assignments"]>();
  for (const assignment of data.assignments) {
    for (const periodId of assignment.periodIds) {
      const period = periods.get(periodId);
      if (!period) continue;
      const key = schoolCellKey(period.dayId, assignment.classId, period.position);
      assignmentsBySlot.set(key, [
        ...(assignmentsBySlot.get(key) ?? []),
        assignment,
      ]);
    }
  }

  const majorGroups = new Map<
    string,
    { majorName: string; classes: TimetableViewData["problem"]["classes"] }
  >();
  for (const schoolClass of data.problem.classes) {
    const majorId = schoolClass.majorId ?? "without-major";
    const current = majorGroups.get(majorId) ?? {
      majorName: schoolClass.majorName ?? "بدون رشته",
      classes: [],
    };
    current.classes.push(schoolClass);
    majorGroups.set(majorId, current);
  }

  return [...majorGroups.entries()]
    .sort(
      ([, a], [, b]) =>
        majorPriority(a.majorName) - majorPriority(b.majorName),
    )
    .map(([majorId, group]) => {
      const cells: Record<string, SchoolTimetableCell> = {};
      for (const day of days) {
        for (const schoolClass of group.classes) {
          for (const position of positionNumbers) {
            const key = schoolCellKey(day.id, schoolClass.id, position);
            const period = sortedPeriods.find(
              (item) =>
                item.dayId === day.id && item.position === position,
            );
            if (!period) {
              cells[key] = {
                unavailable: true,
                severity: null,
                lessons: [],
              };
              continue;
            }
            const assignments = assignmentsBySlot.get(key) ?? [];
            const slotIssues = assignments.flatMap(
              (assignment) => issuesBySession.get(assignment.sessionId) ?? [],
            );
            const severity = slotIssues.some((issue) => issue.severity === "ERROR")
              ? "ERROR"
              : slotIssues.some((issue) => issue.severity === "WARNING")
                ? "WARNING"
                : null;
            const variableTime =
              positions.find((item) => item.position === position)?.time ===
              "ساعت متغیر";
            cells[key] = {
              unavailable: false,
              severity,
              lessons: [...assignments]
                .sort((a, b) =>
                  normalizedWeekPattern(a).localeCompare(
                    normalizedWeekPattern(b),
                  ),
                )
                .map((assignment) => {
                  const session = sessions.get(assignment.sessionId);
                  const pattern = normalizedWeekPattern(assignment);
                  return {
                    sessionId: assignment.sessionId,
                    subject: session?.subjectName ?? "درس",
                    teacher:
                      teachers.get(assignment.teacherId) ?? "دبیر تعیین نشده",
                    weekLabel:
                      pattern === "EVERY_WEEK"
                        ? null
                        : weekPatternLabel(pattern),
                    continuation: assignment.startPosition !== position,
                    time: variableTime
                      ? `${period.startTime.slice(0, 5)}–${period.endTime.slice(0, 5)}`
                      : null,
                  };
                }),
            };
          }
        }
      }
      return {
        majorId,
        majorName: group.majorName,
        classes: group.classes.map((schoolClass) => ({
          id: schoolClass.id,
          name: schoolClass.name,
          gradeName: schoolClass.gradeName,
        })),
        positions,
        days,
        cells,
      };
    });
}

export function buildTimetableExport(
  data: TimetableViewData,
  view: ExportView,
  resourceId?: string,
): TimetableExportModel {
  const sessions = new Map(
    expandSessions(data.problem).map((session) => [session.id, session]),
  );
  const teachers = new Map(
    data.problem.teachers.map((teacher) => [teacher.id, teacher.name]),
  );
  const periods = new Map(
    data.problem.periods.map((period) => [period.id, period]),
  );
  const selectedClass = data.problem.classes.find(
    (item) => item.id === resourceId,
  );
  const selectedTeacher = data.problem.teachers.find(
    (item) => item.id === resourceId,
  );
  if (view === "class" && !selectedClass)
    throw new Error("کلاس انتخاب‌شده معتبر نیست.");
  if (view === "teacher" && !selectedTeacher)
    throw new Error("دبیر انتخاب‌شده معتبر نیست.");

  const assignments = data.assignments
    .filter(
      (item) =>
        view === "school" ||
        (view === "class"
          ? item.classId === resourceId
          : item.teacherId === resourceId),
    )
    .sort((a, b) => {
      const periodA = periods.get(a.periodIds[0]);
      const periodB = periods.get(b.periodIds[0]);
      return (
        (periodA?.dayOrder ?? 0) - (periodB?.dayOrder ?? 0) ||
        a.startPosition - b.startPosition ||
        a.classId.localeCompare(b.classId)
      );
    });
  const rows = assignments.map((assignment) => {
    const session = sessions.get(assignment.sessionId);
    const first = periods.get(assignment.periodIds[0]);
    const last = periods.get(assignment.periodIds.at(-1) ?? "");
    return {
      day: first?.dayLabel ?? "—",
      period: `${
        assignment.periodIds.length === 1
          ? (first?.label ?? "—")
          : `${first?.label ?? "—"} تا ${last?.label ?? "—"}`
      }${
        normalizedWeekPattern(assignment) === "EVERY_WEEK"
          ? ""
          : ` · ${weekPatternLabel(normalizedWeekPattern(assignment))}`
      }`,
      time:
        first && last
          ? `${first.startTime.slice(0, 5)} تا ${last.endTime.slice(0, 5)}`
          : "—",
      className: session?.className ?? "—",
      subject: session?.subjectName ?? "—",
      teacher: teachers.get(assignment.teacherId) ?? "—",
    };
  });
  const subject =
    view === "class"
      ? `کلاس ${selectedClass!.name}`
      : view === "teacher"
        ? `دبیر ${selectedTeacher!.name}`
        : "کل مدرسه";
  return {
    title: `برنامه هفتگی ${subject}`,
    subtitle: `${data.academicYearTitle} · ${
      data.version
        ? `نسخه ${data.version.versionNumber.toLocaleString("fa-IR")}`
        : "نسخه کاری"
    }`,
    rows,
    schoolPages: view === "school" ? buildSchoolTimetablePages(data) : undefined,
  };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createExcelWorkbook(model: TimetableExportModel): Uint8Array {
  const headers = ["روز", "زنگ", "ساعت", "کلاس", "درس", "دبیر"];
  const rows = model.rows.map((row) => [
    row.day,
    row.period,
    row.time,
    row.className,
    row.subject,
    row.teacher,
  ]);
  const xmlRows = [headers, ...rows]
    .map(
      (row, rowIndex) =>
        `<Row>${row
          .map(
            (cell) =>
              `<Cell ss:StyleID="${rowIndex === 0 ? "Header" : "Cell"}"><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`,
          )
          .join("")}</Row>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Vazirmatn" ss:Size="11"/></Style><Style ss:ID="Header"><Font ss:FontName="Vazirmatn" ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/></Style><Style ss:ID="Cell"><Alignment ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/></Style></Styles>
<Worksheet ss:Name="برنامه هفتگی"><Table><Row><Cell ss:MergeAcross="5" ss:StyleID="Header"><Data ss:Type="String">${escapeXml(model.title)}</Data></Cell></Row><Row><Cell ss:MergeAcross="5"><Data ss:Type="String">${escapeXml(model.subtitle)}</Data></Cell></Row>${xmlRows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/></WorksheetOptions></Worksheet></Workbook>`;
  return new TextEncoder().encode(`\ufeff${xml}`);
}

type PdfDocument = InstanceType<typeof PDFDocument>;

function collectPdf(document: PdfDocument) {
  const chunks: Uint8Array[] = [];
  document.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  const complete = new Promise<Uint8Array>((resolve, reject) => {
    document.on("end", () => {
      const size = chunks.reduce(
        (total, chunk) => total + chunk.byteLength,
        0,
      );
      const output = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(output);
    });
    document.on("error", reject);
  });
  return complete;
}

function drawRect(
  document: PdfDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = "#CBD5E1",
  lineWidth = 0.5,
) {
  document
    .save()
    .lineWidth(lineWidth)
    .fillColor(fill)
    .strokeColor(stroke)
    .rect(x, y, width, height)
    .fillAndStroke()
    .restore();
}

function drawCenteredText(
  document: PdfDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  color = "#0F172A",
  font = "Vazirmatn",
) {
  const innerWidth = Math.max(4, width - 6);
  document.save().rect(x + 1, y + 1, width - 2, height - 2).clip();
  document.font(font).fontSize(fontSize).fillColor(color);
  const textHeight = document.heightOfString(text, {
    width: innerWidth,
    align: "center",
    lineGap: 0,
  });
  document.text(text, x + 3, y + Math.max(2, (height - textHeight) / 2), {
    width: innerWidth,
    align: "center",
    lineGap: 0,
  });
  document.restore();
}

function drawLesson(
  document: PdfDocument,
  lesson: SchoolTimetableLesson,
  x: number,
  y: number,
  width: number,
  height: number,
  baseFontSize: number,
) {
  const lines = [
    lesson.weekLabel,
    lesson.subject,
    lesson.teacher,
    lesson.time,
    lesson.continuation ? "ادامه جلسه" : null,
  ].filter((value): value is string => Boolean(value));
  const weights = lines.map((line) =>
    line === lesson.subject ? 1.15 : line === lesson.teacher ? 1 : 0.82,
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let currentY = y + 2;
  const availableHeight = Math.max(4, height - 4);
  for (let index = 0; index < lines.length; index += 1) {
    const lineHeight = (availableHeight * weights[index]) / totalWeight;
    const line = lines[index];
    const isSubject = line === lesson.subject;
    const isWeek = line === lesson.weekLabel;
    drawCenteredText(
      document,
      line,
      x + 1,
      currentY,
      width - 2,
      lineHeight,
      isSubject ? baseFontSize : Math.max(4.6, baseFontSize - 1.1),
      isWeek ? "#0F766E" : isSubject ? "#0F172A" : "#475569",
      isSubject ? "VazirmatnBold" : "Vazirmatn",
    );
    currentY += lineHeight;
  }
}

function drawSchoolPage(
  document: PdfDocument,
  model: TimetableExportModel,
  page: SchoolTimetablePage,
  pageNumber: number,
  pageCount: number,
) {
  const margin = 18;
  const width = document.page.width - margin * 2;
  const titleHeight = 38;
  const classHeaderHeight = 28;
  const periodHeaderHeight = 34;
  const footerHeight = 13;
  const tableTop = margin + titleHeight;
  const dayWidth = 48;
  const columnCount = Math.max(1, page.classes.length * page.positions.length);
  const cellWidth = (width - dayWidth) / columnCount;
  const bodyHeight =
    document.page.height -
    margin * 2 -
    titleHeight -
    classHeaderHeight -
    periodHeaderHeight -
    footerHeight;
  const rowHeight = bodyHeight / Math.max(1, page.days.length);
  const tableRight = document.page.width - margin;
  const dayX = tableRight - dayWidth;
  const baseFontSize = Math.max(5.1, Math.min(7.2, cellWidth / 6.6));

  document
    .font("VazirmatnBold")
    .fontSize(13)
    .fillColor("#0F172A")
    .text(`برنامه هفتگی کل مدرسه — رشته ${page.majorName}`, margin, margin, {
      width,
      align: "center",
    });
  document
    .font("Vazirmatn")
    .fontSize(7.5)
    .fillColor("#475569")
    .text(model.subtitle, margin, margin + 19, { width, align: "center" });

  drawRect(
    document,
    dayX,
    tableTop,
    dayWidth,
    classHeaderHeight + periodHeaderHeight,
    "#FFFFFF",
    "#94A3B8",
    0.7,
  );
  drawCenteredText(
    document,
    "ایام هفته",
    dayX,
    tableTop,
    dayWidth,
    classHeaderHeight + periodHeaderHeight,
    7.2,
    "#0F172A",
    "VazirmatnBold",
  );

  for (let classIndex = 0; classIndex < page.classes.length; classIndex += 1) {
    const schoolClass = page.classes[classIndex];
    const classWidth = page.positions.length * cellWidth;
    const classX = dayX - (classIndex + 1) * classWidth;
    drawRect(
      document,
      classX,
      tableTop,
      classWidth,
      classHeaderHeight,
      "#E8F5F2",
      "#94A3B8",
      0.7,
    );
    drawCenteredText(
      document,
      `${schoolClass.name}\n${schoolClass.gradeName}`,
      classX,
      tableTop,
      classWidth,
      classHeaderHeight,
      Math.max(6.4, baseFontSize),
      "#155E55",
      "VazirmatnBold",
    );
    for (let positionIndex = 0; positionIndex < page.positions.length; positionIndex += 1) {
      const position = page.positions[positionIndex];
      const columnIndex = classIndex * page.positions.length + positionIndex;
      const x = dayX - (columnIndex + 1) * cellWidth;
      drawRect(
        document,
        x,
        tableTop + classHeaderHeight,
        cellWidth,
        periodHeaderHeight,
        "#F8FAFC",
        positionIndex === 0 ? "#64748B" : "#CBD5E1",
        positionIndex === 0 ? 0.9 : 0.45,
      );
      drawCenteredText(
        document,
        `${position.label}\n${position.time}`,
        x,
        tableTop + classHeaderHeight,
        cellWidth,
        periodHeaderHeight,
        Math.max(5.1, baseFontSize - 0.4),
        "#334155",
        "VazirmatnBold",
      );
    }
  }

  const bodyTop = tableTop + classHeaderHeight + periodHeaderHeight;
  for (let dayIndex = 0; dayIndex < page.days.length; dayIndex += 1) {
    const day = page.days[dayIndex];
    const y = bodyTop + dayIndex * rowHeight;
    drawRect(document, dayX, y, dayWidth, rowHeight, "#FFFFFF", "#94A3B8", 0.7);
    drawCenteredText(
      document,
      day.label,
      dayX,
      y,
      dayWidth,
      rowHeight,
      7.4,
      "#0F172A",
      "VazirmatnBold",
    );

    for (let classIndex = 0; classIndex < page.classes.length; classIndex += 1) {
      const schoolClass = page.classes[classIndex];
      for (let positionIndex = 0; positionIndex < page.positions.length; positionIndex += 1) {
        const position = page.positions[positionIndex];
        const columnIndex = classIndex * page.positions.length + positionIndex;
        const x = dayX - (columnIndex + 1) * cellWidth;
        const cell = page.cells[schoolCellKey(day.id, schoolClass.id, position.position)];
        const fill = cell?.unavailable
          ? "#F1F5F9"
          : cell?.severity === "ERROR"
            ? "#FEF2F2"
            : cell?.severity === "WARNING"
              ? "#FFFBEB"
              : cell?.lessons.length
                ? "#EFF8F6"
                : "#F8FAFC";
        const stroke =
          positionIndex === 0
            ? "#64748B"
            : cell?.severity === "ERROR"
              ? "#DC2626"
              : cell?.severity === "WARNING"
                ? "#D97706"
                : "#CBD5E1";
        drawRect(
          document,
          x,
          y,
          cellWidth,
          rowHeight,
          fill,
          stroke,
          positionIndex === 0 ? 0.9 : 0.45,
        );
        if (cell?.unavailable) {
          drawCenteredText(document, "—", x, y, cellWidth, rowHeight, 8, "#94A3B8");
        } else if (!cell?.lessons.length) {
          drawCenteredText(document, "****", x, y, cellWidth, rowHeight, 7, "#94A3B8");
        } else {
          const lessonHeight = rowHeight / cell.lessons.length;
          cell.lessons.forEach((lesson, lessonIndex) => {
            if (lessonIndex > 0) {
              const separatorY = y + lessonIndex * lessonHeight;
              document
                .save()
                .dash(2, { space: 1.5 })
                .strokeColor("#94A3B8")
                .lineWidth(0.45)
                .moveTo(x + 2, separatorY)
                .lineTo(x + cellWidth - 2, separatorY)
                .stroke()
                .undash()
                .restore();
            }
            drawLesson(
              document,
              lesson,
              x,
              y + lessonIndex * lessonHeight,
              cellWidth,
              lessonHeight,
              baseFontSize,
            );
          });
        }
      }
    }
  }

  document
    .font("Vazirmatn")
    .fontSize(6.5)
    .fillColor("#64748B")
    .text(
      `صفحه ${pageNumber.toLocaleString("fa-IR")} از ${pageCount.toLocaleString("fa-IR")}`,
      margin,
      document.page.height - margin - footerHeight,
      { width, height: footerHeight, align: "center", lineBreak: false },
    );
}

function drawListPdf(document: PdfDocument, model: TimetableExportModel) {
  document.addPage({ size: "A4", margin: 42 });
  document
    .font("VazirmatnBold")
    .fontSize(18)
    .text(model.title, { align: "right" });
  document
    .moveDown(0.25)
    .font("Vazirmatn")
    .fontSize(10)
    .fillColor("#475569")
    .text(model.subtitle, { align: "right" });
  document.moveDown(0.7).fillColor("#0F172A");
  if (!model.rows.length)
    document
      .fontSize(11)
      .text("جلسه‌ای برای این نما ثبت نشده است.", { align: "right" });
  for (const row of model.rows) {
    if (document.y > 760) document.addPage({ size: "A4", margin: 42 });
    document
      .font("Vazirmatn")
      .fontSize(10)
      .fillColor("#0F172A")
      .text(`${row.day} · ${row.period} · ${row.time}`, { align: "right" });
    document
      .fontSize(11)
      .text(`${row.subject} — ${row.className} — ${row.teacher}`, {
        align: "right",
      });
    document
      .moveDown(0.35)
      .strokeColor("#CBD5E1")
      .moveTo(42, document.y)
      .lineTo(553, document.y)
      .stroke()
      .moveDown(0.4);
  }
}

export async function createPersianPdf(
  model: TimetableExportModel,
): Promise<Uint8Array> {
  const isSchoolGrid = Boolean(model.schoolPages?.length);
  const document = new PDFDocument({
    autoFirstPage: false,
    size: "A4",
    layout: isSchoolGrid ? "landscape" : "portrait",
    margin: isSchoolGrid ? 18 : 42,
    info: { Title: model.title, Author: "مدرسه‌یار" },
  });
  const complete = collectPdf(document);
  const fontDirectory = path.join(
    process.cwd(),
    "node_modules",
    "vazirmatn",
    "misc",
    "UI",
    "fonts",
    "ttf",
  );
  document.registerFont(
    "Vazirmatn",
    readFileSync(path.join(fontDirectory, "Vazirmatn-UI-Regular.ttf")),
  );
  document.registerFont(
    "VazirmatnBold",
    readFileSync(path.join(fontDirectory, "Vazirmatn-UI-Bold.ttf")),
  );

  if (isSchoolGrid) {
    const pages = model.schoolPages!;
    pages.forEach((page, index) => {
      document.addPage({ size: "A4", layout: "landscape", margin: 18 });
      drawSchoolPage(document, model, page, index + 1, pages.length);
    });
  } else {
    drawListPdf(document, model);
  }
  document.end();
  return complete;
}
