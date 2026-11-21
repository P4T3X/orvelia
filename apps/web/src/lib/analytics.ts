import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Analytics = {
  currency: string;
  today: string;
  totals: { currency: string; total: number; count: number }[];
  byMonth: { month: string; currency: string; total: number; count: number }[];
  byCategory: { category: string; count: number; total: number | null }[];
  byStatus: Record<string, number>;
  coverage: { activeProducts: number; withActiveWarranty: number; withExpiredOnly: number; withReceipt: number; withDocuments: number };
  upcoming: { warranties90: number; returns30: number; documents90: number };
  documentsByType: Record<string, number>;
  oldestActive: { name: string; purchaseDate: string } | null;
};

type Raw = Record<string, unknown>;
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** null = the caller's plan does not include advanced analytics. */
export async function getAnalytics(): Promise<Analytics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_overview");
  if (error) {
    if (error.message.includes("analytics_not_included")) return null;
    throw new Error(`No se pudo cargar el análisis: ${error.message}`);
  }
  const o = (data ?? {}) as Raw;
  const c = (o.coverage ?? {}) as Raw;
  const u = (o.upcoming ?? {}) as Raw;
  const oldest = o.oldest_active as Raw | null;
  return {
    currency: String(o.currency ?? "PEN"),
    today: String(o.today),
    totals: ((o.totals as Raw[]) ?? []).map((t) => ({ currency: String(t.currency), total: n(t.total), count: n(t.count) })),
    byMonth: ((o.by_month as Raw[]) ?? []).map((m) => ({ month: String(m.month), currency: String(m.currency), total: n(m.total), count: n(m.count) })),
    byCategory: ((o.by_category as Raw[]) ?? []).map((k) => ({
      category: String(k.category),
      count: n(k.count),
      total: k.total === null || k.total === undefined ? null : Number(k.total),
    })),
    byStatus: Object.fromEntries(Object.entries((o.by_status as Raw) ?? {}).map(([k, v]) => [k, n(v)])),
    coverage: {
      activeProducts: n(c.active_products),
      withActiveWarranty: n(c.with_active_warranty),
      withExpiredOnly: n(c.with_expired_warranty_only),
      withReceipt: n(c.with_receipt),
      withDocuments: n(c.with_documents),
    },
    upcoming: { warranties90: n(u.warranties_90), returns30: n(u.returns_30), documents90: n(u.documents_90) },
    documentsByType: Object.fromEntries(Object.entries((o.documents_by_type as Raw) ?? {}).map(([k, v]) => [k, n(v)])),
    oldestActive: oldest ? { name: String(oldest.name), purchaseDate: String(oldest.purchase_date) } : null,
  };
}

/** The last 12 calendar months ending with `today`'s month, as YYYY-MM. */
export function lastTwelveMonths(today: string): string[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
