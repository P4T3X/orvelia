import { PRODUCT_STATUS_LABELS, type ProductStatus } from "@orvelia/domain";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px]",
        status === "active"
          ? "border-success/30 text-success"
          : "border-border-strong text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", status === "active" ? "bg-success" : "bg-muted-foreground/60")}
      />
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}
