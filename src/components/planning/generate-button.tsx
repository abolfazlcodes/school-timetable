"use client";

import { CalendarCog, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerateButton({ pending = false, disabled = false }: { pending?: boolean; disabled?: boolean }) {
  return <Button type="submit" disabled={pending || disabled} className="generate-button">{pending ? <LoaderCircle className="spin" size={18} /> : <CalendarCog size={18} />}{pending ? "در حال ساخت برنامه معتبر…" : "تولید برنامه"}</Button>;
}
