"use server";

import { profileUpdateSchema } from "@orvelia/schemas";
import { revalidatePath } from "next/cache";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getMercadoPago } from "@/lib/billing";
import { STORAGE_BUCKET } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      preferred_language: parsed.data.preferredLanguage,
      preferred_currency: parsed.data.preferredCurrency,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id); // ownership check in addition to RLS

  if (error) return { ok: false, message: "No pudimos guardar los cambios. Inténtalo de nuevo." };

  // Automatic reminders fire at 09:00 local time: re-time them if the time zone changed.
  await supabase.rpc("resync_my_reminders");

  revalidatePath("/app", "layout");
  return { ok: true, message: "Cambios guardados." };
}

/**
 * Deletes the account and everything in it (right of cancellation, Ley 29733):
 * cancels an active Mercado Pago subscription, removes the user's files from
 * storage, then deletes the auth user — every table cascades from it.
 */
export async function deleteAccount(input: unknown): Promise<ActionState | void> {
  const user = await getUser();
  if (!user?.email) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const typed = typeof input === "object" && input && "email" in input ? String((input as { email: unknown }).email) : "";
  if (typed.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, fieldErrors: { email: "Escribe tu correo exactamente para confirmar." } };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "La eliminación de cuentas no está disponible en este entorno. Escríbenos y la haremos por ti." };

  // 1. Stop future charges first; if Mercado Pago can't confirm, keep the account.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, provider, provider_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.provider === "mercadopago" && sub.provider_subscription_id && ["active", "past_due", "trialing"].includes(sub.status)) {
    const mp = getMercadoPago();
    try {
      if (!mp) throw new Error("payments not configured");
      await mp.cancelPreapproval(sub.provider_subscription_id);
    } catch (e) {
      console.error("[account] cancel subscription failed", e);
      return { ok: false, message: "No pudimos cancelar tu suscripción en Mercado Pago. Cancélala en Plan y vuelve a intentarlo." };
    }
  }

  // 2. Remove stored files (paths come from the user's own rows).
  const [p, r, d] = await Promise.all([
    admin.from("products").select("image_path").eq("user_id", user.id).not("image_path", "is", null),
    admin.from("receipts").select("storage_path").eq("user_id", user.id).not("storage_path", "is", null),
    admin.from("documents").select("storage_path").eq("user_id", user.id).not("storage_path", "is", null),
  ]);
  const paths = [
    ...(p.data ?? []).map((x) => x.image_path),
    ...(r.data ?? []).map((x) => x.storage_path),
    ...(d.data ?? []).map((x) => x.storage_path),
  ].filter((x): x is string => Boolean(x) && x!.startsWith(`${user.id}/`));
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error("[account] storage cleanup failed", error.message);
  }

  // 3. Delete the auth user; profiles and all owned rows cascade.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete user failed", error.message);
    return { ok: false, message: "No pudimos eliminar tu cuenta. Inténtalo de nuevo en unos minutos." };
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/cuenta-eliminada");
}
