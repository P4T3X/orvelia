import { z } from "zod";

/**
 * What we ask the model to return. Deliberately lenient (strings, nullables):
 * the model's output is untrusted and goes through `sanitizeReceipt` before
 * anyone sees it. Descriptions double as instructions for the model.
 */
export const rawReceiptSchema = z.object({
  isPurchaseDocument: z
    .boolean()
    .describe("true only if the document is a purchase receipt, ticket, boleta, factura or invoice."),
  documentKind: z
    .enum(["boleta", "factura", "ticket", "invoice", "other"])
    .nullable()
    .describe("Kind of purchase document, or null if it cannot be determined."),
  merchant: z.string().nullable().describe("Store or seller name exactly as printed. null if not printed."),
  merchantTaxId: z.string().nullable().describe("Seller tax id (RUC in Peru) as printed. null if not printed."),
  receiptNumber: z
    .string()
    .nullable()
    .describe("Receipt/invoice number as printed, e.g. B001-004521 or F002-000123. null if not printed."),
  purchaseDate: z
    .string()
    .nullable()
    .describe("Issue/purchase date as YYYY-MM-DD. null if not printed or ambiguous."),
  currency: z
    .string()
    .nullable()
    .describe('ISO 4217 code. "S/" or "soles" = PEN, "US$" = USD, "€" = EUR. null if not printed.'),
  total: z.number().nullable().describe("Total amount paid, as a number with dot decimals. null if not printed."),
  tax: z.number().nullable().describe("Tax amount (IGV/VAT) as printed. null if not printed."),
  items: z
    .array(
      z.object({
        description: z.string().describe("Item description as printed."),
        quantity: z.number().nullable().describe("Quantity if printed, else null."),
        amount: z.number().nullable().describe("Line total if printed, else null."),
      }),
    )
    .describe("Purchased items as printed. Empty array if none are legible."),
});
export type RawReceipt = z.infer<typeof rawReceiptSchema>;

export type ReceiptItem = { description: string; quantity: number | null; amount: number | null };

/** Validated extraction. Every value is either what the document shows or null. */
export type ReceiptExtraction = {
  documentKind: RawReceipt["documentKind"];
  merchant: string | null;
  merchantTaxId: string | null;
  receiptNumber: string | null;
  purchaseDate: string | null;
  currency: string | null;
  total: number | null;
  tax: number | null;
  items: ReceiptItem[];
};

export type ExtractionWarning =
  | "not_a_receipt"
  | "invalid_date"
  | "future_date"
  | "unknown_currency"
  | "invalid_amount"
  | "items_total_mismatch"
  | "tax_exceeds_total"
  | "nothing_found";

export const WARNING_MESSAGES: Record<ExtractionWarning, string> = {
  not_a_receipt: "El archivo no parece un comprobante de compra.",
  invalid_date: "La fecha leída no es válida; complétala a mano.",
  future_date: "La fecha leída está en el futuro; revísala.",
  unknown_currency: "No pudimos identificar la moneda; elígela a mano.",
  invalid_amount: "Algún monto leído no era válido y se dejó vacío.",
  items_total_mismatch: "La suma de los productos no coincide con el total; revisa los montos.",
  tax_exceeds_total: "El impuesto leído es mayor que el total; revísalo.",
  nothing_found: "No encontramos datos legibles en el archivo.",
};

const CURRENCY_ALIASES: Record<string, string> = {
  "S/": "PEN",
  "S/.": "PEN",
  SOLES: "PEN",
  SOL: "PEN",
  PEN: "PEN",
  "US$": "USD",
  USD: "USD",
  DOLARES: "USD",
  "DÓLARES": "USD",
  EUR: "EUR",
  "€": "EUR",
};

const text = (v: string | null, max: number) => {
  const t = v?.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

const money = (v: number | null, warnings: Set<ExtractionWarning>) => {
  if (v === null) return null;
  if (!Number.isFinite(v) || v < 0 || v > 1e12) {
    warnings.add("invalid_amount");
    return null;
  }
  return Math.round(v * 100) / 100;
};

/**
 * Deterministic post-processing of model output. Never fills a missing value;
 * only normalizes formats and drops values that are impossible.
 * `today` is YYYY-MM-DD in the user's time zone.
 */
export function sanitizeReceipt(raw: RawReceipt, today: string): { data: ReceiptExtraction; warnings: ExtractionWarning[] } {
  const warnings = new Set<ExtractionWarning>();
  if (!raw.isPurchaseDocument) warnings.add("not_a_receipt");

  let purchaseDate = text(raw.purchaseDate, 10);
  if (purchaseDate) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) && !Number.isNaN(Date.parse(`${purchaseDate}T00:00:00Z`));
    const roundTrips = valid && new Date(`${purchaseDate}T00:00:00Z`).toISOString().slice(0, 10) === purchaseDate;
    if (!valid || !roundTrips || purchaseDate < "1990-01-01") {
      warnings.add("invalid_date");
      purchaseDate = null;
    } else if (purchaseDate > today) {
      warnings.add("future_date");
      purchaseDate = null;
    }
  }

  let currency: string | null = null;
  const rawCurrency = text(raw.currency, 12)?.toUpperCase();
  if (rawCurrency) {
    currency = CURRENCY_ALIASES[rawCurrency] ?? (/^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : null);
    if (!currency) warnings.add("unknown_currency");
  }

  const total = money(raw.total, warnings);
  const tax = money(raw.tax, warnings);
  if (total !== null && tax !== null && tax > total) warnings.add("tax_exceeds_total");

  const items: ReceiptItem[] = raw.items
    .map((i) => ({
      description: text(i.description, 160) ?? "",
      quantity: i.quantity !== null && Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : null,
      amount: money(i.amount, warnings),
    }))
    .filter((i) => i.description.length > 0)
    .slice(0, 50);

  const itemAmounts = items.map((i) => i.amount).filter((a): a is number => a !== null);
  if (total !== null && itemAmounts.length === items.length && items.length > 0) {
    const sum = itemAmounts.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - total) > Math.max(0.05, total * 0.01)) warnings.add("items_total_mismatch");
  }

  const data: ReceiptExtraction = {
    documentKind: raw.documentKind,
    merchant: text(raw.merchant, 160),
    merchantTaxId: text(raw.merchantTaxId, 20),
    receiptNumber: text(raw.receiptNumber, 80),
    purchaseDate,
    currency,
    total,
    tax,
    items,
  };

  const empty = !data.merchant && !data.receiptNumber && !data.purchaseDate && data.total === null && items.length === 0;
  if (empty) warnings.add("nothing_found");

  return { data, warnings: [...warnings] };
}
