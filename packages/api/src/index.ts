/**
 * Shared data access for ORVELIA clients (web and mobile).
 *
 * Every function takes the caller's own Supabase client, so Row Level Security
 * decides what each person can read or write; the explicit `user_id` filters
 * are defense in depth and match the indexes.
 */
import type { ProductStatus } from "@orvelia/domain";
import { normalizeSearch, type ProductData } from "@orvelia/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database } from "./database.types";
export * from "./format";
export type Db = SupabaseClient<Database>;

export const STORAGE_BUCKET = "user-files";
export const SIGNED_URL_TTL_SECONDS = 600;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for "today" (plus an offset) in a time zone. */
export function todayIn(timeZone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative when past. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** "Hoy", "Mañana", "En 5 días", "Hace 2 días". */
export function relativeDays(date: string, today: string): string {
  const d = daysUntil(date, today);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  return d > 0 ? `En ${d} días` : `Hace ${-d} días`;
}

// ---------------------------------------------------------------------------
// Products: writes
// ---------------------------------------------------------------------------

/** Validated product input → products row (used by web actions and the mobile app). */
export function productToRow(d: ProductData) {
  return {
    name: d.name,
    brand: d.brand,
    model: d.model,
    category_id: d.categoryId,
    description: d.description,
    notes: d.notes,
    purchase_date: d.purchaseDate,
    purchase_price: d.purchasePrice,
    // A currency is only meaningful (and required by the DB) when there is a price.
    currency: d.purchasePrice === null ? null : d.currency,
    seller: d.seller,
    serial_number: d.serialNumber,
    status: d.status,
  };
}

/** Database error → user-facing Spanish copy for product writes. */
export function productErrorMessage(error: { code?: string; message: string }): string {
  if (error.message.includes("product_limit_reached")) {
    return "Llegaste al límite de productos de tu plan. Elimina alguno o pasa a Plus para tener productos ilimitados.";
  }
  if (error.code === "42501") return "La categoría elegida no está disponible.";
  if (error.code === "23503") return "La categoría elegida ya no existe.";
  return "No pudimos guardar el producto. Inténtalo de nuevo.";
}

export async function createProduct(db: Db, userId: string, d: ProductData): Promise<{ id: string } | { error: string }> {
  const { data, error } = await db.from("products").insert({ ...productToRow(d), user_id: userId }).select("id").single();
  if (error || !data) return { error: productErrorMessage(error ?? { message: "" }) };
  return { id: data.id };
}

/** YYYY-MM-DD plus whole months, clamped to the end of shorter months (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Quick warranty from a duration (the mobile "12 meses" shortcut). Reminders are created by the database. */
export async function addWarranty(db: Db, userId: string, productId: string, w: { startDate: string; months: number; provider?: string | null }) {
  if (!Number.isInteger(w.months) || w.months < 1 || w.months > 120) return { error: "Duración no válida." };
  const { error } = await db.from("warranties").insert({
    user_id: userId,
    product_id: productId,
    start_date: w.startDate,
    end_date: addMonths(w.startDate, w.months),
    kind: "manufacturer",
    provider: w.provider?.trim() || null,
    coverage_description: null,
    source_document_id: null,
    verification_status: "manual",
  });
  return error ? { error: "No pudimos guardar la garantía." } : { ok: true as const };
}

export async function updateProductStatus(db: Db, userId: string, id: string, status: ProductStatus) {
  const { error } = await db.from("products").update({ status }).eq("id", id).eq("user_id", userId);
  return error ? { error: "No pudimos cambiar el estado." } : { ok: true as const };
}

// ---------------------------------------------------------------------------
// Products: reads
// ---------------------------------------------------------------------------

export type ProductListItem = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: ProductStatus;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currency: string | null;
  categoryName: string | null;
  imagePath: string | null;
  imageUrl: string | null;
};

type NameRef = { name: string } | { name: string }[] | null;
const nameOf = (p: NameRef) => (Array.isArray(p) ? p[0]?.name : p?.name) ?? null;
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Short-lived signed URLs for private files, keyed by path. */
export async function signPaths(db: Db, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data } = await db.storage.from(STORAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}

export async function listProducts(
  db: Db,
  userId: string,
  opts: { search?: string; status?: ProductStatus | "all"; limit?: number; offset?: number } = {},
): Promise<{ items: ProductListItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 30, 100);
  const offset = opts.offset ?? 0;
  let q = db
    .from("products")
    .select("id, name, brand, model, status, purchase_date, purchase_price, currency, image_path, categories(name)", { count: "exact" })
    .eq("user_id", userId);
  const status = opts.status ?? "active";
  if (status !== "all") q = q.eq("status", status);
  const term = opts.search ? normalizeSearch(opts.search) : "";
  if (term) q = q.ilike("search_text", `%${escapeLike(term)}%`);
  const { data, count, error } = await q.order("created_at", { ascending: false }).order("id").range(offset, offset + limit - 1);
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  const rows = data ?? [];
  const urls = await signPaths(db, rows.map((r) => r.image_path).filter((p): p is string => Boolean(p)));
  return {
    total: count ?? 0,
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      model: r.model,
      status: r.status,
      purchaseDate: r.purchase_date,
      purchasePrice: r.purchase_price === null ? null : Number(r.purchase_price),
      currency: r.currency,
      categoryName: nameOf(r.categories as NameRef),
      imagePath: r.image_path,
      imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
    })),
  };
}

