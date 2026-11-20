export const WARRANTY_KINDS = ["manufacturer", "store", "extended", "other"] as const;
export type WarrantyKind = (typeof WARRANTY_KINDS)[number];
export const WARRANTY_KIND_LABELS: Record<WarrantyKind, string> = {
  manufacturer: "Del fabricante",
  store: "De la tienda",
  extended: "Extendida",
  other: "Otra",
};

export const RECURRENCES = ["none", "monthly", "quarterly", "semiannual", "yearly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Una sola vez",
  monthly: "Cada mes",
  quarterly: "Cada 3 meses",
  semiannual: "Cada 6 meses",
  yearly: "Cada año",
};

export const REMINDER_SOURCE_LABELS = {
  warranty: "Garantía",
  return: "Devolución",
  document: "Documento",
  custom: "Recordatorio",
} as const;

/** Lead-time options offered in Settings (days before the date). */
export const LEAD_DAY_OPTIONS = {
  warranty: [60, 30, 14, 7, 1],
  return: [7, 3, 1, 0],
  document: [60, 30, 14, 7, 1],
} as const;

/** Verification statuses a user can choose by hand ("extracted" is set by the scanner only). */
export const USER_VERIFICATION_STATUSES = ["manual", "confirmed", "needs_verification"] as const;
