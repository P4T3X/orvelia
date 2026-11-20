import { VERIFICATION_STATUS_LABELS, type VerificationStatus } from "@orvelia/domain";
import { CalendarClock, Check, Circle, PackagePlus, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

function greeting(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate(isoDate: string) {
  // Dates are calendar dates (no time zone); format at noon UTC to avoid day shifts.
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const user = await requireUser("/app");
  const profile = await getProfile(user.id);
  const timeZone = profile?.timezone ?? "America/Lima";
  const data = await getDashboardData(user.id, timeZone);
  const { password } = await searchParams;
  const firstName = profile?.full_name?.split(" ")[0];

  const stats = [
    { label: "Productos activos", value: data.activeProducts },
    { label: "Garantías vigentes", value: data.activeWarranties },
    { label: "Vencen en 30 días", value: data.upcomingCount },
    { label: "Comprobantes", value: data.receipts },
  ];

  const steps = [
    { label: "Crea tu cuenta y confirma tu correo", done: Boolean(user.email_confirmed_at), href: undefined },
    { label: "Completa tu perfil", done: Boolean(profile?.full_name), href: "/app/settings" },
    { label: "Registra tu primer producto", done: data.activeProducts > 0, href: "/app/products/new" },
    { label: "Sube tu primer comprobante", done: data.receipts > 0, href: "/app/scanner" },
  ];
  const pending = steps.filter((s) => !s.done).length;

  return (
    <>
      {password === "updated" && <Alert tone="success" title="Tu contraseña se actualizó." className="mb-6" />}

      <PageHeader
        title={`${greeting(timeZone)}${firstName ? `, ${firstName}` : ""}`}
        description="Este es el estado de todo lo que posees."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/scanner">
                <ScanLine aria-hidden />
                Escanear
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/products/new">
                <PackagePlus aria-hidden />
                Agregar producto
              </Link>
            </Button>
          </>
        }
      />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-raised px-5 py-5 sm:px-6">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-2 text-3xl font-medium tabular-nums tracking-[-0.02em]">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="upcoming" className="rounded-xl border border-border bg-surface-raised">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <h2 id="upcoming" className="font-medium">
              Próximos vencimientos
            </h2>
            <Link href="/app/calendar" className="text-sm text-muted-foreground hover:text-foreground">
              Ver calendario
            </Link>
          </div>
          {data.upcoming.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <CalendarClock className="mx-auto size-6 text-muted-foreground" aria-hidden strokeWidth={1.5} />
              <p className="mt-4 font-medium">Nada vence en los próximos 30 días</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                Cuando registres garantías y plazos de devolución, aparecerán aquí antes de vencer.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.upcoming.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={`/app/products/${item.productId}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted sm:px-6"
                  >
                    <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatDate(item.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.productName}</span>
                      <span className="block text-[13px] text-muted-foreground">
                        {item.kind === "warranty" ? "Fin de garantía" : "Último día de devolución"} ·{" "}
                        {VERIFICATION_STATUS_LABELS[item.verification as VerificationStatus] ?? item.verification}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="getting-started" className="rounded-xl border border-border bg-surface-raised">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <h2 id="getting-started" className="font-medium">
              Primeros pasos
            </h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {steps.length - pending} de {steps.length}
            </span>
          </div>
          <ol className="grid gap-1 p-3">
            {steps.map((s) => {
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      s.done ? "bg-accent text-[#111315]" : "border border-border-strong",
                    )}
                  >
                    {s.done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <Circle className="size-0" aria-hidden />}
                  </span>
                  <span className={cn("text-[15px]", s.done && "text-muted-foreground line-through decoration-border-strong")}>
                    {s.label}
                  </span>
                  <span className="sr-only">{s.done ? "(completado)" : "(pendiente)"}</span>
                </>
              );
              return (
                <li key={s.label}>
                  {s.href && !s.done ? (
                    <Link href={s.href} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground sm:px-6">
            Plan actual: <span className="font-medium capitalize text-foreground">{data.plan}</span>
            {" · "}
            <Link href="/app/billing" className="underline-offset-4 hover:text-foreground hover:underline">
              Ver plan
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
