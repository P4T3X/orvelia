import { VERIFICATION_STATUS_LABELS, type VerificationStatus } from "@orvelia/domain";
import { cn } from "@/lib/utils";

const verificationTone: Record<VerificationStatus, string> = {
  confirmed: "border-success/30 text-success",
  manual: "border-border-strong text-muted-foreground",
  extracted: "border-accent/50 text-accent-ink",
  needs_verification: "border-danger/30 text-danger",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[12px]", verificationTone[status])}>
      {VERIFICATION_STATUS_LABELS[status]}
    </span>
  );
}
