import { z } from "zod";

/**
 * Read-only tools the assistant can use. Inputs are validated with these
 * schemas; outputs are produced by the app's data source, which only ever
 * reads the signed-in user's own rows (RLS + explicit user filter).
 */

/** Every record a tool returns carries a ref; answers may only link to refs returned in the same turn. */
export type RecordRef = { type: "product" | "document" | "receipt"; id: string; label: string };

export const toolInputs = {
  search_products: z.object({
    query: z.string().max(100).optional().describe("Words to match in name, brand, model, serial number or store."),
    status: z.enum(["active", "sold", "gifted", "archived", "disposed", "all"]).optional().describe("Default: active."),
    category: z.string().max(60).optional().describe("Category name, e.g. Electrónica."),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  get_product: z.object({ id: z.uuid().describe("Product id from a previous tool result.") }),
  list_warranties: z.object({
    state: z.enum(["active", "expiring", "expired", "all"]).describe("expiring = active and ending within `withinDays`."),
    withinDays: z.number().int().min(1).max(730).optional(),
  }),
  upcoming_deadlines: z.object({ days: z.number().int().min(1).max(365).describe("How many days ahead to look.") }),
  spending_summary: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Purchase date from, YYYY-MM-DD."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Purchase date to, YYYY-MM-DD."),
    category: z.string().max(60).optional(),
    groupBy: z.enum(["none", "category", "month"]).optional(),
  }),
  products_missing_receipts: z.object({ limit: z.number().int().min(1).max(50).optional() }),
  recent_purchases: z.object({ limit: z.number().int().min(1).max(20).optional() }),
  list_reminders: z.object({ days: z.number().int().min(1).max(365).describe("How many days ahead to look.") }),
  list_maintenance: z.object({
    days: z.number().int().min(1).max(730).optional().describe("Only plans due within N days (overdue included). Omit for all active plans."),
  }),
} as const;

export type ToolName = keyof typeof toolInputs;
export type ToolInput<T extends ToolName> = z.infer<(typeof toolInputs)[T]>;

export const toolDescriptions: Record<ToolName, string> = {
  search_products: "Find products in the user's collection. Returns name, brand, status, category, purchase date, price, currency and whether it has a receipt.",
  get_product: "Full details of one product: purchase data, warranties, return deadlines, documents and receipt.",
  list_warranties: "Warranties with end dates and days left, computed in the user's time zone.",
  upcoming_deadlines: "Warranty ends, return deadlines and document expiries within N days, soonest first.",
  spending_summary: "Spending totals computed by the server from recorded purchase prices, per currency (never mixed). Also reports products without a price.",
  products_missing_receipts: "Products with no receipt linked.",
  recent_purchases: "Most recent purchases by purchase date.",
  list_reminders: "Scheduled reminders (automatic and manual) within N days.",
  list_maintenance: "Maintenance plans the user scheduled for their products: task, frequency, next due date (days left, negative = overdue), last time done and recorded costs.",
};

export type ProductSummary = {
  ref: RecordRef;
  brand: string | null;
  status: string;
  category: string | null;
  purchaseDate: string | null;
  price: number | null;
  currency: string | null;
  hasReceipt: boolean;
};

export type WarrantySummary = {
  product: RecordRef;
  kind: string;
  provider: string | null;
  endDate: string | null;
  daysLeft: number | null;
  verification: string;
};

export type Deadline = {
  kind: "warranty" | "return" | "document";
  date: string;
  daysLeft: number;
  ref: RecordRef;
  verification?: string;
};

export type SpendingSummary = {
  period: { from: string | null; to: string | null };
  category: string | null;
  /** One entry per currency; amounts are summed by the server. */
  totals: { currency: string; amount: number; count: number }[];
  groups: { key: string; currency: string; amount: number; count: number }[];
  productsWithoutPrice: number;
};

export type ReminderSummary = {
  title: string;
  localDate: string;
  localTime: string;
  source: string;
  recurrence: string;
  product: RecordRef | null;
};

export type MaintenanceSummary = {
  product: RecordRef;
  title: string;
  every: string;
  nextDueDate: string;
  daysLeft: number;
  lastDoneDate: string | null;
  /** Totals of recorded costs per currency (never mixed). */
  spent: { currency: string; amount: number }[];
};

export type ToolOutputs = {
  search_products: { products: ProductSummary[]; total: number };
  get_product: { product: (ProductSummary & { model: string | null; seller: string | null; serialNumber: string | null; notes: string | null; warranties: WarrantySummary[]; returns: Deadline[]; documents: RecordRef[]; receipt: RecordRef | null }) | null };
  list_warranties: { warranties: WarrantySummary[] };
  upcoming_deadlines: { deadlines: Deadline[] };
  spending_summary: SpendingSummary;
  products_missing_receipts: { products: ProductSummary[]; total: number };
  recent_purchases: { products: ProductSummary[] };
  list_reminders: { reminders: ReminderSummary[] };
  list_maintenance: { plans: MaintenanceSummary[] };
};

/** Implemented by the app. Every method returns plain JSON including refs. */
export type AssistantDataSource = {
  [K in ToolName]: (input: ToolInput<K>) => Promise<ToolOutputs[K]>;
};
