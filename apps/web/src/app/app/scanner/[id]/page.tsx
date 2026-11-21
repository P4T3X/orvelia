import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptStatus } from "@/components/scanner/receipt-status";
import { ReceiptWorkspace } from "@/components/scanner/receipt-workspace";
import { getReceiptExtractor } from "@/lib/ai";
import { getProfile, requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getProductUsage } from "@/lib/products";
import { getReceipt, getScanUsage } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Comprobante" };
/** Server actions on this page read receipts with AI (with retries). */
export const maxDuration = 180;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/app/scanner/${id}`);
  const supabase = await createClient();

  const [receipt, profile, scans, productUsage, { data: products }] = await Promise.all([
    getReceipt(user.id, id),
    getProfile(user.id),
    getScanUsage(),
    getProductUsage(),
    supabase
      .from("products")
      .select("id, name, receipt_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (!receipt) notFound();

  return (
    <>
      <Link
        href="/app/scanner"
        className="-ml-1 mb-6 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Escáner
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] font-medium tracking-[-0.025em] sm:text-[2rem]">
          {receipt.status === "confirmed" ? (receipt.label ?? "Comprobante") : "Revisar comprobante"}
        </h1>
        <ReceiptStatus status={receipt.status} />
      </div>

      <ReceiptWorkspace
        receipt={{
          id: receipt.id,
          status: receipt.status,
          mimeType: receipt.mimeType,
          merchant: receipt.merchant,
          receiptNumber: receipt.receiptNumber,
          purchaseDate: receipt.purchaseDate,
          total: receipt.total,
          tax: receipt.tax,
          currency: receipt.currency,
          extraction: receipt.extraction,
          processingError: receipt.processingError,
          processingErrorCode: receipt.processingErrorCode,
          attempts: receipt.attempts,
          retriesLeft: receipt.retriesLeft,
          fieldSources: receipt.fieldSources,
          linkedProducts: receipt.products,
        }}
        products={(products ?? []).map((p) => ({ id: p.id, name: p.name, receiptId: p.receipt_id }))}
        fileUrl={`/app/files/receipt/${receipt.id}`}
        autoReading={getReceiptExtractor() !== null}
        scansRemaining={scans.remaining}
        productSlots={productUsage.max === null ? null : Math.max(0, productUsage.max - productUsage.used)}
        defaultCurrency={profile?.preferred_currency ?? "PEN"}
      />

      <p className="mt-10 text-[13px] text-muted-foreground">
        Subido el {formatDateTime(receipt.createdAt, profile?.timezone)}
        {receipt.confirmedAt && <> · Confirmado el {formatDateTime(receipt.confirmedAt, profile?.timezone)}</>}
        {receipt.extraction && <> · Lectura: {receipt.extraction.isTest ? "lector de prueba" : receipt.extraction.provider}</>}
      </p>
    </>
  );
}
