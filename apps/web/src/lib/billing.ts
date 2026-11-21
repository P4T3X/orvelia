import "server-only";

import {
  createMercadoPagoClient,
  mapPreapprovalStatus,
  matchesPrice,
  type AuthorizedPayment,
  type MercadoPagoClient,
  type Preapproval,
} from "@orvelia/billing";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export function getMercadoPago(): MercadoPagoClient | null {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return createMercadoPagoClient({ accessToken: token, baseUrl: process.env.MERCADOPAGO_API_URL });
}

export function isBillingConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const monthFromNow = () => new Date(Date.now() + 31 * 86_400_000).toISOString();

/**
 * Apply the state of a preapproval fetched from Mercado Pago's API (never from
 * a webhook payload). The user and plan come from our own checkout record.
 * Idempotent: applying the same state twice changes nothing.
 */
export async function applyPreapproval(admin: Admin, mp: MercadoPagoClient, p: Preapproval): Promise<"applied" | "ignored"> {
  const { data: checkout } = await admin
    .from("billing_checkouts")
    .select("id, user_id, plan, amount, currency, status")
    .eq("provider_subscription_id", p.id)
    .maybeSingle();
  if (!checkout) {
    console.warn("[billing] preapproval without checkout", { id: p.id });
    return "ignored";
  }
  if (!matchesPrice(p, Number(checkout.amount), checkout.currency)) {
    console.error("[billing] preapproval amount/currency mismatch", { id: p.id });
    await admin.from("billing_checkouts").update({ status: "failed" }).eq("id", checkout.id);
    return "ignored";
  }

  const checkoutStatus = p.status === "authorized" ? "authorized" : p.status === "cancelled" ? "cancelled" : "pending";
  if (checkout.status !== checkoutStatus) {
    await admin.from("billing_checkouts").update({ status: checkoutStatus }).eq("id", checkout.id);
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider_subscription_id, status")
    .eq("user_id", checkout.user_id)
    .maybeSingle();
  const isCurrent = sub?.provider_subscription_id === p.id;

  if (p.status === "authorized") {
    const previous = sub?.provider_subscription_id;
    await admin
      .from("subscriptions")
      .update({
        plan: checkout.plan,
        status: mapPreapprovalStatus(p.status),
        provider: "mercadopago",
        provider_subscription_id: p.id,
        provider_customer_id: p.payer_id ? String(p.payer_id) : null,
        current_period_start: isCurrent ? undefined : new Date().toISOString(),
        current_period_end: p.next_payment_date ?? monthFromNow(),
        cancel_at_period_end: false,
      })
      .eq("user_id", checkout.user_id);

    // Plan change: stop charging the previous subscription.
    if (previous && previous !== p.id) {
      try {
        await mp.cancelPreapproval(previous);
      } catch (e) {
        console.error("[billing] could not cancel previous preapproval", { previous, e });
      }
    }
    return "applied";
  }

  // Changes to a subscription that is no longer the user's current one are only recorded on the checkout.
  if (!isCurrent) return "applied";

  if (p.status === "cancelled") {
    // Keep the plan until the paid period ends (effective_plan() handles the cut-off).
    await admin
      .from("subscriptions")
      .update({ status: "canceled", cancel_at_period_end: true })
      .eq("user_id", checkout.user_id);
  } else if (p.status === "paused") {
    await admin.from("subscriptions").update({ status: "past_due" }).eq("user_id", checkout.user_id);
  }
  return "applied";
}

/** A recurring charge happened (or failed): refresh the paid-through date from the subscription. */
export async function applyAuthorizedPayment(admin: Admin, mp: MercadoPagoClient, payment: AuthorizedPayment) {
  const p = await mp.getPreapproval(payment.preapproval_id);
  await applyPreapproval(admin, mp, p);
  await admin
    .from("subscriptions")
    .update({ last_payment_status: (payment.payment?.status ?? payment.status).slice(0, 40) })
    .eq("provider_subscription_id", p.id);
}
