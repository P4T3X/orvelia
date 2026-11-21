import "server-only";

import { PRODUCT_PAGE_SIZE, type ProductFilters } from "@orvelia/schemas";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const STORAGE_BUCKET = "user-files";
/** Signed URLs for private images live 10 minutes. */
export const SIGNED_URL_TTL_SECONDS = 600;

export type Category = { id: string; name: string; icon: string | null; own: boolean };

export type ProductListItem = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: "active" | "sold" | "gifted" | "archived" | "disposed";
  purchaseDate: string | null;
  purchasePrice: number | null;
  currency: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  /** Warranty summary for cards (from product_overview; absent on the detail page). */
  warrantyCount?: number;
  warrantyEnd?: string | null;
  nextReturnDeadline?: string | null;
};

export type ProductDetail = ProductListItem & {
  categoryId: string | null;
  description: string | null;
  notes: string | null;
  seller: string | null;
  serialNumber: string | null;
  imagePath: string | null;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
};

type CategoryRef = { name: string } | { name: string }[] | null;
const categoryName = (c: CategoryRef) => (Array.isArray(c) ? c[0]?.name : c?.name) ?? null;

export const listCategories = cache(async (userId: string): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, user_id")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("name");
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, icon: c.icon, own: c.user_id !== null }));
});

export const getProductUsage = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("product_usage");
  if (error) throw new Error(`No se pudo calcular el uso del plan: ${error.message}`);
  const row = data?.[0];
  return {
    used: row?.used ?? 0,
    max: row?.max_products ?? null,
    plan: row?.plan ?? "free",
    atLimit: row?.max_products != null && (row?.used ?? 0) >= row.max_products,
  };
});

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Escape LIKE wildcards in user input. */
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * One page of the collection from `product_overview` (security_invoker view:
 * products/warranties RLS applies). Filters and sort run in the database.
 */
export async function listProducts(userId: string, filters: ProductFilters, today: string) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const from = (page - 1) * PRODUCT_PAGE_SIZE;
  const status = filters.status ?? "active";

  let query = supabase
    .from("product_overview")
    .select(
      "id, name, brand, model, status, purchase_date, purchase_price, currency, image_path, category_name, warranty_count, warranty_end, next_return_deadline",
      { count: "exact" },
    )
    .eq("user_id", userId);

  if (status !== "all") query = query.eq("status", status);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.brand) query = query.ilike("brand", escapeLike(filters.brand));
  if (filters.q) query = query.ilike("search_text", `%${escapeLike(filters.q)}%`);
  if (filters.coverage === "active") query = query.gte("warranty_end", today);
  if (filters.coverage === "expired") query = query.lt("warranty_end", today);
  if (filters.coverage === "none") query = query.eq("warranty_count", 0);

  switch (filters.sort ?? "recent") {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "purchase_date":
      query = query.order("purchase_date", { ascending: false, nullsFirst: false });
      break;
    case "purchase_date_asc":
      query = query.order("purchase_date", { ascending: true, nullsFirst: false });
      break;
    case "price":
      query = query.order("purchase_price", { ascending: false, nullsFirst: false });
      break;
    case "price_asc":
      query = query.order("purchase_price", { ascending: true, nullsFirst: false });
      break;
    case "warranty_end":
      // Soonest-ending coverage first; expired and uncovered products go last.
      query = query.order("warranty_end", { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.order("id").range(from, from + PRODUCT_PAGE_SIZE - 1);
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);

  let rows = data ?? [];
  // Expired coverage sorts after coverage in force (a single ORDER BY can't express "today" relative order).
  if ((filters.sort ?? "recent") === "warranty_end") {
    rows = [...rows].sort((a, b) => rank(a.warranty_end, today) - rank(b.warranty_end, today));
  }
  const urls = await signPaths(rows.map((r) => r.image_path).filter((p): p is string => Boolean(p)));

  const items: ProductListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    status: r.status,
    purchaseDate: r.purchase_date,
    purchasePrice: r.purchase_price === null ? null : Number(r.purchase_price),
    currency: r.currency,
    categoryName: r.category_name,
    imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
    warrantyCount: r.warranty_count ?? 0,
    warrantyEnd: r.warranty_end,
    nextReturnDeadline: r.next_return_deadline,
  }));

  const total = count ?? 0;
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)), status };
}

/** 0 = covered (keeps DB order: soonest first), 1 = expired, 2 = none. Stable sort keeps the rest. */
function rank(end: string | null | undefined, today: string) {
  if (!end) return 2;
  return end >= today ? 0 : 1;
}

/** Distinct brands in the user's collection, for the brand filter. */
export const listBrands = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("brand").eq("user_id", userId).not("brand", "is", null).limit(2000);
  if (error) return [];
  const seen = new Map<string, string>();
  for (const r of data ?? []) {
    const b = r.brand?.trim();
    if (b && !seen.has(b.toLowerCase())) seen.set(b.toLowerCase(), b);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
});

export async function getProduct(userId: string, id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, model, status, category_id, description, notes, purchase_date, purchase_price, currency, seller, serial_number, image_path, receipt_id, created_at, updated_at, categories(name)",
    )
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  if (!r) return null;

  const urls = r.image_path ? await signPaths([r.image_path]) : new Map<string, string>();

  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    status: r.status,
    categoryId: r.category_id,
    categoryName: categoryName(r.categories as CategoryRef),
    description: r.description,
    notes: r.notes,
    purchaseDate: r.purchase_date,
    purchasePrice: r.purchase_price === null ? null : Number(r.purchase_price),
    currency: r.currency,
    seller: r.seller,
    serialNumber: r.serial_number,
    imagePath: r.image_path,
    receiptId: r.receipt_id,
    imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
