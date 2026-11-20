import { PROCESSING_STATUS_LABELS, type ProcessingStatus } from "@orvelia/domain";
import { cn } from "@/lib/utils";

const tone: Record<ProcessingStatus, string> = {
  uploaded: "border-border-strong text-muted-foreground",
  processing: "border-border-strong text-muted-foreground",
  needs_review: "border-accent/50 text-accent-ink",
  confirmed: "border-success/30 text-success",
  failed: "border-danger/30 text-danger",
};

export function ReceiptStatus({ status, className }: { status: ProcessingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px]", tone[status], className)}>
      {PROCESSING_STATUS_LABELS[status]}
    </span>
  );
}
