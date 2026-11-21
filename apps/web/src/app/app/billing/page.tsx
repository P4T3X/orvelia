import { PLANS, type PlanId } from "@orvelia/domain";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { CancelSubscription, CheckoutReturn, SubscribeButton } from "@/components/billing/plan-controls";
import { Alert } from "@/components/ui/alert";
import { getProfile, requireUser } from "@/lib/auth";
import { isBillingConfigured } from "@/lib/billing";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn, isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan" };

const RANK: Record<PlanId, number> = { free: 0, plus: 1, ultra: 2 };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser("/app/billing");
  const supabase = await createClient();
  const [{ checkout }, profile, { data: overviewRows }, { data: limits }, products, scans, ai] = await Promise.all([
    searchParams,
    getProfile(user.id),
    supabase.rpc("billing_overview"),
    supabase.from("plan_limits").select("*"),
    supabase.rpc("product_usage"),
    supabase.rpc("scan_usage"),
    supabase.rpc("assistant_usage"),
  ]);
  const o = overviewRows?.[0];
  const current: PlanId = o?.effective_plan ?? "free";
  const configured = isBillingConfigured();
  const tz = profile?.timezone ?? "America/Lima";
  const until = o?.current_period_end
    ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date(o.current_period_end))
    : null;
  const paidActive = current !== "free" && o?.provider === "mercadopago";
  const limitOf = (plan: PlanId) => limits?.find((l) => l.plan === plan);
  const cur = limitOf(current);

  let statusLine = "Plan gratuito.";
  if (paidActive && o?.status === "active") statusLine = until ? `Se renueva el ${until}.` : "Suscripción activa.";
  if (paidActive && o?.status === "canceled") statusLine = until ? `Cancelada. Conservas el plan hasta el ${until}.` : "Cancelada.";
  if (paidActive && o?.status === "past_due") statusLine = "No pudimos cobrar la última cuota. Mercado Pago lo reintentará; revisa tu medio de pago.";

  const usage = [
    { label: "Productos", used: products.data?.[0]?.used ?? 0, max: cur?.max_products ?? null },
    { label: "Lecturas de comprobantes este mes", used: scans.data?.[0]?.used ?? 0, max: cur?.scans_per_month ?? 0 },
    { label: "Consultas a ORVELIA AI este mes", used: ai.data?.[0]?.used ?? 0, max: cur?.ai_queries_per_month ?? 0 },
  ];

  return (
    <>
      <PageHeader title="Plan" description="Tu plan, tu uso y los planes disponibles." />

      {checkout && isUuid(checkout) && <CheckoutReturn checkoutId={checkout} />}
      {!configured && (
        <Alert tone="info" title="Los pagos aún no están activos en este entorno." className="mb-6">
          Podrás suscribirte a Plus o Ultra cuando se activen.
        </Alert>
      )}

      <section className="rounded-xl border border-border bg-surface-raised">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="mt-1 text-2xl font-medium">{PLANS.find((p) => p.id === current)?.name}</p>
            <p className={cn("mt-1 text-sm", o?.status === "past_due" ? "text-danger" : "text-muted-foreground")}>{statusLine}</p>
          </div>
          {paidActive && o?.status !== "canceled" && <CancelSubscription until={until} />}
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-3">
          {usage.map((u) => (
            <div key={u.label} className="bg-surface-raised px-6 py-5">
              <dt className="text-sm text-muted-foreground">{u.label}</dt>
              <dd className="mt-1.5 text-lg font-medium tabular-nums">
                {u.used}
                <span className="text-muted-foreground"> / {u.max === null ? "ilimitado" : u.max === 0 ? "no incluido" : u.max}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <h2 className="mb-4 mt-10 font-medium">Planes</h2>
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
        {PLANS.map((plan) => {
          const l = limitOf(plan.id);
          const price = Number(l?.price_monthly ?? plan.priceMonthly);
          const isCurrent = plan.id === current;
          const upgrade = RANK[plan.id] > RANK[current];
          return (
            <section key={plan.id} className={cn("flex flex-col bg-background p-7", isCurrent && "bg-surface")}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-medium">{plan.name}</h3>
                {isCurrent && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[12px] text-accent-ink">Tu plan</span>}
              </div>
              <p className="mt-2 text-muted-foreground">{plan.tagline}</p>
              <p className="mt-6">
                <span className="text-3xl font-medium tracking-[-0.02em]">{price === 0 ? "Gratis" : formatMoney(price, l?.currency ?? "PEN")}</span>
                {price > 0 && <span className="text-muted-foreground"> al mes</span>}
              </p>
              <ul className="mt-6 grid flex-1 content-start gap-2.5 text-[15px]">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {plan.id === "free" || isCurrent ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    {isCurrent ? "Es tu plan actual" : paidActive && o?.status === "canceled" ? "Pasarás a Free al terminar el periodo" : "Cancela tu suscripción para volver a Free"}
                  </p>
                ) : (
                  <SubscribeButton
                    plan={plan.id}
                    variant={upgrade ? "primary" : "secondary"}
                    label={current === "free" ? `Suscribirme a ${plan.name}` : `Cambiar a ${plan.name}`}
                    disabled={!configured}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Precios en soles, cobro mensual con Mercado Pago (tarjeta, Yape o saldo de Mercado Pago). ORVELIA no guarda los
        datos de tu tarjeta. Al cambiar de plan, el nuevo plan empieza al confirmarse el pago y la suscripción anterior se
        cancela.
      </p>
    </>
  );
}
