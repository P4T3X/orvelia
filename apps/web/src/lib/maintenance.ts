import "server-only";

import type { MaintenanceUnit } from "@orvelia/domain";
import { createClient } from "@/lib/supabase/server";

export type MaintenancePlan = {
  id: string;
  productId: string;
  title: string;
  notes: string | null;
  intervalCount: number;
  intervalUnit: MaintenanceUnit;
  nextDueDate: string;
  lastDoneDate: string | null;
  leadDays: number;
  active: boolean;
};

export type MaintenanceLog = {
  id: string;
  planId: string | null;
  title: string;
  performedOn: string;
  cost: number | null;
  currency: string | null;
  provider: string | null;
  notes: string | null;
};

type PlanRow = {
  id: string;
  product_id: string;
  title: string;
  notes: string | null;
  interval_count: number;
  interval_unit: MaintenanceUnit;
  next_due_date: string;
  last_done_date: string | null;
  lead_days: number;
  active: boolean;
};

const toPlan = (x: PlanRow): MaintenancePlan => ({
  id: x.id,
  productId: x.product_id,
  title: x.title,
  notes: x.notes,
  intervalCount: x.interval_count,
  intervalUnit: x.interval_unit,
  nextDueDate: x.next_due_date,
  lastDoneDate: x.last_done_date,
  leadDays: x.lead_days,
  active: x.active,
});

const PLAN_COLUMNS = "id, product_id, title, notes, interval_count, interval_unit, next_due_date, last_done_date, lead_days, active";

export async function getProductMaintenance(userId: string, productId: string) {
  const supabase = await createClient();
  const [plans, logs] = await Promise.all([
    supabase
      .from("maintenance_plans")
      .select(PLAN_COLUMNS)
      .eq("user_id", userId)
      .eq("product_id", productId)
      .order("active", { ascending: false })
      .order("next_due_date"),
    supabase
      .from("maintenance_logs")
      .select("id, plan_id, title, performed_on, cost, currency, provider, notes")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .order("performed_on", { ascending: false })
      .limit(50),
  ]);
  if (plans.error || logs.error) throw new Error(`No se pudo cargar el mantenimiento: ${(plans.error ?? logs.error)?.message}`);
  return {
    plans: (plans.data ?? []).map((x) => toPlan(x as PlanRow)),
    logs: (logs.data ?? []).map<MaintenanceLog>((x) => ({
      id: x.id,
      planId: x.plan_id,
      title: x.title,
      performedOn: x.performed_on,
      cost: x.cost === null ? null : Number(x.cost),
      currency: x.currency,
      provider: x.provider,
      notes: x.notes,
    })),
  };
}

export type DueMaintenance = MaintenancePlan & { productName: string };

/** Active plans due on or before `until` (overdue included), soonest first. */
export async function listDueMaintenance(userId: string, until: string, limit = 20): Promise<DueMaintenance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_plans")
    .select(`${PLAN_COLUMNS}, products!maintenance_plans_product_fk(name, status)`)
    .eq("user_id", userId)
    .eq("active", true)
    .lte("next_due_date", until)
    .order("next_due_date")
    .limit(limit);
  if (error) throw new Error(`No se pudo cargar el mantenimiento: ${error.message}`);
  type Ref = { name: string; status: string } | { name: string; status: string }[] | null;
  return (data ?? []).flatMap((x) => {
    const p = (Array.isArray(x.products) ? x.products[0] : x.products) as Exclude<Ref, unknown[]>;
    if (!p || p.status === "archived") return [];
    return [{ ...toPlan(x as unknown as PlanRow), productName: p.name }];
  });
}
