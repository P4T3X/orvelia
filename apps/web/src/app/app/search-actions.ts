"use server";

import { normalizeSearch } from "@orvelia/schemas";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  type: "product" | "document" | "receipt";
  id: string;
  title: string;
  detail: string | null;
  href: string;
};

const querySchema = z.string().trim().min(2).max(80);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Quick search for the command palette. Reads only the signed-in user's rows
 * (RLS + explicit user filter), a few of each kind.
 */
export async function searchRecords(raw: unknown): Promise<SearchHit[]> {
  const user = await getUser();
  if (!user) return [];
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return [];
  const q = parsed.data;
  const like = `%${escapeLike(q)}%`;
  const normalized = `%${escapeLike(normalizeSearch(q))}%`;

  const supabase = await createClient();
  const receiptQuery = (column: "merchant" | "receipt_number") =>
    supabase
      .from("receipts")
      .select("id, merchant, receipt_number, purchase_date")
      .eq("user_id", user.id)
      .ilike(column, like)
      .order("created_at", { ascending: false })
      .limit(4);
  const [products, documents, byMerchant, byNumber] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, model, status")
      .eq("user_id", user.id)
      .ilike("search_text", normalized)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("documents")
      .select("id, title, product_id")
      .eq("user_id", user.id)
      .ilike("title", like)
      .order("created_at", { ascending: false })
      .limit(4),
    receiptQuery("merchant"),
    receiptQuery("receipt_number"),
  ]);
  const receipts = [...new Map([...(byMerchant.data ?? []), ...(byNumber.data ?? [])].map((r) => [r.id, r])).values()].slice(0, 4);

  return [
    ...(products.data ?? []).map<SearchHit>((p) => ({
      type: "product",
      id: p.id,
      title: p.name,
      detail: [p.brand, p.model].filter(Boolean).join(" · ") || null,
      href: `/app/products/${p.id}`,
    })),
    ...(documents.data ?? []).map<SearchHit>((d) => ({
      type: "document",
      id: d.id,
      title: d.title,
      detail: null,
      href: d.product_id ? `/app/products/${d.product_id}` : "/app/documents",
    })),
    ...receipts.map<SearchHit>((r) => ({
      type: "receipt",
      id: r.id,
      title: r.merchant ?? "Comprobante",
      detail: [r.receipt_number, r.purchase_date].filter(Boolean).join(" · ") || null,
      href: `/app/scanner/${r.id}`,
    })),
  ];
}
