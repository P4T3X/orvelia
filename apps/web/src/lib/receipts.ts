import "server-only";

import type { ExtractionResult } from "@orvelia/ai";
import type { ProcessingStatus } from "@orvelia/domain";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ReceiptSummary = {
  id: string;
  status: ProcessingStatus;
  merchant: string | null;
  purchaseDate: string | null;
  total: number | null;
  currency: string | null;
  mimeType: string | null;
  createdAt: string;
  /** Best available label: confirmed merchant, else extracted merchant. */
  label: string | null;
};

export type ReceiptDetail = ReceiptSummary & {
  receiptNumber: string | null;
  tax: number | null;
  extraction: ExtractionResult | null;
  processingError: string | null;
  fieldSources: Record<string, "extracted" | "manual">;
  confirmedAt: string | null;
  updatedAt: string;
  products: { id: string; name: string }[];
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

function asExtraction(v: unknown): ExtractionResult | null {
  return v && typeof v === "object" && "data" in v ? (v as ExtractionResult) : null;
}

export const getScanUsage = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scan_usage");
  if (error) throw new Error(`No se pudo calcular el uso de escaneos: ${error.message}`);
  const row = data?.[0];
  const used = row?.used ?? 0;
  const limit = row?.scans_per_month ?? 0;
  return { used, limit, plan: row?.plan ?? "free", remaining: Math.max(0, limit - used) };
});

export async function listReceipts(userId: string, opts: { limit?: number; status?: ProcessingStatus[] } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("receipts")
    .select("id, processing_status, merchant, purchase_date, total_amount, currency, mime_type, extraction, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.status?.length) q = q.in("processing_status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(`No se pudieron cargar los comprobantes: ${error.message}`);

  return (data ?? []).map<ReceiptSummary>((r) => {
    const ex = asExtraction(r.extraction);
    return {
      id: r.id,
      status: r.processing_status,
      merchant: r.merchant,
      purchaseDate: r.purchase_date,
      total: num(r.total_amount),
      currency: r.currency,
      mimeType: r.mime_type,
      createdAt: r.created_at,
      label: r.merchant ?? ex?.data.merchant ?? null,
    };
  });
}

export async function getReceipt(userId: string, id: string): Promise<ReceiptDetail | null> {
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el comprobante: ${error.message}`);
  if (!r) return null;

  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("user_id", userId)
    .eq("receipt_id", id)
    .order("name");

  const ex = asExtraction(r.extraction);
  return {
    id: r.id,
    status: r.processing_status,
    merchant: r.merchant,
    receiptNumber: r.receipt_number,
    purchaseDate: r.purchase_date,
    total: num(r.total_amount),
    tax: num(r.tax_amount),
    currency: r.currency,
    mimeType: r.mime_type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    label: r.merchant ?? ex?.data.merchant ?? null,
    extraction: ex,
    processingError: r.processing_error,
    fieldSources: (r.field_sources ?? {}) as Record<string, "extracted" | "manual">,
    confirmedAt: r.confirmed_at,
    products: products ?? [],
  };
}
