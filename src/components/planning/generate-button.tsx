"use client";

import { useFormStatus } from "react-dom";
import { CalendarCog, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerateButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="generate-button">{pending ? <LoaderCircle className="spin" size={18} /> : <CalendarCog size={18} />}{pending ? "در حال ساخت برنامه معتبر…" : "تولید برنامه"}</Button>;
}
