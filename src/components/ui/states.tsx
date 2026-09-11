import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "./button";

interface StateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, actionLabel, onAction, icon: Icon = Inbox }: StateProps) {
  return (
    <div className="state state--empty">
      <span className="state__icon"><Icon aria-hidden="true" size={22} /></span>
      <h3>{title}</h3><p>{description}</p>
      {actionLabel ? <Button size="sm" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

export function ErrorState({ title, description, actionLabel = "تلاش دوباره", onAction, icon: Icon = AlertTriangle }: StateProps) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><Icon aria-hidden="true" size={22} /></span>
      <h3>{title}</h3><p>{description}</p>
      {onAction ? <Button variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return <div className="loading-state" aria-label="در حال بارگذاری" aria-busy="true">{Array.from({ length: rows }, (_, index) => <span key={index} className="skeleton" />)}</div>;
}
