import "server-only";

import type { AssistantDataSource, Deadline, ProductSummary, RecordRef, WarrantySummary } from "@orvelia/ai";
import { describeInterval } from "@orvelia/domain";
import { normalizeSearch } from "@orvelia/schemas";
import { todayIn } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type NameRef = { name: string } | { name: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

const days = (today: string, date: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);
const productRef = (id: string, name: string): RecordRef => ({ type: "product", id, label: name });

const PRODUCT_COLS = "id, name, brand, status, purchase_date, purchase_price, currency, receipt_id, categories(name)" as const;

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  status: string;
  purchase_date: string | null;
  purchase_price: number | string | null;
  currency: string | null;
  receipt_id: string | null;
  categories: NameRef;
};

const toSummary = (p: ProductRow): ProductSummary => ({
  ref: productRef(p.id, p.name),
  brand: p.brand,
  status: p.status,
  category: one(p.categories)?.name ?? null,
  purchaseDate: p.purchase_date,
  price: p.purchase_price === null ? null : Number(p.purchase_price),
  currency: p.currency,
  hasReceipt: p.receipt_id !== null,
});

async function categoryIds(supabase: Supabase, userId: string, name: string | undefined) {
  if (!name) return null;
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .or(`user_id.is.null,user_id.eq.${userId}`);
  const target = normalizeSearch(name);
  return (data ?? []).filter((c) => normalizeSearch(c.name).includes(target) || target.includes(normalizeSearch(c.name))).map((c) => c.id);
}

/**
 * Read-only data access for ORVELIA AI. Every query goes through the user's
 * own Supabase session (RLS) and also filters by user_id explicitly.
 */
