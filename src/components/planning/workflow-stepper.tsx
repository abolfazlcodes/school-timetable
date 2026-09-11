import Link from "next/link";
import { Check, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export const workflowSteps = [
  { key: "structure", label: "ساختار مدرسه", available: true },
  { key: "curriculum", label: "دروس و ساعات", available: true },
  { key: "teachers", label: "دبیران و حضور", available: true },
  { key: "review", label: "بررسی اطلاعات", available: true },
  { key: "generate", label: "تولید برنامه", available: true },
  { key: "edit", label: "بررسی و اصلاح", available: true },
  { key: "publish", label: "انتشار", available: true },
] as const;

export type PlanningStep = (typeof workflowSteps)[number]["key"];

export function WorkflowStepper({ activeStep }: { activeStep: PlanningStep }) {
  const activeIndex = workflowSteps.findIndex((step) => step.key === activeStep);
  return (
    <nav className="planning-stepper" aria-label="مراحل برنامه‌ریزی">
      {workflowSteps.map((step, index) => {
        const content = <><span className="planning-stepper__number">{index < activeIndex ? <Check size={14} /> : step.available ? (index + 1).toLocaleString("fa-IR") : <LockKeyhole size={12} />}</span><span>{step.label}</span></>;
        return step.available ? <Link key={step.key} href={`/planning?step=${step.key}`} className={cn("planning-step", index === activeIndex && "is-active", index < activeIndex && "is-done")} aria-current={index === activeIndex ? "step" : undefined}>{content}</Link> : <span key={step.key} className="planning-step is-locked" aria-disabled="true">{content}</span>;
      })}
    </nav>
  );
}