export type ProductDetail = ProductListItem & {
  description: string | null;
  notes: string | null;
  seller: string | null;
  serialNumber: string | null;
  receipt: { id: string; merchant: string | null; purchaseDate: string | null; total: number | null; currency: string | null } | null;
  warranties: { id: string; provider: string | null; endDate: string | null; verification: string }[];
  returns: { id: string; deadlineDate: string; verification: string }[];
  documents: { id: string; title: string; documentType: string; expiresOn: string | null }[];
};

export async function getProduct(db: Db, userId: string, id: string): Promise<ProductDetail | null> {
  const { data: r, error } = await db
    .from("products")
    .select(
      "id, name, brand, model, status, purchase_date, purchase_price, currency, image_path, description, notes, seller, serial_number, receipt_id, categories(name)",
    )
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  if (!r) return null;
  const [w, ret, docs, receipt, urls] = await Promise.all([
    db.from("warranties").select("id, provider, end_date, verification_status").eq("user_id", userId).eq("product_id", id).order("end_date"),
    db.from("return_deadlines").select("id, deadline_date, verification_status").eq("user_id", userId).eq("product_id", id).order("deadline_date"),
    db.from("documents").select("id, title, document_type, expires_on").eq("user_id", userId).eq("product_id", id).order("created_at", { ascending: false }),
    r.receipt_id
      ? db.from("receipts").select("id, merchant, purchase_date, total_amount, currency").eq("user_id", userId).eq("id", r.receipt_id).maybeSingle()
      : Promise.resolve({ data: null }),
    r.image_path ? signPaths(db, [r.image_path]) : Promise.resolve(new Map<string, string>()),
  ]);
  const rc = receipt.data;
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    status: r.status,
    purchaseDate: r.purchase_date,
    purchasePrice: r.purchase_price === null ? null : Number(r.purchase_price),
    currency: r.currency,
    categoryName: nameOf(r.categories as NameRef),
    imagePath: r.image_path,
    imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
    description: r.description,
    notes: r.notes,
    seller: r.seller,
    serialNumber: r.serial_number,
    receipt: rc
      ? { id: rc.id, merchant: rc.merchant, purchaseDate: rc.purchase_date, total: rc.total_amount === null ? null : Number(rc.total_amount), currency: rc.currency }
      : null,
    warranties: (w.data ?? []).map((x) => ({ id: x.id, provider: x.provider, endDate: x.end_date, verification: x.verification_status })),
    returns: (ret.data ?? []).map((x) => ({ id: x.id, deadlineDate: x.deadline_date, verification: x.verification_status })),
    documents: (docs.data ?? []).map((x) => ({ id: x.id, title: x.title, documentType: x.document_type, expiresOn: x.expires_on })),
  };
}

export type Category = { id: string; name: string; own: boolean };

export async function listCategories(db: Db, userId: string): Promise<Category[]> {
  const { data, error } = await db.from("categories").select("id, name, user_id").order("name");
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, own: c.user_id === userId }));
}

// ---------------------------------------------------------------------------
// What's coming up (home and calendar)
// ---------------------------------------------------------------------------

export type UpcomingItem = {
  key: string;
  kind: "warranty" | "return" | "document" | "reminder";
  date: string;
  title: string;
  productId: string | null;
  productName: string | null;
  /** Owner's name when the date comes from a product a family member shares. */
  sharedBy?: string;
};

