/**
 * Product lifecycle statuses. Must stay in sync with the `product_status`
 * enum in supabase/migrations.
 */
export const PRODUCT_STATUSES = [
  "active",
  "sold",
  "gifted",
  "archived",
  "disposed",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Activo",
  sold: "Vendido",
  gifted: "Regalado",
  archived: "Archivado",
  disposed: "Desechado",
};

/** ISO 4217 currencies offered in the UI. PEN first for the initial market. */
export const SUPPORTED_CURRENCIES = ["PEN", "USD", "EUR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_LANGUAGES = ["es", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
