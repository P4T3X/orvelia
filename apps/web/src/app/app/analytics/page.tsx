import { DOCUMENT_TYPE_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_STATUSES, type DocumentType } from "@orvelia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getAnalytics, lastTwelveMonths } from "@/lib/analytics";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Análisis" };

const monthShort = (ym: string) =>
  new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`)).replace(".", "");
const monthLong = (ym: string) => {
  const s = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/** Rounds an axis maximum up to a clean 1/2/5 × 10^n value. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="bg-surface-raised px-5 py-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-2xl font-medium tabular-nums tracking-[-0.01em]">{value}</dd>
      {note && <dd className="mt-1 text-[13px] text-muted-foreground">{note}</dd>}
    </div>
  );
}

function Meter({ label, part, whole }: { label: string; part: number; whole: number }) {
  const p = pct(part, whole);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {part} de {whole} <span className="font-medium text-foreground">{p}%</span>
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
      >
        <div className="h-full rounded-full bg-chart-bar" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  await requireUser("/app/analytics");
  const a = await getAnalytics();

  if (!a) {
    return (
      <>
        <PageHeader title="Análisis" description="Cuánto has invertido, qué está protegido y qué vence pronto." />
        <section className="rounded-xl border border-border bg-surface-raised p-6 sm:p-8">
          <h2 className="text-lg font-medium">El análisis avanzado es parte de Plus y Ultra</h2>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Mira tus compras mes a mes, el valor de tu colección por categoría y qué porcentaje de tus productos tiene garantía
            vigente, comprobante y documentos.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/app/billing">Ver planes</Link>
            </Button>
          </div>
        </section>
      </>
    );
  }

  const cur = a.currency;
  const main = a.totals.find((t) => t.currency === cur);
  const others = a.totals.filter((t) => t.currency !== cur);
  const months = lastTwelveMonths(a.today);
  const series = months.map((m) => {
    const row = a.byMonth.find((r) => r.month === m && r.currency === cur);
    return { month: m, total: row?.total ?? 0, count: row?.count ?? 0 };
  });
  const yearTotal = series.reduce((s, x) => s + x.total, 0);
  const max = niceMax(Math.max(...series.map((s) => s.total)));
  const peak = series.reduce((best, s) => (s.total > best.total ? s : best), series[0]!);
  const otherMonthly = a.byMonth.filter((r) => r.currency !== cur);
  const catMax = Math.max(1, ...a.byCategory.map((c) => c.count));
  const cov = a.coverage;
  const dueSoon = a.upcoming.warranties90 + a.upcoming.returns30 + a.upcoming.documents90;
  const docTypes = Object.entries(a.documentsByType).sort((x, y) => y[1] - x[1]);

  return (
    <>
      <PageHeader title="Análisis" description="Cuánto has invertido, qué está protegido y qué vence pronto. Solo con tus propios productos." />

      <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Valor de tu colección"
          value={formatMoney(main?.total ?? 0, cur)}
          note={others.length > 0 ? `y ${others.map((o) => formatMoney(o.total, o.currency)).join(", ")}` : "Productos activos con precio"}
        />
        <Stat label="Productos activos" value={cov.activeProducts} note={a.oldestActive ? `El más antiguo: ${a.oldestActive.name}` : undefined} />
        <Stat
          label="Con garantía vigente"
          value={`${pct(cov.withActiveWarranty, cov.activeProducts)}%`}
          note={`${cov.withActiveWarranty} de ${cov.activeProducts} productos`}
        />
        <Stat
          label="Vence pronto"
          value={dueSoon}
          note={dueSoon === 0 ? "Nada en los próximos 90 días" : "Garantías y documentos en 90 días, devoluciones en 30"}
        />
      </dl>

      <section aria-labelledby="by-month" className="mt-10 rounded-xl border border-border bg-surface-raised p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="by-month" className="font-medium">
            Compras por mes
          </h2>
          <p className="text-sm text-muted-foreground">
            Últimos 12 meses: <span className="font-medium text-foreground tabular-nums">{formatMoney(yearTotal, cur)}</span>
          </p>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">Según la fecha de compra, en {cur}.</p>

        <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
          <div className="flex h-48 flex-col justify-between text-right text-[12px] tabular-nums text-muted-foreground" aria-hidden>
            <span>{formatMoney(max, cur)}</span>
            <span>{formatMoney(max / 2, cur)}</span>
            <span>0</span>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden>
              <div className="absolute inset-x-0 top-0 border-t border-border" />
              <div className="absolute inset-x-0 top-1/2 border-t border-border" />
              <div className="absolute inset-x-0 bottom-0 border-t border-border-strong" />
            </div>
            <ol className="relative grid h-48 grid-cols-12 items-end gap-[2px]" aria-label="Compras por mes">
              {series.map((s, i) => {
                const h = s.total === 0 ? 0 : Math.max(2, (s.total / max) * 100);
                const label = `${monthLong(s.month)}: ${formatMoney(s.total, cur)}, ${s.count} ${s.count === 1 ? "compra" : "compras"}`;
                return (
                  <li key={s.month} className="group relative flex h-full items-end justify-center outline-none" tabIndex={0} aria-label={label}>
                    {s === peak && s.total > 0 && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground max-sm:hidden"
                        style={{ bottom: `calc(${h}% + 4px)` }}
                        aria-hidden
                      >
                        {formatMoney(s.total, cur)}
                      </span>
                    )}
                    <span className="w-full max-w-6 rounded-t-[4px] bg-chart-bar transition-opacity group-hover:opacity-80" style={{ height: `${h}%` }} />
                    <span
                      role="tooltip"
                      style={{ bottom: `calc(${h}% + 8px)` }}
                      className={`pointer-events-none absolute z-10 hidden w-max max-w-48 rounded-md border border-border bg-surface-raised px-3 py-2 text-[12px] shadow-sm group-hover:block group-focus-visible:block ${i < 2 ? "left-0" : i > 9 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                    >
                      <span className="block font-medium">{monthLong(s.month)}</span>
                      <span className="block tabular-nums">{formatMoney(s.total, cur)}</span>
                      <span className="block text-muted-foreground">
                        {s.count} {s.count === 1 ? "compra" : "compras"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <ol className="mt-2 grid grid-cols-12 gap-[2px] text-center text-[11px] text-muted-foreground" aria-hidden>
              {series.map((s, i) => (
                <li key={s.month} className={i % 2 === 1 ? "max-sm:invisible" : undefined}>
                  {monthShort(s.month)}
                </li>
              ))}
            </ol>
          </div>
        </div>
        {otherMonthly.length > 0 && (
          <p className="mt-4 text-[13px] text-muted-foreground">
            No se incluyen {otherMonthly.reduce((s, r) => s + r.count, 0)} compras en otras monedas (
            {[...new Set(otherMonthly.map((r) => r.currency))].join(", ")}).
          </p>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver como tabla</summary>
          <table className="mt-3 w-full max-w-md text-left tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Mes</th>
                <th className="py-1 text-right font-normal">Compras</th>
                <th className="py-1 text-right font-normal">Monto</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.month} className="border-t border-border">
                  <td className="py-1">{monthLong(s.month)}</td>
                  <td className="py-1 text-right">{s.count}</td>
                  <td className="py-1 text-right">{formatMoney(s.total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="by-category" className="rounded-xl border border-border bg-surface-raised p-5 sm:p-6">
          <h2 id="by-category" className="font-medium">
            Por categoría
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Productos activos; el monto es en {cur}.</p>
          {a.byCategory.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Aún no tienes productos activos.</p>
          ) : (
            <ul className="mt-6 grid gap-4">
              {a.byCategory.slice(0, 8).map((c) => (
                <li key={c.category} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{c.category}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.count} {c.count === 1 ? "producto" : "productos"}
                      {c.total ? ` · ${formatMoney(c.total, cur)}` : ""}
                    </span>
                  </div>
                  <div className="h-2" aria-hidden>
                    <div className="h-full rounded-r-[4px] bg-chart-bar" style={{ width: `${(c.count / catMax) * 100}%` }} />
                  </div>
                </li>
              ))}
              {a.byCategory.length > 8 && (
                <li className="text-[13px] text-muted-foreground">
                  y {a.byCategory.length - 8} categorías más con {a.byCategory.slice(8).reduce((s, c) => s + c.count, 0)} productos
                </li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="coverage" className="rounded-xl border border-border bg-surface-raised p-5 sm:p-6">
          <h2 id="coverage" className="font-medium">
            Qué tan protegida está tu colección
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Sobre {cov.activeProducts} productos activos.</p>
          <div className="mt-6 grid gap-5">
            <Meter label="Con garantía vigente" part={cov.withActiveWarranty} whole={cov.activeProducts} />
            <Meter label="Con comprobante de compra" part={cov.withReceipt} whole={cov.activeProducts} />
            <Meter label="Con documentos" part={cov.withDocuments} whole={cov.activeProducts} />
          </div>
          {cov.withExpiredOnly > 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              {cov.withExpiredOnly} {cov.withExpiredOnly === 1 ? "producto tiene" : "productos tienen"} solo garantías vencidas.
            </p>
          )}
          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
            {[
              { label: "Garantías en 90 días", v: a.upcoming.warranties90 },
              { label: "Devoluciones en 30 días", v: a.upcoming.returns30 },
              { label: "Documentos en 90 días", v: a.upcoming.documents90 },
            ].map((x) => (
              <div key={x.label} className="bg-surface-raised px-2 py-3">
                <dd className="text-lg font-medium tabular-nums">{x.v}</dd>
                <dt className="text-[12px] leading-tight text-muted-foreground">{x.label}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/calendar">Ver en el calendario</Link>
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="by-status">
          <h2 id="by-status" className="mb-3 font-medium">
            Por estado
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {PRODUCT_STATUSES.map((s) => (
              <li key={s} className="flex justify-between bg-surface-raised px-5 py-3 text-sm">
                <span>{PRODUCT_STATUS_LABELS[s]}</span>
                <span className="tabular-nums text-muted-foreground">{a.byStatus[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="docs">
          <h2 id="docs" className="mb-3 font-medium">
            Documentos guardados
          </h2>
          {docTypes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">Aún no subiste documentos.</p>
          ) : (
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
              {docTypes.map(([t, v]) => (
                <li key={t} className="flex justify-between bg-surface-raised px-5 py-3 text-sm">
                  <span>{DOCUMENT_TYPE_LABELS[t as DocumentType] ?? t}</span>
                  <span className="tabular-nums text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </>
  );
}
