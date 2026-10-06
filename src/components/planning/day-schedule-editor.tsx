"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import type { SchoolDayView } from "@/modules/academic-structure/repository";
import {
  calculateAutomaticTimeline,
  intervalDuration,
  normalizeClockTime,
  validateSchoolDayTimeline,
  type IntermissionKind,
  type SchoolDayTimeline,
  type TimelineIntermission,
  type TimelinePeriod,
} from "@/modules/academic-structure/school-day-timeline";
import { saveSchoolDayScheduleAction, setSchoolDayStatusAction } from "@/modules/academic-structure/actions";
import { Badge } from "@/components/ui/badge";
import { ManagedForm } from "./managed-form";

type BoundaryRule = { durationMinutes: number; kind: IntermissionKind };

function initialTimeline(day: SchoolDayView): SchoolDayTimeline {
  if (day.schedule) return {
    ...day.schedule,
    startTime: normalizeClockTime(day.schedule.startTime),
    endTime: normalizeClockTime(day.schedule.endTime),
    periods: day.schedule.periods.map((period) => ({ ...period, startTime: normalizeClockTime(period.startTime), endTime: normalizeClockTime(period.endTime) })),
    intermissions: day.schedule.intermissions.map((item) => ({ ...item, startTime: normalizeClockTime(item.startTime), endTime: normalizeClockTime(item.endTime) })),
  };
  const periods = day.periods.filter((period) => period.isActive).sort((a, b) => a.position - b.position);
  if (periods.length) {
    return {
      mode: "MANUAL",
      startTime: normalizeClockTime(periods[0].startTime),
      endTime: normalizeClockTime(periods.at(-1)!.endTime),
      periodCount: periods.length,
      defaultBreakMinutes: 10,
      periods: periods.map(({ position, label, startTime, endTime, instructionalUnits }) => ({ position, label, startTime: normalizeClockTime(startTime), endTime: normalizeClockTime(endTime), instructionalUnits })),
      intermissions: periods.slice(0, -1).flatMap((period, index) => {
        const next = periods[index + 1];
        if (normalizeClockTime(period.endTime) === normalizeClockTime(next.startTime)) return [];
        return [{ afterPeriodPosition: period.position, kind: period.breakAfterMinutes ? "BREAK" as const : "TRANSITION" as const, startTime: normalizeClockTime(period.endTime), endTime: normalizeClockTime(next.startTime) }];
      }),
    };
  }
  return calculateAutomaticTimeline({ startTime: "08:00", endTime: "13:20", periodCount: 4, defaultBreakMinutes: 10 });
}

function boundaryRulesFrom(timeline: SchoolDayTimeline): Record<number, BoundaryRule> {
  return Object.fromEntries(Array.from({ length: timeline.periodCount - 1 }, (_, index) => {
    const position = index + 1;
    const item = timeline.intermissions.find((intermission) => intermission.afterPeriodPosition === position);
    return [position, { durationMinutes: item ? intervalDuration(item.startTime, item.endTime) : 0, kind: item?.kind ?? "BREAK" }];
  }));
}

function intermissionLabel(item: TimelineIntermission | undefined): string {
  if (!item) return "بدون فاصله";
  const duration = intervalDuration(item.startTime, item.endTime).toLocaleString("fa-IR");
  return item.kind === "BREAK" ? `زنگ تفریح · ${duration} دقیقه` : `جابه‌جایی · ${duration} دقیقه`;
}

function ClockInput(props: Omit<ComponentProps<typeof Input>, "type" | "inputMode" | "dir">) {
  return <Input {...props} type="text" inputMode="numeric" dir="ltr" maxLength={5} pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" placeholder="08:00" />;
}

