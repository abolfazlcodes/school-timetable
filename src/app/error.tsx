"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="standalone-state"><ErrorState title="بارگذاری صفحه انجام نشد" description="اتصال خود را بررسی کنید و دوباره تلاش کنید." onAction={reset} /></main>;
}
