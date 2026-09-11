import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: "success" | "warning" | "danger" }) {
  return <span className={cn("badge", variant && `badge--${variant}`, className)} {...props} />;
}