export function DayScheduleEditor({ day, academicYearId }: { day: SchoolDayView; academicYearId: string }) {
  const initial = useMemo(() => initialTimeline(day), [day]);
  const [mode, setMode] = useState(initial.mode);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [periodCount, setPeriodCount] = useState(initial.periodCount);
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState(initial.defaultBreakMinutes);
  const [instructionalUnits, setInstructionalUnits] = useState<Record<number, number>>(() => Object.fromEntries(initial.periods.map((period) => [period.position, period.instructionalUnits])));
  const [boundaryRules, setBoundaryRules] = useState<Record<number, BoundaryRule>>(() => boundaryRulesFrom(initial));
  const [manualPeriods, setManualPeriods] = useState<TimelinePeriod[]>(initial.periods);
  const [manualIntermissions, setManualIntermissions] = useState<TimelineIntermission[]>(initial.intermissions);

  const automatic = useMemo(() => {
    try {
      return {
        timeline: calculateAutomaticTimeline({
          startTime,
          endTime,
          periodCount,
          defaultBreakMinutes,
          instructionalUnits: Array.from({ length: periodCount }, (_, index) => instructionalUnits[index + 1]),
          intermissions: Array.from({ length: Math.max(0, periodCount - 1) }, (_, index) => {
            const position = index + 1;
            const rule = boundaryRules[position] ?? { durationMinutes: defaultBreakMinutes, kind: "BREAK" as const };
            return { afterPeriodPosition: position, durationMinutes: rule.durationMinutes, kind: rule.kind };
          }),
        }),
        error: "",
      };
    } catch (error) {
      return { timeline: null, error: error instanceof Error ? error.message : "محاسبه برنامه زنگ‌ها ممکن نیست." };
    }
  }, [boundaryRules, defaultBreakMinutes, endTime, instructionalUnits, periodCount, startTime]);

  const manualTimeline: SchoolDayTimeline = { mode: "MANUAL", startTime, endTime, periodCount, defaultBreakMinutes, periods: manualPeriods, intermissions: manualIntermissions };
  const effectiveTimeline = mode === "AUTO" ? automatic.timeline : manualTimeline;
  const validationErrors = effectiveTimeline ? validateSchoolDayTimeline(effectiveTimeline) : [automatic.error];

  function changeMode(nextMode: "AUTO" | "MANUAL") {
    if (nextMode === "MANUAL" && automatic.timeline) {
      setManualPeriods(automatic.timeline.periods);
      setManualIntermissions(automatic.timeline.intermissions);
    }
    setMode(nextMode);
  }

  function updateBoundary(position: number, next: Partial<BoundaryRule>) {
    setBoundaryRules((current) => ({ ...current, [position]: { ...(current[position] ?? { durationMinutes: defaultBreakMinutes, kind: "BREAK" }), ...next } }));
  }

  function updatePeriodCount(nextCount: number) {
    const safeCount = Math.min(20, Math.max(1, nextCount || 1));
    setPeriodCount(safeCount);
    if (mode !== "MANUAL") return;
    try {
      const recalculated = calculateAutomaticTimeline({
        startTime,
        endTime,
        periodCount: safeCount,
        defaultBreakMinutes,
        instructionalUnits: Array.from({ length: safeCount }, (_, index) => instructionalUnits[index + 1]),
        intermissions: Array.from({ length: Math.max(0, safeCount - 1) }, (_, index) => {
          const position = index + 1;
          const rule = boundaryRules[position] ?? { durationMinutes: defaultBreakMinutes, kind: "BREAK" as const };
          return { afterPeriodPosition: position, durationMinutes: rule.durationMinutes, kind: rule.kind };
        }),
      });
      setManualPeriods(recalculated.periods);
      setInstructionalUnits(Object.fromEntries(recalculated.periods.map((period) => [period.position, period.instructionalUnits])));
      setManualIntermissions(recalculated.intermissions);
    } catch {
      // The inline timeline validation explains invalid bounds without discarding manual values.
    }
  }

  function updateManualPeriod(position: number, next: Partial<TimelinePeriod>) {
    setManualPeriods((current) => current.map((period) => period.position === position ? { ...period, ...next } : period));
  }

  function updateManualIntermission(position: number, value: "NONE" | IntermissionKind) {
    setManualIntermissions((current) => {
      const withoutCurrent = current.filter((item) => item.afterPeriodPosition !== position);
      if (value === "NONE") return withoutCurrent;
      const currentPeriod = manualPeriods.find((period) => period.position === position);
      const nextPeriod = manualPeriods.find((period) => period.position === position + 1);
      if (!currentPeriod || !nextPeriod) return withoutCurrent;
      return [...withoutCurrent, { afterPeriodPosition: position, kind: value, startTime: currentPeriod.endTime, endTime: nextPeriod.startTime }].sort((a, b) => a.afterPeriodPosition - b.afterPeriodPosition);
    });
  }

  function updateManualIntermissionTime(position: number, field: "startTime" | "endTime", value: string) {
    setManualIntermissions((current) => current.map((item) => item.afterPeriodPosition === position ? { ...item, [field]: value } : item));
  }

  const shownPeriods = mode === "AUTO" ? automatic.timeline?.periods ?? [] : manualPeriods;
  const shownIntermissions = mode === "AUTO" ? automatic.timeline?.intermissions ?? [] : manualIntermissions;

  return (
    <details className="day-schedule-card" open={day.sortOrder === 0}>
      <summary>
        <span><CalendarClock size={18} /><strong>{day.label}</strong></span>
        <span className="day-schedule-summary"><bdi>{effectiveTimeline ? `${normalizeClockTime(effectiveTimeline.startTime)}–${normalizeClockTime(effectiveTimeline.endTime)}` : "نیازمند اصلاح"}</bdi><Badge variant={day.isActive ? undefined : "warning"}>{day.periods.filter((item) => item.isActive).length.toLocaleString("fa-IR")} زنگ</Badge><ChevronDown size={17} /></span>
      </summary>
      <div className="day-schedule-editor">
        <div className="day-schedule-toolbar">
          <label className="compact-field"><span>شروع مدرسه</span><ClockInput value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label={`شروع مدرسه ${day.label}`} /></label>
          <label className="compact-field"><span>پایان مدرسه</span><ClockInput value={endTime} onChange={(event) => setEndTime(event.target.value)} aria-label={`پایان مدرسه ${day.label}`} /></label>
          <label className="compact-field"><span>تعداد زنگ</span><Input type="number" min="1" max="20" value={periodCount} onChange={(event) => updatePeriodCount(Number(event.target.value))} aria-label={`تعداد زنگ ${day.label}`} /></label>
          <label className="compact-field"><span>استراحت پیش‌فرض</span><Input type="number" min="0" max="180" value={defaultBreakMinutes} onChange={(event) => setDefaultBreakMinutes(Number(event.target.value))} aria-label={`استراحت پیش‌فرض ${day.label}`} /></label>
          <fieldset className="schedule-mode"><legend>نوع تنظیم</legend><label><input type="radio" checked={mode === "AUTO"} onChange={() => changeMode("AUTO")} /> محاسبه خودکار</label><label><input type="radio" checked={mode === "MANUAL"} onChange={() => changeMode("MANUAL")} /> ورود دستی</label></fieldset>
        </div>

        <div className="period-timeline" aria-label={`برنامه زنگ‌های ${day.label}`}>
          <div className="period-timeline__head"><span>زنگ</span><span>شروع</span><span>پایان</span><span>مدت</span><span>واحد آموزشی</span></div>
          {shownPeriods.map((period) => {
            const pause = shownIntermissions.find((item) => item.afterPeriodPosition === period.position);
            const rule = boundaryRules[period.position] ?? { durationMinutes: defaultBreakMinutes, kind: "BREAK" as const };
            return <div className="period-timeline__group" key={period.position}>
              <div className="period-timeline__period">
                {mode === "MANUAL" ? <Input value={period.label} onChange={(event) => updateManualPeriod(period.position, { label: event.target.value })} aria-label={`عنوان زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`} /> : <strong>{period.label}</strong>}
                {mode === "MANUAL" ? <ClockInput value={normalizeClockTime(period.startTime)} onChange={(event) => updateManualPeriod(period.position, { startTime: event.target.value })} aria-label={`شروع زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`} /> : <bdi>{normalizeClockTime(period.startTime)}</bdi>}
                {mode === "MANUAL" ? <ClockInput value={normalizeClockTime(period.endTime)} onChange={(event) => updateManualPeriod(period.position, { endTime: event.target.value })} aria-label={`پایان زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`} /> : <bdi>{normalizeClockTime(period.endTime)}</bdi>}
                <span>{intervalDuration(period.startTime, period.endTime).toLocaleString("fa-IR")} دقیقه</span>
                <Select
                  value={period.instructionalUnits}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setInstructionalUnits((current) => ({ ...current, [period.position]: value }));
                    if (mode === "MANUAL") updateManualPeriod(period.position, { instructionalUnits: value });
                  }}
                  aria-label={`واحد آموزشی زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`}
                >
                  {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value.toLocaleString("fa-IR")} ساعت</option>)}
                </Select>
              </div>
              {period.position < periodCount ? <div className="period-timeline__break">
                {mode === "AUTO" ? <><Select value={rule.durationMinutes ? rule.kind : "NONE"} onChange={(event) => updateBoundary(period.position, event.target.value === "NONE" ? { durationMinutes: 0 } : { kind: event.target.value as IntermissionKind, durationMinutes: rule.durationMinutes || (event.target.value === "BREAK" ? defaultBreakMinutes : 5) })} aria-label={`نوع فاصله پس از زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`}><option value="NONE">بدون فاصله</option><option value="BREAK">زنگ تفریح</option><option value="TRANSITION">جابه‌جایی کلاس</option></Select>{rule.durationMinutes ? <Input type="number" min="1" max="180" value={rule.durationMinutes} onChange={(event) => updateBoundary(period.position, { durationMinutes: Number(event.target.value) })} aria-label={`مدت فاصله پس از زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`} /> : null}<span>{intermissionLabel(pause)}</span></> : (() => {
                  const manualPause = manualIntermissions.find((item) => item.afterPeriodPosition === period.position);
                  return <><Select value={manualPause?.kind ?? "NONE"} onChange={(event) => updateManualIntermission(period.position, event.target.value as "NONE" | IntermissionKind)} aria-label={`نوع فاصله پس از زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`}><option value="NONE">بدون فاصله</option><option value="BREAK">زنگ تفریح</option><option value="TRANSITION">جابه‌جایی کلاس</option></Select>{manualPause ? <><ClockInput value={normalizeClockTime(manualPause.startTime)} onChange={(event) => updateManualIntermissionTime(period.position, "startTime", event.target.value)} aria-label={`شروع فاصله پس از زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`} /><ClockInput value={normalizeClockTime(manualPause.endTime)} onChange={(event) => updateManualIntermissionTime(period.position, "endTime", event.target.value)} aria-label={`پایان فاصله پس از زنگ ${period.position.toLocaleString("fa-IR")} ${day.label}`} /><span>{intermissionLabel(manualPause)}</span></> : <span>زنگ بعدی باید بلافاصله شروع شود.</span>}</>;
                })()}
              </div> : null}
            </div>;
          })}
        </div>

        {validationErrors.length ? <div className="timeline-errors" role="alert"><strong>خط زمانی نیازمند اصلاح است.</strong><ul>{validationErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul></div> : <div className="timeline-valid" role="status">شروع، زنگ‌ها و فاصله‌ها دقیقاً تا پایان مدرسه ادامه دارند.</div>}
        <div className="day-schedule-actions">
          <ManagedForm action={saveSchoolDayScheduleAction} submitLabel="ذخیره برنامه این روز" compact>
            <input type="hidden" name="academicYearId" value={academicYearId} />
            <input type="hidden" name="schoolDayId" value={day.id} />
            <input type="hidden" name="timeline" value={effectiveTimeline ? JSON.stringify({ ...effectiveTimeline, mode }) : ""} />
          </ManagedForm>
          <ManagedForm compact action={setSchoolDayStatusAction} submitLabel={day.isActive ? "غیرفعال‌کردن روز" : "فعال‌کردن روز"}><input type="hidden" name="id" value={day.id} /><input type="hidden" name="isActive" value={day.isActive ? "false" : "true"} /></ManagedForm>
        </div>
      </div>
    </details>
  );
}
