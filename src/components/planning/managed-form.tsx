"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/modules/planning/action-state";
import { cn } from "@/lib/utils";

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ManagedForm({ action, children, submitLabel = "ذخیره", className, compact = false, hideSubmit = false, refreshOnSuccess = false, onSuccess }: { action: FormAction; children: React.ReactNode; submitLabel?: string; className?: string; compact?: boolean; hideSubmit?: boolean; refreshOnSuccess?: boolean; onSuccess?: (state: ActionState) => void }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const router = useRouter();
  const handledState = useRef<ActionState>(initialActionState);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => {
    if (state.status !== "success" || handledState.current === state) return;
    handledState.current = state;
    if (refreshOnSuccess) router.refresh();
    onSuccessRef.current?.(state);
  }, [refreshOnSuccess, router, state]);
  const errors = state.fieldErrors ? [...new Set(Object.values(state.fieldErrors).flat())] : [];
  return (
    <form action={formAction} className={cn("managed-form", compact && "managed-form--compact", className)}>
      {children}
      {!hideSubmit || state.message ? <div className="managed-form__footer">
        {!hideSubmit ? <Button type="submit" size={compact ? "sm" : "md"} disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{pending ? "در حال ذخیره…" : submitLabel}</Button> : null}
        {state.message ? <div className={cn("form-message", state.status === "error" && "form-message--error", state.status === "success" && "form-message--success")} role={state.status === "error" ? "alert" : "status"}>{state.message}{errors.length ? <ul>{errors.slice(0, 3).map((error) => <li key={error}>{error}</li>)}</ul> : null}</div> : null}
      </div> : null}
    </form>
  );
}
