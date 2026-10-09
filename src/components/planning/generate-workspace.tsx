import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Eye, Layers3, PencilLine, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PreflightResult } from "@/modules/scheduling/preflight";
import type { StoredRun } from "@/modules/scheduling/repository";
import { createScheduleWorkspaceAction } from "@/modules/timetable/actions";
import { GenerateControl } from "./generate-control";

function metric(summary: Record<string, unknown>, key: string) {
  return typeof summary[key] === "number" ? summary[key] as number : 0;
}

export function GenerateWorkspace({
  preflight,
  run,
  workspaceError = false,
}: {
  preflight: PreflightResult;
  run: StoredRun | null;
  workspaceError?: boolean;
}) {
  if (!preflight.canGenerate) {
    return (
      <section className="panel generation-blocked">
        <AlertTriangle size={28} />
        <h2>تولید برنامه فعلاً ممکن نیست</h2>
        <p>خطاهای مرحله بررسی اطلاعات را رفع کنید؛ موتور هیچ قید سختی را نادیده نمی‌گیرد.</p>
        <Link className="button button--primary button--md" href="/planning?step=review">بازگشت به بررسی اطلاعات</Link>
      </section>
    );
  }
  return (
    <div className="generation-workspace">
      {workspaceError ? <p className="form-message form-message--error" role="alert">آماده‌سازی گزینه برای اصلاح انجام نشد؛ ممکن است داده‌های برنامه تغییر کرده باشند.</p> : null}
      <section className="panel generation-action">
        <div>
          <span className="section-icon"><Layers3 size={20} /></span>
          <span><h2>{run ? "تولید نسخه جدید" : "همه‌چیز برای تولید آماده است"}</h2><p>سامانه با همان داده‌ها همواره تصمیم‌های قابل بازتولید می‌گیرد.</p></span>
        </div>
        <GenerateControl />
      </section>
      {run ? (
        <>
          <section className={`generation-result ${run.status === "SUCCEEDED" ? "is-success" : "is-error"}`}>
            <div>
              {run.status === "SUCCEEDED" ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
              <span>
                <strong>{run.status === "SUCCEEDED" ? "برنامه معتبر تولید شد" : "برنامه معتبر پیدا نشد"}</strong>
                <small>{run.status === "SUCCEEDED" ? `${run.candidates.length.toLocaleString("fa-IR")} گزینه معتبر برای بررسی آماده است.` : run.issues[0]?.message}</small>
              </span>
            </div>
            <Badge variant={run.status === "SUCCEEDED" ? "success" : "danger"}>{run.status === "SUCCEEDED" ? "معتبر" : "بدون پاسخ"}</Badge>
          </section>
          <section className="generation-metrics">
            <div><ShieldCheck size={18} /><span>نقض قید سخت</span><strong>۰</strong></div>
            <div><Layers3 size={18} /><span>جلسات</span><strong>{metric(run.summary, "sessionCount").toLocaleString("fa-IR")}</strong></div>
            <div><Clock3 size={18} /><span>زمان تولید</span><strong>{(run.generationTimeMs / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} ثانیه</strong></div>
          </section>
          {run.issues.length ? <div className="run-warnings">{run.issues.map((issue) => <p key={issue.code}><AlertTriangle size={15} />{issue.message}</p>)}</div> : null}
          <section className="candidate-list">
            <header><div><h2>گزینه‌های برنامه</h2><p>امتیاز بالاتر یعنی ترجیحات بیشتری رعایت شده است.</p></div></header>
            {run.candidates.map((candidate) => (
              <article className="candidate-card" key={candidate.rank}>
                <div>
                  <span className="candidate-rank">{candidate.rank.toLocaleString("fa-IR")}</span>
                  <span><strong>گزینه {candidate.rank.toLocaleString("fa-IR")}</strong><small>{candidate.assignments.length.toLocaleString("fa-IR")} جلسه زمان‌بندی‌شده</small></span>
                </div>
                <div className="candidate-score"><span>امتیاز</span><strong>{(candidate.score / 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}</strong></div>
                <Badge variant="success">بدون تداخل</Badge>
                <div className="candidate-actions">
                  <Link className="button button--secondary button--sm" href={`/timetable?run=${run.id}&rank=${candidate.rank}`}><Eye size={14} />مشاهده</Link>
                  <form action={createScheduleWorkspaceAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="rank" value={candidate.rank} />
                    <input type="hidden" name="returnTo" value="planning" />
                    <button className="button button--primary button--sm" type="submit"><PencilLine size={14} />بررسی و اصلاح</button>
                  </form>
                </div>
              </article>
            ))}
            {run.status !== "SUCCEEDED" ? <p className="inline-callout">{run.issues[0]?.message ?? "محدودیت‌ها را بازبینی کنید."}</p> : null}
          </section>
        </>
      ) : (
        <section className="generation-empty"><ShieldCheck size={28} /><h2>تولید آماده است</h2><p>{preflight.summary.classCount.toLocaleString("fa-IR")} کلاس و {preflight.summary.sessionCount.toLocaleString("fa-IR")} جلسه بررسی شده‌اند. برای شروع دکمه بالا را بزنید.</p></section>
      )}
    </div>
  );
}
