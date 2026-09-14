import Link from "next/link";
import { AlertCircle, ArrowLeft, CalendarCheck2, Clock3, GraduationCap, UsersRound } from "lucide-react";
import { Breadcrumbs } from "./layout/breadcrumbs";
import { Badge } from "./ui/badge";
import { formatNumber, formatPersianDateTime } from "@/lib/utils";
import type { DashboardData } from "@/modules/dashboard/service";

const versionLabels = { DRAFT: "پیش‌نویس", PUBLISHED: "منتشرشده", ARCHIVED: "بایگانی‌شده" } as const;

export function Dashboard({ data }: { data: DashboardData }) {
  const metrics = [
    { label: "کلاس‌ها", value: data.classCount, icon: GraduationCap },
    { label: "دبیران", value: data.teacherCount, icon: UsersRound },
    { label: "ساعت هفتگی", value: data.weeklyHours, icon: Clock3 },
  ];
  return (
    <>
      <Breadcrumbs items={[{ label: "داشبورد" }]} />
      <section className="page-heading page-heading--compact">
        <div><h1>داشبورد</h1><p>{data.academicYearTitle ? `سال تحصیلی ${data.academicYearTitle}` : "سال تحصیلی فعال تعیین نشده است"}</p></div>
        <Link className="button button--primary button--md" href={data.continueHref}>ادامه برنامه‌ریزی <ArrowLeft size={16} /></Link>
      </section>
      <section className="compact-overview" aria-label="خلاصه مدرسه">
        <div className="active-year"><span>سال تحصیلی فعال</span><strong>{data.academicYearTitle ?? "تعیین نشده"}</strong></div>
        {metrics.map(({ label, value, icon: Icon }) => <div className="compact-metric" key={label}><Icon size={18} aria-hidden="true" /><span>{label}</span><strong>{formatNumber(value)}</strong></div>)}
        <div className="compact-metric compact-metric--problem"><AlertCircle size={18} aria-hidden="true" /><span>مشکلات</span><strong>{formatNumber(data.issueCount)}</strong></div>
      </section>
      <section className="dashboard-compact-grid" id="planning-status">
        <article className="panel planning-status">
          <div className="panel__header"><div><h2>وضعیت برنامه هفتگی</h2><p>وضعیت واقعی اطلاعات مدرسه و برنامه جاری</p></div><Badge variant={data.statusTone}>{data.statusLabel}</Badge></div>
          <div className="planning-status__body">{data.planningRows.map((row) => <div className="planning-status__row" key={row.label}><span>{row.label}</span><strong className={row.complete ? "success-text" : "warning-text"}>{row.complete ? "تکمیل" : "نیازمند تکمیل"}</strong></div>)}</div>
          <div className="planning-status__footer"><div className="progress" aria-label={`${formatNumber(data.progress)} درصد تکمیل`}><span style={{ width: `${data.progress}%` }} /></div><span>{formatNumber(data.progress)}٪ آماده</span></div>
        </article>
        <article className="panel current-schedule">
          <div className="panel__header"><div><h2>برنامه جاری</h2><p>آخرین نسخه ذخیره‌شده</p></div><CalendarCheck2 size={20} aria-hidden="true" /></div>
          {data.latestVersion ? <>
            <div className="current-schedule__body"><div><strong>نسخه {formatNumber(data.latestVersion.number)}</strong><span>برنامه سال تحصیلی فعال</span></div><Badge variant={data.latestVersion.status === "PUBLISHED" ? "success" : data.latestVersion.status === "DRAFT" ? "warning" : undefined}>{versionLabels[data.latestVersion.status]}</Badge></div>
            <div className="current-schedule__meta"><span>آخرین تغییر</span><strong>{formatPersianDateTime(data.latestVersion.date)}</strong></div>
          </> : <div className="dashboard-empty-inline"><span>هنوز نسخه‌ای ذخیره نشده است.</span><Link href="/planning?step=generate">رفتن به تولید برنامه</Link></div>}
        </article>
      </section>
      <section className="panel compact-issues">
        <div className="panel__header"><div><h2>موارد مهم</h2><p>{data.issueCount ? `${formatNumber(data.issueCount)} مورد نیازمند بررسی است.` : "مورد مهم حل‌نشده‌ای وجود ندارد."}</p></div></div>
        {data.issues.length ? <ul>{data.issues.map((issue, index) => <li key={`${issue.code}:${issue.entityId}:${index}`}><Badge variant={issue.severity === "ERROR" ? "danger" : "warning"}>{issue.severity === "ERROR" ? "خطا" : "هشدار"}</Badge><div><strong>{issue.message}</strong></div><Link href={issue.fixHref ?? data.continueHref} aria-label={`بررسی ${issue.message}`}>بررسی <ArrowLeft size={14} /></Link></li>)}</ul> : <div className="dashboard-empty-inline"><span>اطلاعات فعلی برای ادامه آماده است.</span><Link href={data.continueHref}>ادامه مسیر</Link></div>}
      </section>
    </>
  );
}
