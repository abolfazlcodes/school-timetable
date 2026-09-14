import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PreflightResult } from "@/modules/scheduling/preflight";

const groups = [
  {
    severity: "ERROR",
    title: "خطاها",
    icon: XCircle,
    empty: "خطای مسدودکننده‌ای پیدا نشد.",
  },
  {
    severity: "WARNING",
    title: "هشدارها",
    icon: AlertTriangle,
    empty: "هشداری وجود ندارد.",
  },
  {
    severity: "INFO",
    title: "اطلاعات",
    icon: CheckCircle2,
    empty: "اطلاعات تکمیلی پس از ورود داده نمایش داده می‌شود.",
  },
] as const;

export function PreflightWorkspace({ result }: { result: PreflightResult }) {
  return (
    <div className="preflight-workspace">
      <section
        className={`preflight-summary ${result.canGenerate ? "is-ready" : "is-blocked"}`}
      >
        <div>
          {result.canGenerate ? (
            <CheckCircle2 size={25} />
          ) : (
            <CircleHelp size={25} />
          )}
          <span>
            <strong>
              {result.canGenerate
                ? "اطلاعات برای تولید برنامه آماده است"
                : "پیش از تولید، موارد زیر را اصلاح کنید"}
            </strong>
            <small>
              {result.canGenerate
                ? "همه کنترل‌های ساختاری ضروری با موفقیت گذشتند."
                : `${result.summary.errorCount.toLocaleString("fa-IR")} خطا مانع اجرای زمان‌بندی است.`}
            </small>
          </span>
        </div>
        {result.canGenerate ? (
          <Link
            className="button button--primary button--md"
            href="/planning?step=generate"
          >
            ادامه به تولید برنامه
          </Link>
        ) : null}
      </section>
      <section className="preflight-metrics">
        <div>
          <span>کلاس‌ها</span>
          <strong>{result.summary.classCount.toLocaleString("fa-IR")}</strong>
        </div>
        <div>
          <span>دبیران</span>
          <strong>{result.summary.teacherCount.toLocaleString("fa-IR")}</strong>
        </div>
        <div>
          <span>ساعات هفتگی</span>
          <strong>{result.summary.weeklyHours.toLocaleString("fa-IR")}</strong>
        </div>
        <div>
          <span>جلسات موردنیاز</span>
          <strong>{result.summary.sessionCount.toLocaleString("fa-IR")}</strong>
        </div>
      </section>
      <div className="preflight-columns">
        {groups.map((group) => {
          const issues = result.issues.filter(
            (issue) => issue.severity === group.severity,
          );
          const Icon = group.icon;
          return (
            <section
              className={`panel issue-group issue-group--${group.severity.toLowerCase()}`}
              key={group.severity}
            >
              <header>
                <Icon size={18} />
                <strong>{group.title}</strong>
                <Badge
                  variant={
                    group.severity === "ERROR"
                      ? "danger"
                      : group.severity === "WARNING"
                        ? "warning"
                        : "success"
                  }
                >
                  {issues.length.toLocaleString("fa-IR")}
                </Badge>
              </header>
              {issues.length ? (
                <ul>
                  {issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.entityId ?? index}`}>
                      <span>{issue.message}</span>
                      {issue.fixHref ? (
                        <Link href={issue.fixHref}>اصلاح</Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{group.empty}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
