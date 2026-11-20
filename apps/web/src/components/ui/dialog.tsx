"use client";

import { X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Controlled native <dialog> (focus trap, Esc, top layer from the browser). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-surface-raised p-0 text-foreground backdrop:bg-[#111315]/45 backdrop:backdrop-blur-[2px]",
        wide ? "w-[min(40rem,calc(100vw-2rem))]" : "w-[min(30rem,calc(100vw-2rem))]",
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-medium">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-2" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
              <X />
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