export async function createAssistantDataSource(userId: string, timeZone: string): Promise<AssistantDataSource> {
  const supabase = await createClient();
  const today = todayIn(timeZone);

  return {
    async search_products({ query, status, category, limit }) {
      let q = supabase.from("products").select(PRODUCT_COLS, { count: "exact" }).eq("user_id", userId);
      const st = status ?? "active";
      if (st !== "all") q = q.eq("status", st);
      if (query) q = q.ilike("search_text", `%${escapeLike(normalizeSearch(query))}%`);
      const cats = await categoryIds(supabase, userId, category);
      if (cats) {
        if (cats.length === 0) return { products: [], total: 0 };
        q = q.in("category_id", cats);
      }
      const { data, count, error } = await q.order("created_at", { ascending: false }).limit(limit ?? 20);
      if (error) throw error;
      return { products: (data ?? []).map((p) => toSummary(p as ProductRow)), total: count ?? 0 };
    },

    async get_product({ id }) {
      const { data: p, error } = await supabase
        .from("products")
        .select(`${PRODUCT_COLS}, model, seller, serial_number, notes`)
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!p) return { product: null };
      const [w, r, d] = await Promise.all([
        supabase.from("warranties").select("kind, provider, end_date, verification_status").eq("user_id", userId).eq("product_id", id),
        supabase.from("return_deadlines").select("id, deadline_date, verification_status").eq("user_id", userId).eq("product_id", id),
        supabase.from("documents").select("id, title").eq("user_id", userId).eq("product_id", id),
      ]);
      const ref = productRef(p.id, p.name);
      return {
        product: {
          ...toSummary(p as ProductRow),
          model: p.model,
          seller: p.seller,
          serialNumber: p.serial_number,
          notes: p.notes,
          warranties: (w.data ?? []).map((x) => ({
            product: ref,
            kind: x.kind,
            provider: x.provider,
            endDate: x.end_date,
            daysLeft: x.end_date ? days(today, x.end_date) : null,
            verification: x.verification_status,
          })),
          returns: (r.data ?? []).map((x) => ({
            kind: "return" as const,
            date: x.deadline_date,
            daysLeft: days(today, x.deadline_date),
            ref,
            verification: x.verification_status,
          })),
          documents: (d.data ?? []).map((x) => ({ type: "document" as const, id: x.id, label: x.title })),
          receipt: p.receipt_id ? { type: "receipt" as const, id: p.receipt_id, label: "Comprobante" } : null,
        },
      };
    },

    async list_warranties({ state, withinDays }) {
      let q = supabase
        .from("warranties")
        .select("kind, provider, end_date, verification_status, product_id, products!warranties_product_fk(name)")
        .eq("user_id", userId);
      if (state === "active") q = q.gte("end_date", today);
      if (state === "expiring") q = q.gte("end_date", today).lte("end_date", addDays(today, withinDays ?? 30));
      if (state === "expired") q = q.lt("end_date", today);
      const { data, error } = await q.order("end_date", { ascending: true, nullsFirst: false }).limit(100);
      if (error) throw error;
      const warranties: WarrantySummary[] = (data ?? []).map((x) => ({
        product: productRef(x.product_id, one(x.products as NameRef)?.name ?? "Producto"),
        kind: x.kind,
        provider: x.provider,
        endDate: x.end_date,
        daysLeft: x.end_date ? days(today, x.end_date) : null,
        verification: x.verification_status,
      }));
      return { warranties };
    },

    async upcoming_deadlines({ days: n }) {
      const to = addDays(today, n);
      const [w, r, d] = await Promise.all([
        supabase
          .from("warranties")
          .select("end_date, verification_status, product_id, products!warranties_product_fk(name)")
          .eq("user_id", userId)
          .gte("end_date", today)
          .lte("end_date", to),
        supabase
          .from("return_deadlines")
          .select("deadline_date, verification_status, product_id, products!return_deadlines_product_fk(name)")
          .eq("user_id", userId)
          .gte("deadline_date", today)
          .lte("deadline_date", to),
        supabase.from("documents").select("id, title, expires_on").eq("user_id", userId).gte("expires_on", today).lte("expires_on", to),
      ]);
      const deadlines: Deadline[] = [
        ...(w.data ?? []).map((x) => ({
          kind: "warranty" as const,
          date: x.end_date!,
          daysLeft: days(today, x.end_date!),
          ref: productRef(x.product_id, one(x.products as NameRef)?.name ?? "Producto"),
          verification: x.verification_status,
        })),
        ...(r.data ?? []).map((x) => ({
          kind: "return" as const,
          date: x.deadline_date,
          daysLeft: days(today, x.deadline_date),
          ref: productRef(x.product_id, one(x.products as NameRef)?.name ?? "Producto"),
          verification: x.verification_status,
        })),
        ...(d.data ?? []).map((x) => ({
          kind: "document" as const,
          date: x.expires_on!,
          daysLeft: days(today, x.expires_on!),
          ref: { type: "document" as const, id: x.id, label: x.title },
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      return { deadlines };
    },

    async spending_summary({ from, to, category, groupBy }) {
      let q = supabase
        .from("products")
        .select("purchase_price, currency, purchase_date, categories(name)")
        .eq("user_id", userId);
      if (from) q = q.gte("purchase_date", from);
      if (to) q = q.lte("purchase_date", to);
      const cats = await categoryIds(supabase, userId, category);
      let categoryName: string | null = null;
      if (cats) {
        if (cats.length === 0) {
          return { period: { from: from ?? null, to: to ?? null }, category: category ?? null, totals: [], groups: [], productsWithoutPrice: 0 };
        }
        q = q.in("category_id", cats);
      }
      const { data, error } = await q.limit(5000);
      if (error) throw error;

      // Sum in integer cents per currency; never convert or mix currencies.
      const totals = new Map<string, { cents: number; count: number }>();
      const groups = new Map<string, { key: string; currency: string; cents: number; count: number }>();
      let withoutPrice = 0;
      for (const row of data ?? []) {
        const cat = one(row.categories as NameRef)?.name ?? null;
        if (cats && cat) categoryName ??= cat;
        if (row.purchase_price === null || !row.currency) {
          withoutPrice++;
          continue;
        }
        const cents = Math.round(Number(row.purchase_price) * 100);
        const t = totals.get(row.currency) ?? { cents: 0, count: 0 };
        totals.set(row.currency, { cents: t.cents + cents, count: t.count + 1 });
        if (groupBy && groupBy !== "none") {
          const key = groupBy === "category" ? (cat ?? "Sin categoría") : (row.purchase_date?.slice(0, 7) ?? "Sin fecha");
          const g = groups.get(`${key}|${row.currency}`) ?? { key, currency: row.currency, cents: 0, count: 0 };
          groups.set(`${key}|${row.currency}`, { ...g, cents: g.cents + cents, count: g.count + 1 });
        }
      }
      return {
        period: { from: from ?? null, to: to ?? null },
        category: categoryName ?? category ?? null,
        totals: [...totals].map(([currency, t]) => ({ currency, amount: t.cents / 100, count: t.count })),
        groups: [...groups.values()].map((g) => ({ key: g.key, currency: g.currency, amount: g.cents / 100, count: g.count })),
        productsWithoutPrice: withoutPrice,
      };
    },

    async products_missing_receipts({ limit }) {
      const { data, count, error } = await supabase
        .from("products")
        .select(PRODUCT_COLS, { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "active")
        .is("receipt_id", null)
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);
      if (error) throw error;
      return { products: (data ?? []).map((p) => toSummary(p as ProductRow)), total: count ?? 0 };
    },

    async recent_purchases({ limit }) {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLS)
        .eq("user_id", userId)
        .not("purchase_date", "is", null)
        .order("purchase_date", { ascending: false })
        .limit(limit ?? 5);
      if (error) throw error;
      return { products: (data ?? []).map((p) => toSummary(p as ProductRow)) };
    },

    async list_reminders({ days: n }) {
      const { data, error } = await supabase
        .from("reminders")
        .select("title, scheduled_at, source, recurrence, product_id, products!reminders_product_fk(name)")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date(Date.now() + n * 86_400_000).toISOString())
        .order("scheduled_at")
        .limit(50);
      if (error) throw error;
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      return {
        reminders: (data ?? []).map((x) => {
          const parts = Object.fromEntries(fmt.formatToParts(new Date(x.scheduled_at)).map((p) => [p.type, p.value]));
          const name = one(x.products as NameRef)?.name;
          return {
            title: x.title,
            localDate: `${parts.year}-${parts.month}-${parts.day}`,
            localTime: `${parts.hour}:${parts.minute}`,
            source: x.source,
            recurrence: x.recurrence,
            product: x.product_id && name ? productRef(x.product_id, name) : null,
          };
        }),
      };
    },

    async list_maintenance({ days: n }) {
      let q = supabase
        .from("maintenance_plans")
        .select("id, title, interval_count, interval_unit, next_due_date, last_done_date, product_id, products!maintenance_plans_product_fk(name)")
        .eq("user_id", userId)
        .eq("active", true)
        .order("next_due_date")
        .limit(50);
      if (n) q = q.lte("next_due_date", todayIn(timeZone, n));
      const { data, error } = await q;
      if (error) throw error;
      const ids = (data ?? []).map((x) => x.id);
      const spent = new Map<string, Map<string, number>>();
      if (ids.length > 0) {
        const { data: logs, error: logError } = await supabase
          .from("maintenance_logs")
          .select("plan_id, cost, currency")
          .eq("user_id", userId)
          .in("plan_id", ids)
          .not("cost", "is", null);
        if (logError) throw logError;
        for (const l of logs ?? []) {
          if (!l.plan_id || l.cost === null || !l.currency) continue;
          const byCur = spent.get(l.plan_id) ?? new Map<string, number>();
          byCur.set(l.currency, Math.round(((byCur.get(l.currency) ?? 0) + Number(l.cost)) * 100) / 100);
          spent.set(l.plan_id, byCur);
        }
      }
      return {
        plans: (data ?? []).flatMap((x) => {
          const name = one(x.products as NameRef)?.name;
          if (!name) return [];
          return [
            {
              product: productRef(x.product_id, name),
              title: x.title,
              every: describeInterval(x.interval_count, x.interval_unit),
              nextDueDate: x.next_due_date,
              daysLeft: days(today, x.next_due_date),
              lastDoneDate: x.last_done_date,
              spent: [...(spent.get(x.id) ?? new Map()).entries()].map(([currency, amount]) => ({ currency, amount })),
            },
          ];
        }),
      };
    },
  };
}
