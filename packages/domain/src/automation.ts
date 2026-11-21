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
  maintenance: "Mantenimiento",
} as const;

/** Lead-time options offered in Settings (days before the date). */
export const LEAD_DAY_OPTIONS = {
  warranty: [60, 30, 14, 7, 1],
  return: [7, 3, 1, 0],
  document: [60, 30, 14, 7, 1],
} as const;

/** Verification statuses a user can choose by hand ("extracted" is set by the scanner only). */
export const USER_VERIFICATION_STATUSES = ["manual", "confirmed", "needs_verification"] as const;

/** YYYY-MM-DD + n calendar months, clamped to the month's last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsIso(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** YYYY-MM-DD + n days. */
export function addDaysIso(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/**
 * Dates implied by terms printed on a receipt. Only computed when both the
 * purchase date and the printed term exist; otherwise null (never assumed).
 */
export function datesFromPrintedTerms(
  purchaseDate: string | null,
  terms: { warrantyMonths?: number | null; returnDays?: number | null },
): { warrantyEnd: string | null; returnDeadline: string | null } {
  return {
    warrantyEnd: purchaseDate && terms.warrantyMonths ? addMonthsIso(purchaseDate, terms.warrantyMonths) : null,
    returnDeadline: purchaseDate && terms.returnDays ? addDaysIso(purchaseDate, terms.returnDays) : null,
  };
}

// ---------------------------------------------------------------------------
// Maintenance schedules (Stage 5)
// ---------------------------------------------------------------------------
export const MAINTENANCE_UNITS = ["days", "weeks", "months", "years"] as const;
export type MaintenanceUnit = (typeof MAINTENANCE_UNITS)[number];

const UNIT_WORDS: Record<MaintenanceUnit, [string, string]> = {
  days: ["día", "días"],
  weeks: ["semana", "semanas"],
  months: ["mes", "meses"],
  years: ["año", "años"],
};

export const MAINTENANCE_UNIT_LABELS: Record<MaintenanceUnit, string> = {
  days: "días",
  weeks: "semanas",
  months: "meses",
  years: "años",
};

/** "Cada 6 meses", "Cada semana". */
export function describeInterval(count: number, unit: MaintenanceUnit): string {
  const [one, many] = UNIT_WORDS[unit];
  return count === 1 ? `Cada ${one}` : `Cada ${count} ${many}`;
}

/** Mirrors public.maintenance_next_date(). */
export function maintenanceNextDate(from: string, count: number, unit: MaintenanceUnit): string {
  switch (unit) {
    case "days":
      return addDaysIso(from, count);
    case "weeks":
      return addDaysIso(from, count * 7);
    case "months":
      return addMonthsIso(from, count);
    case "years":
      return addMonthsIso(from, count * 12);
  }
}
