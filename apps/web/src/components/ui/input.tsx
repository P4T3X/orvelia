import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-[15px] text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70",
        "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20",
        "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "select-chevron h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 pr-10 text-[15px] text-foreground",
        "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70",
        "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
