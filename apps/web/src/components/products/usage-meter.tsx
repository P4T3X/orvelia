import Link from "next/link";
import { cn } from "@/lib/utils";

export function UsageMeter({ used, max }: { used: number; max: number | null }) {
  if (max === null) return null;
  const ratio = Math.min(1, used / Math.max(1, max));
  const atLimit = used >= max;
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Productos usados del plan"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={used}
      >
        <div className={cn("h-full rounded-full", atLimit ? "bg-danger" : "bg-accent")} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="tabular-nums">
        {used} de {max} productos
      </span>
      {atLimit && (
        <Link href="/app/billing" className="text-foreground underline underline-offset-4">
          Ver plan
        </Link>
      )}
    </div>
  );
}
