export type GenerationFailureCode =
  | "PREFLIGHT_BLOCKED"
  | "FORBIDDEN"
  | "SOLVER_UNAVAILABLE"
  | "GENERATION_TIMEOUT"
  | "DATABASE_UNAVAILABLE"
  | "GENERATION_FAILED"
  | "REQUEST_FAILED";

export type GenerationActionResult =
  | { status: "success"; runId: string }
  | {
      status: "error";
      code: GenerationFailureCode;
      message: string;
      reference?: string;
      reviewRequired?: boolean;
    };

function errorText(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return `${error.name} ${error.message} ${cause instanceof Error ? cause.message : ""}`;
  }
  return String(error ?? "");
}

export function classifyGenerationFailure(
  error: unknown,
  reference: string,
): Extract<GenerationActionResult, { status: "error" }> {
  const details = errorText(error);
  if (/ortools|cp-sat|prebuilt binary|libortools|shared object|dlopen/i.test(details)) {
    return {
      status: "error",
      code: "SOLVER_UNAVAILABLE",
      message: "موتور زمان‌بندی روی سرور اجرا نشد. این مشکل از تنظیمات سرور است و اطلاعات واردشده شما تغییری نکرده است.",
      reference,
    };
  }
  if (/function_invocation_timeout|timed?\s*out|timeout|deadline exceeded/i.test(details)) {
    return {
      status: "error",
      code: "GENERATION_TIMEOUT",
      message: "ساخت برنامه در زمان مجاز سرور کامل نشد. دوباره تلاش کنید؛ اگر تکرار شد، کد پیگیری را برای پشتیبانی بفرستید.",
      reference,
    };
  }
  if (/failed query|econnrefused|enotfound|postgres|database|connection terminated/i.test(details)) {
    return {
      status: "error",
      code: "DATABASE_UNAVAILABLE",
      message: "ارتباط با پایگاه داده هنگام ساخت برنامه برقرار نشد. اطلاعات شما حذف نشده است؛ کمی بعد دوباره تلاش کنید.",
      reference,
    };
  }
  return {
    status: "error",
    code: "GENERATION_FAILED",
    message: "ساخت برنامه به‌دلیل یک خطای داخلی کامل نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید و در صورت تکرار، کد پیگیری را ارسال کنید.",
    reference,
  };
}
