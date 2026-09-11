"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

export function Dialog({ open, title, description, children, confirmLabel = "تأیید", cancelLabel = "انصراف", destructive, onConfirm, onClose }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="dialog" onCancel={onClose} onClose={onClose} aria-labelledby="dialog-title">
      <div className="dialog__header">
        <div><h2 id="dialog-title">{title}</h2>{description ? <p>{description}</p> : null}</div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="بستن"><X size={19} /></Button>
      </div>
      {children ? <div className="dialog__body">{children}</div> : null}
      <div className="dialog__footer">
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
      </div>
    </dialog>
  );
}
