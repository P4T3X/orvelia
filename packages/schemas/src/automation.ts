import { MAINTENANCE_UNITS, RECURRENCES, SUPPORTED_CURRENCIES, USER_VERIFICATION_STATUSES, WARRANTY_KINDS } from "@orvelia/domain";
import { parsePrice } from "./product";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const isoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || isoDate(v), "Fecha no válida.");

const requiredDate = z.string().trim().min(1, "Elige una fecha.").refine(isoDate, "Fecha no válida.");

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable());

export const warrantyInputSchema = z
  .object({
    kind: z.enum(WARRANTY_KINDS, "Tipo no válido."),
    provider: optionalText(160),
    startDate: optionalDate,
    endDate: optionalDate,
    coverage: optionalText(4000),
    sourceDocumentId: optionalId,
    verification: z.enum(USER_VERIFICATION_STATUSES, "Estado no válido."),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "El fin no puede ser anterior al inicio.",
  });
export type WarrantyInput = z.input<typeof warrantyInputSchema>;

export const returnDeadlineInputSchema = z.object({
  deadlineDate: requiredDate,
  policy: optionalText(4000),
  sourceDocumentId: optionalId,
  verification: z.enum(USER_VERIFICATION_STATUSES, "Estado no válido."),
});
export type ReturnDeadlineInput = z.input<typeof returnDeadlineInputSchema>;

export const reminderInputSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título.").max(160, "Máximo 160 caracteres."),
  description: optionalText(2000),
  date: requiredDate,
  time: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida."),
  productId: optionalId,
  recurrence: z.enum(RECURRENCES, "Repetición no válida."),
  email: z.boolean(),
});
export type ReminderInput = z.input<typeof reminderInputSchema>;

const leads = z
  .array(z.number().int().min(0).max(365))
  .max(5)
  .transform((a) => [...new Set(a)].sort((x, y) => y - x));

export const notificationPrefsSchema = z.object({
  emailEnabled: z.boolean(),
  warrantyLeadDays: leads,
  returnLeadDays: leads,
  documentLeadDays: leads,
});
export type NotificationPrefsInput = z.input<typeof notificationPrefsSchema>;

/** Convert a wall-clock date/time in an IANA zone to a UTC ISO string. */
export function zonedToUtc(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asZone = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asZone - guess)).toISOString();
}

// ---------------------------------------------------------------------------
// Maintenance (Stage 5)
// ---------------------------------------------------------------------------
const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .refine((n) => n >= min && n <= max, message);

export const maintenancePlanSchema = z.object({
  title: z.string().trim().min(1, "Escribe qué mantenimiento es.").max(160, "Máximo 160 caracteres."),
  intervalCount: wholeNumber(1, 365, "Escribe un número entre 1 y 365."),
  intervalUnit: z.enum(MAINTENANCE_UNITS, "Unidad no válida."),
  nextDueDate: requiredDate,
  leadDays: wholeNumber(0, 90, "Entre 0 y 90 días."),
  notes: optionalText(2000),
});
export type MaintenancePlanInput = z.input<typeof maintenancePlanSchema>;
export type MaintenancePlanData = z.output<typeof maintenancePlanSchema>;

const optionalCost = z.string().transform((v, ctx) => {
  const parsed = parsePrice(v);
  if (parsed === undefined) {
    ctx.addIssue({ code: "custom", message: "Escribe un monto válido, por ejemplo 150.00." });
    return z.NEVER;
  }
  return parsed;
});

export const maintenanceDoneSchema = z.object({
  performedOn: requiredDate.refine(
    (v) => Date.parse(`${v}T00:00:00Z`) <= Date.now() + 86_400_000,
    "La fecha no puede estar en el futuro.",
  ),
  cost: optionalCost,
  currency: z.enum(SUPPORTED_CURRENCIES, "Moneda no válida."),
  provider: optionalText(160),
  notes: optionalText(2000),
});
export type MaintenanceDoneInput = z.input<typeof maintenanceDoneSchema>;
