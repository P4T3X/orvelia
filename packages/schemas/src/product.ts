import { PRODUCT_STATUSES, SUPPORTED_CURRENCIES } from "@orvelia/domain";
import { z } from "zod";

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((v) => (v === "" ? null : v));

const uuid = z.uuid("Valor no válido.");

/**
 * Parses a user-typed price: "8499", "8499.9", "8 499,90", "8,499.90".
 * Returns a string with exactly 2 decimals (sent as-is to a numeric column),
 * or null when empty.
 */
export function parsePrice(raw: string): string | null | undefined {
  let v = raw.trim().replace(/\s/g, "").replace(/^S\/|^\$|^€/i, "");
  if (v === "") return null;
  if (v.includes(",") && v.includes(".")) v = v.replace(/,/g, "");
  else if (v.includes(",")) v = v.replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(v)) return undefined;
  return Number(v).toFixed(2);
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date in YYYY-MM-DD, valid, not before 1900 and at most 1 day ahead (time zones). */
const purchaseDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (isoDate.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Fecha no válida.")
  .refine((v) => v === null || v >= "1900-01-01", "Fecha no válida.")
  .refine(
    (v) => v === null || Date.parse(`${v}T00:00:00Z`) <= Date.now() + 86_400_000,
    "La fecha de compra no puede estar en el futuro.",
  );

export const productInputSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre del producto.").max(160, "Máximo 160 caracteres."),
    brand: optionalText(80, "Máximo 80 caracteres."),
    model: optionalText(80, "Máximo 80 caracteres."),
    categoryId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(uuid.nullable()),
    description: optionalText(4000, "Máximo 4000 caracteres."),
    notes: optionalText(4000, "Máximo 4000 caracteres."),
    purchaseDate,
    purchasePrice: z.string().transform((v, ctx) => {
      const parsed = parsePrice(v);
      if (parsed === undefined) {
        ctx.addIssue({ code: "custom", message: "Escribe un monto válido, por ejemplo 1499.90." });
        return z.NEVER;
      }
      return parsed;
    }),
    currency: z.enum(SUPPORTED_CURRENCIES, "Moneda no válida."),
    seller: optionalText(160, "Máximo 160 caracteres."),
    serialNumber: optionalText(120, "Máximo 120 caracteres."),
    status: z.enum(PRODUCT_STATUSES, "Estado no válido."),
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

export const productStatusUpdateSchema = z.object({
  id: uuid,
  status: z.enum(PRODUCT_STATUSES, "Estado no válido."),
});

export const PRODUCT_SORTS = ["recent", "name", "purchase_date", "purchase_date_asc", "price", "price_asc", "warranty_end"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const PRODUCT_PAGE_SIZE = 24;
export const PRODUCT_COVERAGES = ["active", "expired", "none"] as const;
export type ProductCoverage = (typeof PRODUCT_COVERAGES)[number];

/** Normalizes a search term the same way the DB `search_text` column does. */
export function normalizeSearch(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** URL search params for the collection page. Invalid values fall back to defaults. */
export const productFiltersSchema = z.object({
  q: z
    .string()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? normalizeSearch(v) : undefined) || undefined),
  status: z.enum([...PRODUCT_STATUSES, "all"]).optional().catch(undefined),
  category: uuid.optional().catch(undefined),
  sort: z.enum(PRODUCT_SORTS).optional().catch(undefined),
  /** Exact brand (case-insensitive), as listed in the brand filter. */
  brand: z
    .string()
    .trim()
    .max(80)
    .optional()
    .catch(undefined)
    .transform((v) => v || undefined),
  /** Warranty coverage: in force today, all expired, or none registered. */
  coverage: z.enum(PRODUCT_COVERAGES).optional().catch(undefined),
  view: z.enum(["grid", "list"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type ProductFilters = z.output<typeof productFiltersSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre.").max(60, "Máximo 60 caracteres."),
});

/** Product images: browser-displayable formats only. */
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
