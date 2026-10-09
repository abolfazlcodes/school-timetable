"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const reference = error.digest ? ` کد پیگیری: ${error.digest}` : "";
  return <main className="standalone-state"><ErrorState title="انجام عملیات با خطا روبه‌رو شد" description={`درخواست کامل نشد؛ نسخه جدید صفحه را بارگذاری کنید. اگر خطا تکرار شد، کد پیگیری را برای پشتیبانی بفرستید.${reference}`} actionLabel="بارگذاری دوباره" onAction={() => window.location.reload()} /></main>;
}
