"use server";

import { notificationPrefsSchema, reminderInputSchema, zonedToUtc } from "@orvelia/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };

function refresh() {
  revalidatePath("/app/calendar");
  revalidatePath("/app");
}

export async function createReminder(input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = reminderInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const profile = await getProfile(user.id);
  const scheduledAt = zonedToUtc(d.date, d.time, profile?.timezone ?? "America/Lima");
  if (Date.parse(scheduledAt) <= Date.now()) {
    return { ok: false, fieldErrors: { date: "Elige una fecha y hora futuras." }, message: "Revisa los campos marcados." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({
    user_id: user.id,
    product_id: d.productId,
    title: d.title,
    description: d.description,
    scheduled_at: scheduledAt,
    recurrence: d.recurrence,
    notification_channels: d.email ? ["email", "in_app"] : ["in_app"],
  });
  if (error) {
    return { ok: false, message: error.code === "23503" ? "El producto elegido ya no existe." : "No pudimos crear el recordatorio." };
  }
  refresh();
  return { ok: true, message: "Recordatorio creado." };
}

/** Custom reminders are deleted; automatic ones are dismissed (they belong to a warranty/return/document). */
export async function removeReminder(id: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const rid = z.uuid().safeParse(id);
  if (!rid.success) return { ok: false, message: "Recordatorio no válido." };

  const supabase = await createClient();
  const { data: rem } = await supabase
    .from("reminders")
    .select("id, source")
    .eq("id", rid.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!rem) return { ok: false, message: "Este recordatorio ya no existe." };

  const { error } =
    rem.source === "custom"
      ? await supabase.from("reminders").delete().eq("id", rem.id).eq("user_id", user.id)
      : await supabase.from("reminders").update({ status: "dismissed" }).eq("id", rem.id).eq("user_id", user.id);
  if (error) return { ok: false, message: "No pudimos quitar el recordatorio." };

  refresh();
  return { ok: true, message: rem.source === "custom" ? "Recordatorio eliminado." : "Aviso descartado." };
}

export async function saveNotificationPrefs(input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = notificationPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Preferencias no válidas." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      email_enabled: d.emailEnabled,
      warranty_lead_days: d.warrantyLeadDays,
      return_lead_days: d.returnLeadDays,
      document_lead_days: d.documentLeadDays,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: "No pudimos guardar tus preferencias." };

  // Rebuild every pending automatic reminder with the new lead times/channels.
  const { error: resyncError } = await supabase.rpc("resync_my_reminders");
  if (resyncError) return { ok: false, message: "Guardamos tus preferencias, pero no pudimos reprogramar los avisos." };

  revalidatePath("/app/settings");
  refresh();
  return { ok: true, message: "Preferencias guardadas. Reprogramamos tus avisos." };
}

export async function markNotificationsRead(ids?: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const list = z.array(z.uuid()).max(200).optional().safeParse(ids);
  if (!list.success) return { ok: false, message: "Solicitud no válida." };

  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (list.data) q = q.in("id", list.data);
  const { error } = await q;
  if (error) return { ok: false, message: "No pudimos actualizar tus avisos." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