/** Dates between today and `days` ahead: own warranties, returns, documents, custom reminders, and family-shared dates. */
export async function listUpcoming(db: Db, userId: string, today: string, days = 90, timeZone = "America/Lima"): Promise<UpcomingItem[]> {
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const [w, r, d, m, fam] = await Promise.all([
    db.from("warranties").select("id, end_date, product_id, products!warranties_product_fk(name)").eq("user_id", userId).gte("end_date", today).lte("end_date", horizon),
    db.from("return_deadlines").select("id, deadline_date, product_id, products!return_deadlines_product_fk(name)").eq("user_id", userId).gte("deadline_date", today).lte("deadline_date", horizon),
    db.from("documents").select("id, title, expires_on, product_id").eq("user_id", userId).gte("expires_on", today).lte("expires_on", horizon),
    db.from("reminders").select("id, title, scheduled_at, product_id").eq("user_id", userId).eq("source", "custom").eq("status", "scheduled")
      .gte("scheduled_at", `${today}T00:00:00Z`).lte("scheduled_at", `${horizon}T23:59:59Z`),
    db.rpc("family_shared_events", { p_from: today, p_to: horizon }),
  ]);
  const err = w.error ?? r.error ?? d.error ?? m.error;
  if (err) throw new Error(`No se pudieron cargar los vencimientos: ${err.message}`);
  const localDate = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const items: UpcomingItem[] = [
    ...(w.data ?? []).map((x) => ({ key: `w-${x.id}`, kind: "warranty" as const, date: x.end_date!, title: "Vence la garantía", productId: x.product_id, productName: nameOf(x.products as NameRef) })),
    ...(r.data ?? []).map((x) => ({ key: `r-${x.id}`, kind: "return" as const, date: x.deadline_date, title: "Último día para devolver", productId: x.product_id, productName: nameOf(x.products as NameRef) })),
    ...(d.data ?? []).map((x) => ({ key: `d-${x.id}`, kind: "document" as const, date: x.expires_on!, title: `Vence: ${x.title}`, productId: x.product_id, productName: null })),
    ...(m.data ?? []).map((x) => ({ key: `m-${x.id}`, kind: "reminder" as const, date: localDate(x.scheduled_at), title: x.title, productId: x.product_id, productName: null })),
    // Family dates are optional: a missing family (or migration) just means none.
    ...(fam.error ? [] : (fam.data ?? [])).map((x, i) => ({
      key: `f-${x.kind}-${x.product_id}-${i}`,
      kind: x.kind,
      date: x.event_date,
      title: x.kind === "warranty" ? "Vence la garantía" : x.kind === "return" ? "Último día para devolver" : x.title,
      productId: x.product_id,
      productName: x.product_name,
      sharedBy: x.owner_name ?? "Familia",
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

export type HomeSummary = { activeProducts: number; activeWarranties: number; plan: "free" | "plus" | "ultra" };

export async function getHomeSummary(db: Db, userId: string, today: string): Promise<HomeSummary> {
  const [p, w, plan] = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    db.from("warranties").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("end_date", today),
    db.rpc("billing_overview"),
  ]);
  return { activeProducts: p.count ?? 0, activeWarranties: w.count ?? 0, plan: plan.data?.[0]?.effective_plan ?? "free" };
}

// ---------------------------------------------------------------------------
// Notifications and push
// ---------------------------------------------------------------------------

export type NotificationItem = { id: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export async function listNotifications(db: Db, userId: string, limit = 50): Promise<NotificationItem[]> {
  const { data, error } = await db
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`No se pudieron cargar los avisos: ${error.message}`);
  return (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, readAt: n.read_at, createdAt: n.created_at }));
}

export async function markNotificationsRead(db: Db, userId: string, ids?: string[]) {
  let q = db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
}

export async function registerPushToken(db: Db, token: string, platform: "ios" | "android", deviceName?: string | null) {
  const { error } = await db.rpc("register_push_token", { p_token: token, p_platform: platform, p_device_name: deviceName ?? null });
  if (error) throw new Error(`No se pudo registrar el dispositivo: ${error.message}`);
}

export async function unregisterPushToken(db: Db, token: string) {
  await db.from("push_tokens").delete().eq("token", token);
}

export async function getPushEnabled(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from("notification_preferences").select("push_enabled").eq("user_id", userId).maybeSingle();
  return data?.push_enabled ?? true;
}

export async function setPushEnabled(db: Db, userId: string, enabled: boolean) {
  const { data } = await db.from("notification_preferences").select("user_id").eq("user_id", userId).maybeSingle();
  const { error } = data
    ? await db.from("notification_preferences").update({ push_enabled: enabled }).eq("user_id", userId)
    : await db.from("notification_preferences").insert({
        user_id: userId,
        push_enabled: enabled,
        email_enabled: true,
        warranty_lead_days: [30, 7],
        return_lead_days: [3, 1],
        document_lead_days: [30, 7],
      });
  if (error) throw new Error("No se pudo guardar la preferencia.");
}

// ---------------------------------------------------------------------------
// Family (read-only sharing)
// ---------------------------------------------------------------------------

export type SharedProductItem = { productId: string; name: string; ownerName: string; isMine: boolean; warrantyEnd: string | null };

export async function listSharedProducts(db: Db): Promise<SharedProductItem[]> {
  const { data, error } = await db.rpc("family_shared_products");
  if (error) return [];
  return (data ?? []).map((r) => ({
    productId: r.product_id,
    name: r.name,
    ownerName: r.owner_name ?? "Miembro",
    isMine: r.is_mine,
    warrantyEnd: r.warranty_end,
  }));
}
