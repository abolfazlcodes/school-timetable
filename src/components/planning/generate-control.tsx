"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateTimetableAction } from "@/modules/scheduling/actions";
import type { GenerationActionResult } from "@/modules/scheduling/generation-error";
import { GenerateButton } from "./generate-button";

type GenerateAction = () => Promise<GenerationActionResult>;
type NavigateToRun = (href: string) => void;

const DEFAULT_REQUEST_TIMEOUT_MS = 65_000;

const requestFailure: Extract<GenerationActionResult, { status: "error" }> = {
  status: "error",
  code: "REQUEST_FAILED",
  message: "پاسخی از سرور دریافت نشد. صفحه را تازه‌سازی کنید و دوباره تلاش کنید؛ اطلاعات واردشده شما حفظ شده است.",
};

async function runWithTimeout(action: GenerateAction, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("SCHEDULE_GENERATION_REQUEST_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function GenerateControl({
  action = generateTimetableAction,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  navigate = (href) => window.location.assign(href),
}: {
  action?: GenerateAction;
  timeoutMs?: number;
  navigate?: NavigateToRun;
}) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Extract<GenerationActionResult, { status: "error" }> | null>(null);
  const requiresReload = failure?.code === "REQUEST_FAILED";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await runWithTimeout(action, timeoutMs);
        if (result.status === "success") {
          // A document navigation prevents the successful action response from
          // racing with a second Server Action submitted from the result page.
          navigate(`/planning?step=generate&run=${result.runId}`);
          return;
        }
        setFailure(result);
      } catch (error) {
        console.error("Schedule generation request failed", error);
        setFailure(requestFailure);
      }
    });
  }

  return (
    <div className="generation-control">
      <form onSubmit={submit}><GenerateButton pending={pending} disabled={requiresReload} /></form>
      {failure ? (
        <div className="generation-control__error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>تولید برنامه انجام نشد</strong>
            <small>{failure.message}</small>
            {failure.reference ? <small>کد پیگیری: <bdi>{failure.reference}</bdi></small> : null}
            {failure.reviewRequired ? <Link href="/planning?step=review">بازگشت به بررسی اطلاعات</Link> : null}
            {requiresReload ? <Button type="button" variant="secondary" size="sm" onClick={() => window.location.reload()}>بارگذاری نسخه جدید</Button> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
