import { CircleAlert, CircleCheck, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { icon: Info, className: "border-border-strong bg-muted text-foreground" },
  success: { icon: CircleCheck, className: "border-success/30 bg-success/8 text-foreground" },
  error: { icon: CircleAlert, className: "border-danger/30 bg-danger-surface text-foreground" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm", toneClass, className)}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "error" ? "text-danger" : tone === "success" ? "text-success" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="grid gap-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}
