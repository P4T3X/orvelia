import { verifyMercadoPagoSignature } from "@orvelia/billing";
import { NextResponse, type NextRequest } from "next/server";
import { applyAuthorizedPayment, applyPreapproval, getMercadoPago } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const HANDLED = new Set(["subscription_preapproval", "subscription_authorized_payment"]);

/**
 * Mercado Pago notifications. Only the signed `data.id` is trusted: the
 * resource is always re-read from Mercado Pago's API before changing anything.
 * Responds 200 once processed (or for events we don't use) and 500 on a
 * transient failure so Mercado Pago retries; retries of processed events are no-ops.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const mp = getMercadoPago();
  const admin = createAdminClient();
  if (!secret || !mp || !admin) return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });

  const url = req.nextUrl;
  const body = (await req.json().catch(() => ({}))) as { id?: string | number; type?: string; action?: string; data?: { id?: string | number } };
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);
  const type = url.searchParams.get("type") ?? body.type ?? "";

  const valid = verifyMercadoPagoSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret,
  });
  if (!valid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  if (!dataId || !HANDLED.has(type)) return NextResponse.json({ ignored: true });

  const eventId = String(body.id ?? req.headers.get("x-request-id") ?? `${type}:${dataId}`);
  await admin
    .from("billing_events")
    .upsert({ provider: "mercadopago", event_id: eventId, type, data_id: dataId }, { onConflict: "provider,event_id", ignoreDuplicates: true });
  const { data: event } = await admin
    .from("billing_events")
    .select("id, processed_at")
    .eq("provider", "mercadopago")
    .eq("event_id", eventId)
    .single();
  if (event?.processed_at) return NextResponse.json({ duplicate: true });

  try {
    if (type === "subscription_preapproval") {
      await applyPreapproval(admin, mp, await mp.getPreapproval(dataId));
    } else {
      await applyAuthorizedPayment(admin, mp, await mp.getAuthorizedPayment(dataId));
    }
    await admin.from("billing_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event!.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("[billing:webhook] processing failed", { type, dataId, message });
    await admin.from("billing_events").update({ error: message.slice(0, 500) }).eq("id", event!.id);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
