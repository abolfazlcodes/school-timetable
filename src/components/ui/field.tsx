import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}

export function FieldShell({ label, hint, error, required, htmlFor, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}{required ? <span className="field__required" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? <p className="field__error" id={`${htmlFor}-error`}>{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <span className="select-wrap">
      <select ref={ref} className={cn("input select", className)} {...props}>{children}</select>
      <ChevronDown aria-hidden="true" size={16} />
    </span>
  );
});
