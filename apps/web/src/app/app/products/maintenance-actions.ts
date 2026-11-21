"use server";

import { maintenanceDoneSchema, maintenancePlanSchema } from "@orvelia/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
const id = z.uuid();

function refresh(productId: string) {
  revalidatePath(`/app/products/${productId}`);
  revalidatePath("/app");
  revalidatePath("/app/calendar");
}

export async function saveMaintenancePlan(productId: unknown, planId: unknown, input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  if (!pid.success) return { ok: false, message: "Producto no válido." };
  const parsed = maintenancePlanSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const values = {
    title: d.title,
    notes: d.notes,
    interval_count: d.intervalCount,
    interval_unit: d.intervalUnit,
    next_due_date: d.nextDueDate,
    lead_days: d.leadDays,
  };

  const supabase = await createClient();
  if (planId) {
    const plan = id.safeParse(planId);
    if (!plan.success) return { ok: false, message: "Mantenimiento no válido." };
    const { data, error } = await supabase
      .from("maintenance_plans")
      .update(values)
      .eq("id", plan.data)
      .eq("product_id", pid.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: "No pudimos guardar los cambios. Inténtalo de nuevo." };
    if (!data) return { ok: false, message: "Este mantenimiento ya no existe." };
  } else {
    // The composite FK guarantees the product belongs to this user.
    const { error } = await supabase.from("maintenance_plans").insert({ ...values, user_id: user.id, product_id: pid.data });
    if (error) {
      return { ok: false, message: error.code === "23503" ? "Este producto ya no existe." : "No pudimos guardar el mantenimiento." };
    }
  }
  refresh(pid.data);
  return { ok: true, message: planId ? "Mantenimiento actualizado." : "Mantenimiento programado." };
}

export async function setMaintenancePlanActive(productId: unknown, planId: unknown, active: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  const plan = id.safeParse(planId);
  if (!pid.success || !plan.success || typeof active !== "boolean") return { ok: false, message: "Solicitud no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_plans")
    .update({ active })
    .eq("id", plan.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos actualizar el mantenimiento." };
  refresh(pid.data);
  return { ok: true, message: active ? "Mantenimiento reactivado." : "Mantenimiento pausado. No recibirás avisos." };
}

export async function deleteMaintenancePlan(productId: unknown, planId: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  const plan = id.safeParse(planId);
  if (!pid.success || !plan.success) return { ok: false, message: "Solicitud no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_plans")
    .delete()
    .eq("id", plan.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar el mantenimiento." };
  refresh(pid.data);
  return { ok: true, message: "Mantenimiento eliminado. El historial se conserva." };
}

export async function completeMaintenance(productId: unknown, planId: unknown, input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  const plan = id.safeParse(planId);
  if (!pid.success || !plan.success) return { ok: false, message: "Solicitud no válida." };
  const parsed = maintenanceDoneSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_maintenance", {
    p_plan_id: plan.data,
    p_performed_on: d.performedOn,
    p_cost: d.cost,
    p_currency: d.cost === null ? null : d.currency,
    p_provider: d.provider,
    p_notes: d.notes,
  });
  if (error) {
    if (error.message.includes("performed_in_future")) return { ok: false, message: "La fecha no puede estar en el futuro." };
    if (error.message.includes("plan_not_found")) return { ok: false, message: "Este mantenimiento ya no existe." };
    return { ok: false, message: "No pudimos registrar el mantenimiento. Inténtalo de nuevo." };
  }
  refresh(pid.data);
  return { ok: true, message: "Mantenimiento registrado. Programamos el siguiente." };
}

export async function deleteMaintenanceLog(productId: unknown, logId: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  const log = id.safeParse(logId);
  if (!pid.success || !log.success) return { ok: false, message: "Solicitud no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_logs")
    .delete()
    .eq("id", log.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar el registro." };
  refresh(pid.data);
  return { ok: true, message: "Registro eliminado." };
}
