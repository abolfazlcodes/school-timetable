import { z } from "zod";
import type { AvailabilityStatus } from "@/db/schema";

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

export function integerFromForm(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  return Number(normalizeDigits(value.trim()));
}

export const positiveInteger = (label: string, maximum = 9999) =>
  z.preprocess(
    integerFromForm,
    z
      .number({ error: `${label} باید عدد باشد.` })
      .int(`${label} باید عدد صحیح باشد.`)
      .min(1, `${label} باید بیشتر از صفر باشد.`)
      .max(maximum, `${label} بیش از حد مجاز است.`),
  );

export const nonNegativeInteger = (label: string, maximum = 9999) =>
  z.preprocess(
    integerFromForm,
    z
      .number({ error: `${label} باید عدد باشد.` })
      .int(`${label} باید عدد صحیح باشد.`)
      .min(0, `${label} نمی‌تواند منفی باشد.`)
      .max(maximum, `${label} بیش از حد مجاز است.`),
  );

export function calculateSuggestedClassCount(
  studentCount: number,
  maxClassCapacity: number,
) {
  if (!Number.isInteger(studentCount) || studentCount <= 0)
    throw new Error("تعداد دانش‌آموز باید بیشتر از صفر باشد.");
  if (!Number.isInteger(maxClassCapacity) || maxClassCapacity <= 0)
    throw new Error("ظرفیت کلاس باید بیشتر از صفر باشد.");
  return Math.ceil(studentCount / maxClassCapacity);
}

export function distributeStudents(
  studentCount: number,
  classCount: number,
  maxCapacity: number,
) {
  if (classCount <= 0 || studentCount <= 0 || maxCapacity <= 0)
    throw new Error("مقادیر تقسیم کلاس معتبر نیستند.");
  if (studentCount > classCount * maxCapacity)
    throw new Error(
      "تعداد کلاس انتخاب‌شده برای این تعداد دانش‌آموز کافی نیست.",
    );
  const base = Math.floor(studentCount / classCount);
  const remainder = studentCount % classCount;
  return Array.from(
    { length: classCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function parseSessionPattern(value: unknown) {
  if (Array.isArray(value))
    return value.map((item) =>
      typeof item === "string" ? Number(normalizeDigits(item)) : Number(item),
    );
  if (typeof value !== "string") return [];
  return normalizeDigits(value)
    .split(/[+,،\s]+/)
    .filter(Boolean)
    .map(Number);
}

export function suggestSessionPatterns(weeklyHours: number): number[][] {
  if (!Number.isInteger(weeklyHours) || weeklyHours <= 0) return [];
  const maximumTwoUnitSessions = Math.floor(weeklyHours / 2);
  return Array.from({ length: maximumTwoUnitSessions + 1 }, (_, index) => {
    const twoUnitSessions = maximumTwoUnitSessions - index;
    const oneUnitSessions = weeklyHours - twoUnitSessions * 2;
    return [
      ...Array.from({ length: twoUnitSessions }, () => 2),
      ...Array.from({ length: oneUnitSessions }, () => 1),
    ];
  });
}

export function describeSessionPattern(pattern: number[]) {
  if (pattern.length === 1) return "یک جلسه پیوسته";
  if (pattern.every((part) => part === 1))
    return `${pattern.length.toLocaleString("fa-IR")} جلسه تک‌ساعته`;
  if (pattern.every((part) => part === 2))
    return `${pattern.length.toLocaleString("fa-IR")} جلسه کامل`;
  return "ترکیب جلسه کامل و تک‌ساعت";
}

export function validateSessionPattern(
  weeklyHours: number,
  sessionCount: number,
  pattern: number[],
) {
  if (pattern.length !== sessionCount)
    return "تعداد بخش‌های الگوی جلسات باید با تعداد جلسه برابر باشد.";
  if (pattern.some((hours) => !Number.isInteger(hours) || hours <= 0))
    return "ساعت آموزشی هر جلسه باید عدد صحیح و بیشتر از صفر باشد.";
  if (pattern.reduce((sum, hours) => sum + hours, 0) !== weeklyHours)
    return "مجموع الگوی جلسات باید با ساعات هفتگی برابر باشد.";
  return null;
}

export function calculateCurriculumWorkload(
  classCount: number,
  weeklyHours: number,
) {
  if (classCount < 0 || weeklyHours < 0)
    throw new Error("ورودی محاسبه ساعات معتبر نیست.");
  return classCount * weeklyHours;
}

export interface WorkloadLimits {
  minimum: number;
  required: number;
  maximum: number;
  overtime: number;
  dailyMinimum: number;
  dailyMaximum: number;
  maxConsecutive: number;
}

export function validateWorkload(limits: WorkloadLimits) {
  if (
    Object.values(limits).some((value) => !Number.isInteger(value) || value < 0)
  )
    return "مقادیر موظفی و محدودیت‌ها باید عدد صحیح و نامنفی باشند.";
  if (limits.minimum > limits.required || limits.required > limits.maximum)
    return "باید حداقل موظفی، موظفی و حداکثر موظفی به‌ترتیب افزایش یابند.";
  if (limits.dailyMinimum > limits.dailyMaximum)
    return "حداقل تدریس روزانه نمی‌تواند از حداکثر بیشتر باشد.";
  if (limits.dailyMaximum < 1)
    return "حداکثر تدریس روزانه باید بیشتر از صفر باشد.";
  if (limits.maxConsecutive < 1 || limits.maxConsecutive > limits.dailyMaximum)
    return "حداکثر زنگ متوالی باید بین یک و حداکثر تدریس روزانه باشد.";
  return null;
}

export const availabilityStatuses: readonly AvailabilityStatus[] = [
  "AVAILABLE",
  "UNAVAILABLE",
  "PREFERRED",
  "RESTRICTED",
];

export function validateAvailability(
  statuses: Record<string, string>,
  validPeriodIds: ReadonlySet<string>,
) {
  const entries = Object.entries(statuses);
  if (entries.some(([periodId]) => !validPeriodIds.has(periodId)))
    return "یکی از زنگ‌های انتخاب‌شده متعلق به برنامه زمانی فعال نیست.";
  if (
    entries.some(
      ([, status]) =>
        !availabilityStatuses.includes(status as AvailabilityStatus),
    )
  )
    return "یکی از وضعیت‌های حضور معتبر نیست.";
  return null;
}
