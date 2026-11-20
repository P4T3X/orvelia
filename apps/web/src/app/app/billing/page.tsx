import { PLANS } from "@orvelia/domain";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plan" };

const fmtLimit = (n: number | null, unit = "") => (n === null ? "Ilimitado" : `${n.toLocaleString("es-PE")}${unit}`);
const fmtStorage = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toLocaleString("es-PE")} GB` : `${mb} MB`);

export default async function BillingPage() {
  const user = await requireUser("/app/billing");
  const supabase = await createClient();

  const [{ data: sub, error: subError }, { data: limits, error: limitsError }] = await Promise.all([
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("plan_limits").select("*"),
  ]);
  if (subError || limitsError) throw new Error((subError ?? limitsError)?.message);

  const planId = sub?.plan ?? "free";
  const plan = PLANS.find((p) => p.id === planId);
  const current = limits?.find((l) => l.plan === planId);

  return (
    <>
      <PageHeader title="Plan" description="Tu plan actual y sus límites." />

      <section className="rounded-xl border border-border bg-surface-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="mt-1 text-2xl font-medium">{plan?.name ?? planId}</p>
          </div>
          <span className="rounded-full border border-border-strong px-3 py-1 text-sm text-muted-foreground">
            {sub?.status === "active" ? "Activo" : (sub?.status ?? "Activo")}
          </span>
        </div>
        {current ? (
          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Productos", fmtLimit(current.max_products)],
              ["Escaneos al mes", fmtLimit(current.scans_per_month)],
              ["Almacenamiento", fmtStorage(current.storage_mb)],
              ["Consultas a ORVELIA AI", current.ai_queries_per_month === 0 ? "No incluido" : fmtLimit(current.ai_queries_per_month)],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface-raised px-6 py-5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1.5 text-lg font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-6 py-5 text-muted-foreground">No se encontraron los límites del plan.</p>
        )}
      </section>

      <Alert tone="info" title="Los planes Plus y Ultra se activarán pronto." className="mt-6">
        Te avisaremos por correo cuando puedas cambiar de plan. Los pagos se procesarán con un proveedor
        especializado; ORVELIA no guarda datos de tarjetas.
      </Alert>
    </>
  );
}
