export type DayScheduleMode = "AUTO" | "MANUAL";
export type IntermissionKind = "BREAK" | "TRANSITION";

export interface TimelinePeriod {
  position: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface TimelineIntermission {
  afterPeriodPosition: number;
  kind: IntermissionKind;
  startTime: string;
  endTime: string;
}

export interface SchoolDayTimeline {
  mode: DayScheduleMode;
  startTime: string;
  endTime: string;
  periodCount: number;
  defaultBreakMinutes: number;
  periods: TimelinePeriod[];
  intermissions: TimelineIntermission[];
}

export interface AutomaticTimelineInput {
  startTime: string;
  endTime: string;
  periodCount: number;
  defaultBreakMinutes: number;
  intermissions?: { afterPeriodPosition: number; durationMinutes: number; kind?: IntermissionKind }[];
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeClockTime(value: string): string {
  return value.slice(0, 5);
}

export function clockToMinutes(value: string): number {
  const normalized = normalizeClockTime(value);
  if (!timePattern.test(normalized)) return Number.NaN;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToClock(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 24 * 60) throw new Error("زمان محاسبه‌شده خارج از محدوده یک روز است.");
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

export function intervalDuration(startTime: string, endTime: string): number {
  return clockToMinutes(endTime) - clockToMinutes(startTime);
}

export function calculateAutomaticTimeline(input: AutomaticTimelineInput): SchoolDayTimeline {
  const start = clockToMinutes(input.startTime);
  const end = clockToMinutes(input.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("بازه شروع و پایان مدرسه معتبر نیست.");
  if (!Number.isInteger(input.periodCount) || input.periodCount < 1 || input.periodCount > 20) throw new Error("تعداد زنگ باید بین ۱ تا ۲۰ باشد.");
  if (!Number.isInteger(input.defaultBreakMinutes) || input.defaultBreakMinutes < 0 || input.defaultBreakMinutes > 180) throw new Error("مدت استراحت پیش‌فرض معتبر نیست.");

  const requested = input.intermissions ?? Array.from({ length: input.periodCount - 1 }, (_, index) => ({ afterPeriodPosition: index + 1, durationMinutes: input.defaultBreakMinutes, kind: "BREAK" as const }));
  const seen = new Set<number>();
  const boundaryDurations = new Map<number, { durationMinutes: number; kind: IntermissionKind }>();
  for (const item of requested) {
    if (!Number.isInteger(item.afterPeriodPosition) || item.afterPeriodPosition < 1 || item.afterPeriodPosition >= input.periodCount || seen.has(item.afterPeriodPosition)) throw new Error("جایگاه استراحت‌ها معتبر نیست.");
    if (!Number.isInteger(item.durationMinutes) || item.durationMinutes < 0 || item.durationMinutes > 180) throw new Error("مدت استراحت معتبر نیست.");
    seen.add(item.afterPeriodPosition);
    boundaryDurations.set(item.afterPeriodPosition, { durationMinutes: item.durationMinutes, kind: item.kind ?? "BREAK" });
  }

  const totalBreakMinutes = [...boundaryDurations.values()].reduce((total, item) => total + item.durationMinutes, 0);
  const teachingMinutes = end - start - totalBreakMinutes;
  if (teachingMinutes < input.periodCount) throw new Error("بازه مدرسه برای تعداد زنگ‌ها و استراحت‌های انتخاب‌شده کافی نیست.");

  const baseDuration = Math.floor(teachingMinutes / input.periodCount);
  const extraMinutes = teachingMinutes % input.periodCount;
  const periods: TimelinePeriod[] = [];
  const intermissions: TimelineIntermission[] = [];
  let cursor = start;

  for (let index = 0; index < input.periodCount; index += 1) {
    const position = index + 1;
    const duration = baseDuration + (index < extraMinutes ? 1 : 0);
    const periodEnd = cursor + duration;
    periods.push({ position, label: `زنگ ${position.toLocaleString("fa-IR")}`, startTime: minutesToClock(cursor), endTime: minutesToClock(periodEnd) });
    cursor = periodEnd;
    const boundary = boundaryDurations.get(position);
    if (position < input.periodCount && boundary?.durationMinutes) {
      const breakEnd = cursor + boundary.durationMinutes;
      intermissions.push({ afterPeriodPosition: position, kind: boundary.kind, startTime: minutesToClock(cursor), endTime: minutesToClock(breakEnd) });
      cursor = breakEnd;
    }
  }

  const timeline: SchoolDayTimeline = {
    mode: "AUTO",
    startTime: normalizeClockTime(input.startTime),
    endTime: normalizeClockTime(input.endTime),
    periodCount: input.periodCount,
    defaultBreakMinutes: input.defaultBreakMinutes,
    periods,
    intermissions,
  };
  const errors = validateSchoolDayTimeline(timeline);
  if (errors.length) throw new Error(errors[0]);
  return timeline;
}

export function validateSchoolDayTimeline(timeline: SchoolDayTimeline): string[] {
  const errors: string[] = [];
  const schoolStart = clockToMinutes(timeline.startTime);
  const schoolEnd = clockToMinutes(timeline.endTime);
  if (!Number.isFinite(schoolStart) || !Number.isFinite(schoolEnd) || schoolEnd <= schoolStart) errors.push("ساعت پایان مدرسه باید بعد از ساعت شروع باشد.");
  if (!Number.isInteger(timeline.periodCount) || timeline.periodCount < 1 || timeline.periodCount > 20) errors.push("تعداد زنگ باید بین ۱ تا ۲۰ باشد.");
  if (!Number.isInteger(timeline.defaultBreakMinutes) || timeline.defaultBreakMinutes < 0 || timeline.defaultBreakMinutes > 180) errors.push("مدت استراحت پیش‌فرض معتبر نیست.");
  if (timeline.periods.length !== timeline.periodCount) errors.push("تعداد زنگ‌های جدول با تنظیم روز یکسان نیست.");

  const periods = [...timeline.periods].sort((a, b) => a.position - b.position);
  const positions = new Set(periods.map((period) => period.position));
  if (positions.size !== periods.length || periods.some((period, index) => period.position !== index + 1)) errors.push("شماره زنگ‌ها باید یکتا و از یک به‌ترتیب باشند.");
  for (const period of periods) {
    const start = clockToMinutes(period.startTime);
    const end = clockToMinutes(period.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push(`${period.label || `زنگ ${period.position}`} مدت معتبر ندارد.`);
    else if (start < schoolStart || end > schoolEnd) errors.push(`${period.label || `زنگ ${period.position}`} خارج از ساعات مدرسه است.`);
  }

  const breaks = new Map<number, TimelineIntermission>();
  for (const item of timeline.intermissions) {
    if (!Number.isInteger(item.afterPeriodPosition) || item.afterPeriodPosition < 1 || item.afterPeriodPosition >= timeline.periodCount || breaks.has(item.afterPeriodPosition)) {
      errors.push("جایگاه استراحت‌ها باید یکتا و بین دو زنگ باشد.");
      continue;
    }
    const start = clockToMinutes(item.startTime);
    const end = clockToMinutes(item.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push(`فاصله پس از زنگ ${item.afterPeriodPosition.toLocaleString("fa-IR")} معتبر نیست.`);
    else if (start < schoolStart || end > schoolEnd) errors.push(`فاصله پس از زنگ ${item.afterPeriodPosition.toLocaleString("fa-IR")} خارج از ساعات مدرسه است.`);
    breaks.set(item.afterPeriodPosition, item);
  }

  if (periods[0] && clockToMinutes(periods[0].startTime) !== schoolStart) errors.push("زنگ اول باید دقیقاً با شروع مدرسه آغاز شود.");
  if (periods.at(-1) && clockToMinutes(periods.at(-1)!.endTime) !== schoolEnd) errors.push("زنگ آخر باید دقیقاً در پایان مدرسه تمام شود.");
  for (let index = 0; index < periods.length - 1; index += 1) {
    const current = periods[index];
    const next = periods[index + 1];
    const currentEnd = clockToMinutes(current.endTime);
    const nextStart = clockToMinutes(next.startTime);
    const intermission = breaks.get(current.position);
    if (intermission) {
      if (clockToMinutes(intermission.startTime) !== currentEnd || clockToMinutes(intermission.endTime) !== nextStart) errors.push(`فاصله پس از زنگ ${current.position.toLocaleString("fa-IR")} باید دقیقاً بین دو زنگ قرار گیرد.`);
    } else if (currentEnd !== nextStart) {
      errors.push(`بین زنگ ${current.position.toLocaleString("fa-IR")} و ${(current.position + 1).toLocaleString("fa-IR")} فاصله تعریف‌نشده یا هم‌پوشانی وجود دارد.`);
    }
  }

  return [...new Set(errors)];
}
