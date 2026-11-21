"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { applyPreapproval, getMercadoPago, isBillingConfigured } from "@/lib/billing";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const NOT_READY: ActionState<never> = { ok: false, message: "Los pagos aún no están activos." };
const PLAN_NAMES = { plus: "Plus", ultra: "Ultra" } as const;

/** Starts a Mercado Pago subscription checkout; the price comes from plan_limits on the server. */
export async function startCheckout(plan: unknown): Promise<ActionState<{ url: string }>> {
  const user = await getUser();
  if (!user?.email) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const parsed = z.enum(["plus", "ultra"]).safeParse(plan);
  if (!parsed.success) return { ok: false, message: "Plan no válido." };
  const mp = getMercadoPago();
  const admin = createAdminClient();
  if (!isBillingConfigured() || !mp || !admin) return NOT_READY;

  const [{ data: price }, { data: sub }] = await Promise.all([
    admin.from("plan_limits").select("price_monthly, currency").eq("plan", parsed.data).single(),
    admin.from("subscriptions").select("plan, status, provider_subscription_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!price || Number(price.price_monthly) <= 0) return { ok: false, message: "Este plan no está disponible." };
  if (sub?.plan === parsed.data && sub.status === "active" && sub.provider_subscription_id) {
    return { ok: false, message: `Ya tienes el plan ${PLAN_NAMES[parsed.data]}.` };
  }

  const { data: checkout, error } = await admin
    .from("billing_checkouts")
    .insert({ user_id: user.id, plan: parsed.data, amount: Number(price.price_monthly), currency: price.currency })
    .select("id")
    .single();
  if (error || !checkout) return { ok: false, message: "No pudimos iniciar el pago. Inténtalo de nuevo." };

  try {
    const pre = await mp.createPreapproval({
      reason: `ORVELIA ${PLAN_NAMES[parsed.data]} (mensual)`,
      externalReference: checkout.id,
      payerEmail: user.email,
      amount: Number(price.price_monthly),
      currency: price.currency,
      backUrl: `${publicEnv.siteUrl}/app/billing?checkout=${checkout.id}`,
      idempotencyKey: checkout.id,
    });
    if (!pre.init_point) throw new Error("missing init_point");
    await admin.from("billing_checkouts").update({ provider_subscription_id: pre.id, status: "pending" }).eq("id", checkout.id);
    return { ok: true, data: { url: pre.init_point } };
  } catch (e) {
    console.error("[billing] createPreapproval failed", e);
    await admin.from("billing_checkouts").update({ status: "failed" }).eq("id", checkout.id);
    return { ok: false, message: "Mercado Pago no respondió. Inténtalo de nuevo en unos minutos." };
  }
}

/**
 * Called when the user comes back from Mercado Pago: reads the subscription
 * from the API right away instead of waiting for the webhook.
 */
export async function syncCheckout(checkoutId: unknown): Promise<ActionState<{ status: string; plan: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró." };
  const id = z.uuid().safeParse(checkoutId);
  const mp = getMercadoPago();
  const admin = createAdminClient();
  if (!id.success || !mp || !admin) return NOT_READY;

  const { data: checkout } = await admin
    .from("billing_checkouts")
    .select("id, plan, provider_subscription_id")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!checkout?.provider_subscription_id) return { ok: false, message: "No encontramos este pago." };

  try {
    const pre = await mp.getPreapproval(checkout.provider_subscription_id);
    await applyPreapproval(admin, mp, pre);
    revalidatePath("/app", "layout");
    return { ok: true, data: { status: pre.status, plan: checkout.plan } };
  } catch (e) {
    console.error("[billing] sync failed", e);
    return { ok: false, message: "Aún no podemos confirmar tu pago. Lo verificaremos automáticamente." };
  }
}

/** Cancels renewal; the plan stays until the paid period ends. */
export async function cancelSubscription(): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró." };
  const mp = getMercadoPago();
  const admin = createAdminClient();
  if (!mp || !admin) return NOT_READY;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider, provider_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub?.provider_subscription_id || sub.provider !== "mercadopago" || sub.status === "canceled") {
    return { ok: false, message: "No tienes una suscripción activa." };
  }
  try {
    const pre = await mp.cancelPreapproval(sub.provider_subscription_id);
    await applyPreapproval(admin, mp, pre);
  } catch (e) {
    console.error("[billing] cancel failed", e);
    return { ok: false, message: "No pudimos cancelar ahora. Inténtalo de nuevo." };
  }
  revalidatePath("/app", "layout");
  return { ok: true, message: "Cancelamos la renovación. Conservas tu plan hasta el fin del periodo pagado." };
}
