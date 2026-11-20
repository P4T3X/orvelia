import "server-only";

import { createClient } from "@/lib/supabase/server";

export type UpcomingItem = {
  id: string;
  kind: "warranty" | "return";
  date: string; // YYYY-MM-DD
  productId: string;
  productName: string;
  verification: string;
};

export type DashboardData = {
  activeProducts: number;
  activeWarranties: number;
  upcomingCount: number;
  receipts: number;
  upcoming: UpcomingItem[];
  plan: "free" | "plus" | "ultra";
};

/** YYYY-MM-DD for "today" in the user's time zone. */
export function todayIn(timeZone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const UPCOMING_WINDOW_DAYS = 30;

type ProductRef = { name: string } | { name: string }[] | null;
const nameOf = (p: ProductRef) => (Array.isArray(p) ? p[0]?.name : p?.name) ?? "Producto";

/**
 * All counts are real queries. RLS already scopes rows to the user; the
 * explicit user_id filter is defense in depth and matches the indexes.
 */
export async function getDashboardData(userId: string, timeZone: string): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayIn(timeZone);
  const horizon = todayIn(timeZone, UPCOMING_WINDOW_DAYS);

  const [products, warranties, receipts, upcomingWarranties, upcomingReturns, subscription] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    supabase.from("warranties").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("end_date", today),
    supabase.from("receipts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("warranties")
      .select("id, end_date, product_id, verification_status, products!warranties_product_fk(name)")
      .eq("user_id", userId)
      .gte("end_date", today)
      .lte("end_date", horizon)
      .order("end_date")
      .limit(10),
    supabase
      .from("return_deadlines")
      .select("id, deadline_date, product_id, verification_status, products!return_deadlines_product_fk(name)")
      .eq("user_id", userId)
      .gte("deadline_date", today)
      .lte("deadline_date", horizon)
      .order("deadline_date")
      .limit(10),
    supabase.from("subscriptions").select("plan").eq("user_id", userId).maybeSingle(),
  ]);

  const firstError = [products, warranties, receipts, upcomingWarranties, upcomingReturns, subscription].find(
    (r) => r.error,
  )?.error;
  if (firstError) throw new Error(`No se pudo cargar el panel: ${firstError.message}`);

  const upcoming: UpcomingItem[] = [
    ...(upcomingWarranties.data ?? []).map((w) => ({
      id: w.id,
      kind: "warranty" as const,
      date: w.end_date as string,
      productId: w.product_id,
      productName: nameOf(w.products as ProductRef),
      verification: w.verification_status,
    })),
    ...(upcomingReturns.data ?? []).map((r) => ({
      id: r.id,
      kind: "return" as const,
      date: r.deadline_date,
      productId: r.product_id,
      productName: nameOf(r.products as ProductRef),
      verification: r.verification_status,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    activeProducts: products.count ?? 0,
    activeWarranties: warranties.count ?? 0,
    receipts: receipts.count ?? 0,
    upcomingCount: upcoming.length,
    upcoming: upcoming.slice(0, 8),
    plan: subscription.data?.plan ?? "free",
  };
}
