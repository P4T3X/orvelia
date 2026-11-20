"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/** Native <dialog> for confirmations: focus trap, Esc and backdrop handled by the browser. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  // Sync React state with the native modal (gives focus trap, Esc and top layer).
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={close}
        onCancel={(e) => pending && e.preventDefault()}
        onClick={(e) => e.target === e.currentTarget && !pending && close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface-raised p-0 text-foreground backdrop:bg-[#111315]/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-medium">
            {title}
          </h2>
          <div className="mt-2 leading-relaxed text-muted-foreground">{description}</div>
          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={pending} autoFocus>
              Cancelar
            </Button>
            <Button variant="danger" onClick={onConfirm} loading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
