import { FileText, ImageIcon } from "lucide-react";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import type { ReceiptSummary } from "@/lib/receipts";
import { ReceiptStatus } from "./receipt-status";

export function ReceiptList({ receipts }: { receipts: ReceiptSummary[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
      {receipts.map((r) => {
        const Icon = r.mimeType === "application/pdf" ? FileText : ImageIcon;
        const amount = formatMoney(r.total, r.currency);
        const date = formatDate(r.purchaseDate, "short") ?? formatDate(r.createdAt.slice(0, 10), "short");
        return (
          <li key={r.id}>
            <Link href={`/app/scanner/${r.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted sm:px-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                <Icon className="size-4 text-muted-foreground" aria-hidden strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.label ?? "Comprobante sin revisar"}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {[date, amount].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ReceiptStatus status={r.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
