import { DOCUMENT_TYPES, SUPPORTED_CURRENCIES, WARRANTY_KINDS } from "@orvelia/domain";
import { z } from "zod";
import { parsePrice } from "./product";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const amount = z.string().transform((v, ctx) => {
  const parsed = parsePrice(v);
  if (parsed === undefined) {
    ctx.addIssue({ code: "custom", message: "Escribe un monto válido, por ejemplo 1499.90." });
    return z.NEVER;
  }
  return parsed;
});

const calendarDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))),
    "Fecha no válida.",
  );

const pastDate = calendarDate.refine(
  (v) => v === null || Date.parse(`${v}T00:00:00Z`) <= Date.now() + 86_400_000,
  "La fecha no puede estar en el futuro.",
);

export const receiptConfirmSchema = z
  .object({
    merchant: optionalText(160),
    receiptNumber: optionalText(80),
    purchaseDate: pastDate,
    total: amount,
    tax: amount,
    currency: z.enum(SUPPORTED_CURRENCIES, "Moneda no válida."),
    /** Existing products bought with this receipt. */
    linkProductIds: z.array(z.uuid()).max(20),
    /** New products to create from the receipt's items. */
    newProducts: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Escribe el nombre del producto.").max(160, "Máximo 160 caracteres."),
          price: amount,
        }),
      )
      .max(20, "Máximo 20 productos por comprobante."),
    /**
     * Optional warranty and return window for the products created from this
     * receipt. Every field may be empty: nothing is assumed.
     */
    protection: z
      .object({
        warrantyKind: z.enum(WARRANTY_KINDS, "Tipo no válido.").default("other"),
        warrantyEndDate: calendarDate,
        warrantyProvider: optionalText(160),
        warrantyCoverage: optionalText(4000),
        returnDeadline: calendarDate,
        returnPolicy: optionalText(4000),
      })
      .prefault({ warrantyEndDate: "", warrantyProvider: "", warrantyCoverage: "", returnDeadline: "", returnPolicy: "" }),
  })
  .refine((d) => d.total === null || d.tax === null || Number(d.tax) <= Number(d.total), {
    path: ["tax"],
    message: "El impuesto no puede ser mayor que el total.",
  })
  .refine((d) => !d.purchaseDate || !d.protection.warrantyEndDate || d.protection.warrantyEndDate >= d.purchaseDate, {
    path: ["protection", "warrantyEndDate"],
    message: "La garantía no puede terminar antes de la compra.",
  })
  .refine((d) => !d.purchaseDate || !d.protection.returnDeadline || d.protection.returnDeadline >= d.purchaseDate, {
    path: ["protection", "returnDeadline"],
    message: "El plazo de devolución no puede ser anterior a la compra.",
  });

export type ReceiptConfirmInput = z.input<typeof receiptConfirmSchema>;
export type ReceiptConfirmData = z.output<typeof receiptConfirmSchema>;

export const documentUploadSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título.").max(200, "Máximo 200 caracteres."),
  documentType: z.enum(DOCUMENT_TYPES, "Tipo no válido."),
  productId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable()),
  /** Optional expiry (e.g. warranty certificate, insurance policy); may be in the future. */
  expiresOn: calendarDate,
});
export type DocumentUploadInput = z.input<typeof documentUploadSchema>;
