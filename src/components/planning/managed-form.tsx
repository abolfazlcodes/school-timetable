"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/modules/planning/action-state";
import { cn } from "@/lib/utils";

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ManagedForm({ action, children, submitLabel = "ذخیره", className, compact = false }: { action: FormAction; children: React.ReactNode; submitLabel?: string; className?: string; compact?: boolean }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ? [...new Set(Object.values(state.fieldErrors).flat())] : [];
  return (
    <form action={formAction} className={cn("managed-form", compact && "managed-form--compact", className)}>
      {children}
      <div className="managed-form__footer">
        <Button type="submit" size={compact ? "sm" : "md"} disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{pending ? "در حال ذخیره…" : submitLabel}</Button>
        {state.message ? <div className={cn("form-message", state.status === "error" && "form-message--error", state.status === "success" && "form-message--success")} role={state.status === "error" ? "alert" : "status"}>{state.message}{errors.length ? <ul>{errors.slice(0, 3).map((error) => <li key={error}>{error}</li>)}</ul> : null}</div> : null}
      </div>
    </form>
  );
}
