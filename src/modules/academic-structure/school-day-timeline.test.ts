import { describe, expect, it } from "vitest";
import { calculateAutomaticTimeline, intervalDuration, suggestedInstructionalUnits, validateSchoolDayTimeline, type SchoolDayTimeline } from "./school-day-timeline";

function manualExample(): SchoolDayTimeline {
  return {
    mode: "MANUAL",
    startTime: "08:00",
    endTime: "13:20",
    periodCount: 4,
    defaultBreakMinutes: 10,
    periods: [
      { position: 1, label: "زنگ ۱", startTime: "08:00", endTime: "09:15", instructionalUnits: 2 },
      { position: 2, label: "زنگ ۲", startTime: "09:25", endTime: "10:45", instructionalUnits: 2 },
      { position: 3, label: "زنگ ۳", startTime: "11:00", endTime: "12:25", instructionalUnits: 2 },
      { position: 4, label: "زنگ ۴", startTime: "12:30", endTime: "13:20", instructionalUnits: 1 },
    ],
    intermissions: [
      { afterPeriodPosition: 1, kind: "BREAK", startTime: "09:15", endTime: "09:25" },
      { afterPeriodPosition: 2, kind: "BREAK", startTime: "10:45", endTime: "11:00" },
      { afterPeriodPosition: 3, kind: "TRANSITION", startTime: "12:25", endTime: "12:30" },
    ],
  };
}

describe("خط زمانی روز مدرسه", () => {
  it("برنامه خودکار را دقیقاً بین ساعت شروع و پایان تقسیم می‌کند", () => {
    const timeline = calculateAutomaticTimeline({ startTime: "08:00", endTime: "13:20", periodCount: 4, defaultBreakMinutes: 10 });
    expect(timeline.periods[0].startTime).toBe("08:00");
    expect(timeline.periods.at(-1)?.endTime).toBe("13:20");
    expect(timeline.intermissions.map((item) => intervalDuration(item.startTime, item.endTime))).toEqual([10, 10, 10]);
    expect(new Set(timeline.periods.map((period) => intervalDuration(period.startTime, period.endTime))).size).toBeGreaterThan(1);
    expect(validateSchoolDayTimeline(timeline)).toEqual([]);
  });

  it("واحد آموزشی هر زنگ را مستقل از ساعت واقعی و قابل تنظیم نگه می‌دارد", () => {
    const timeline = calculateAutomaticTimeline({ startTime: "08:00", endTime: "13:20", periodCount: 4, defaultBreakMinutes: 10, instructionalUnits: [2, 2, 2, 1] });
    expect(timeline.periods.map((period) => period.instructionalUnits)).toEqual([2, 2, 2, 1]);
    expect(validateSchoolDayTimeline(timeline)).toEqual([]);
  });

  it("قاعده دبیرستان را برای ۴۵ تا ۹۰ دقیقه به واحد آموزشی درست تبدیل می‌کند", () => {
    expect([45, 50].map(suggestedInstructionalUnits)).toEqual([1, 1]);
    expect([75, 80, 85, 90].map(suggestedInstructionalUnits)).toEqual([2, 2, 2, 2]);
  });

  it("استراحت‌های متغیر، جابه‌جایی و نبود فاصله را در محاسبه خودکار می‌پذیرد", () => {
    const timeline = calculateAutomaticTimeline({
      startTime: "07:45",
      endTime: "13:15",
      periodCount: 5,
      defaultBreakMinutes: 10,
      intermissions: [
        { afterPeriodPosition: 1, durationMinutes: 10, kind: "BREAK" },
        { afterPeriodPosition: 2, durationMinutes: 15, kind: "BREAK" },
        { afterPeriodPosition: 3, durationMinutes: 0, kind: "BREAK" },
        { afterPeriodPosition: 4, durationMinutes: 5, kind: "TRANSITION" },
      ],
    });
    expect(timeline.intermissions.map((item) => [item.afterPeriodPosition, item.kind, intervalDuration(item.startTime, item.endTime)])).toEqual([[1, "BREAK", 10], [2, "BREAK", 15], [4, "TRANSITION", 5]]);
    expect(timeline.periods[2].endTime).toBe(timeline.periods[3].startTime);
    expect(timeline.periods.at(-1)?.endTime).toBe("13:15");
  });

  it("ورود دستی با مدت زنگ‌های نابرابر و فاصله جابه‌جایی را معتبر می‌داند", () => {
    const timeline = manualExample();
    expect(timeline.periods.map((period) => intervalDuration(period.startTime, period.endTime))).toEqual([75, 80, 85, 50]);
    expect(validateSchoolDayTimeline(timeline)).toEqual([]);
  });

  it("برنامه‌های متفاوت مدرسه و ساعت شروع/پایان سفارشی را پشتیبانی می‌کند", () => {
    const first = calculateAutomaticTimeline({ startTime: "08:00", endTime: "12:30", periodCount: 4, defaultBreakMinutes: 10 });
    const second = calculateAutomaticTimeline({ startTime: "07:45", endTime: "13:15", periodCount: 6, defaultBreakMinutes: 5 });
    expect(first.periods).toHaveLength(4);
    expect(second.periods).toHaveLength(6);
    expect(first.periods.at(-1)?.endTime).toBe("12:30");
    expect(second.periods[0].startTime).toBe("07:45");
  });

  it("زنگ یا استراحت هم‌پوشان، شکاف تعریف‌نشده و توالی نامعتبر را رد می‌کند", () => {
    const overlapPeriod = manualExample();
    overlapPeriod.periods[1].startTime = "09:10";
    expect(validateSchoolDayTimeline(overlapPeriod).join(" ")).toContain("باید دقیقاً بین دو زنگ");

    const overlapBreak = manualExample();
    overlapBreak.intermissions[0].endTime = "09:30";
    expect(validateSchoolDayTimeline(overlapBreak).join(" ")).toContain("باید دقیقاً بین دو زنگ");

    const accidentalGap = manualExample();
    accidentalGap.intermissions.splice(2, 1);
    expect(validateSchoolDayTimeline(accidentalGap).join(" ")).toContain("فاصله تعریف‌نشده");

    const duplicateIndex = manualExample();
    duplicateIndex.periods[1].position = 1;
    expect(validateSchoolDayTimeline(duplicateIndex).join(" ")).toContain("شماره زنگ‌ها");
  });

  it("برنامه خودکار ناممکن و زنگ صفر دقیقه را رد می‌کند", () => {
    expect(() => calculateAutomaticTimeline({ startTime: "08:00", endTime: "08:03", periodCount: 4, defaultBreakMinutes: 10 })).toThrow("کافی نیست");
    const timeline = manualExample();
    timeline.periods[0].endTime = timeline.periods[0].startTime;
    expect(validateSchoolDayTimeline(timeline).join(" ")).toContain("مدت معتبر ندارد");
  });
});
