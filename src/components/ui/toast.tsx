"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "info";
interface ToastItem { id: number; title: string; description?: string; kind: ToastKind }
interface ToastContextValue { notify: (title: string, description?: string, kind?: ToastKind) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const notify = useCallback((title: string, description?: string, kind: ToastKind = "success") => {
    const id = Date.now();
    setItems((current) => [...current, { id, title, description, kind }]);
    window.setTimeout(() => remove(id), 4200);
  }, [remove]);
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-label="پیام‌ها">
        {items.map((item) => {
          const Icon = item.kind === "success" ? CheckCircle2 : Info;
          return <div className="toast" key={item.id}><Icon aria-hidden="true" size={20} /><div><strong>{item.title}</strong>{item.description ? <p>{item.description}</p> : null}</div><button onClick={() => remove(item.id)} aria-label="بستن پیام"><X size={16} /></button></div>;
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast باید داخل ToastProvider استفاده شود");
  return context;
}
