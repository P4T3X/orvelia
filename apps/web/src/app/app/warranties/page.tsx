import { daysUntil } from "@orvelia/api";
import { WARRANTY_KIND_LABELS } from "@orvelia/domain";
import { ShieldCheck, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { VerificationBadge } from "@/components/products/verification-badge";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { listAllProtection, type ProtectionEntry } from "@/lib/protection";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Garantías" };

const FILTERS = [
  { key: "todo", label: "Todo" },
  { key: "por-vencer", label: "Por vencer" },
  { key: "vigentes", label: "Vigentes" },
  { key: "devoluciones", label: "Devoluciones" },
  { key: "por-verificar", label: "Por verificar" },
  { key: "sin-fecha", label: "Sin fecha de fin" },
  { key: "vencidas", label: "Vencidas" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/** Warranties ending within 30 days and returns closing within 7 need attention. */
const SOON = { warranty: 30, return: 7 } as const;

type Row = ProtectionEntry & { days: number | null };

function bucket(r: Row): "soon" | "active" | "expired" | "undated" {
  if (r.days === null) return "undated";
  if (r.days < 0) return "expired";
  return r.days <= SOON[r.type] ? "soon" : "active";
}

const needsCheck = (r: Row) => r.verification === "needs_verification" || r.verification === "extracted";

function matches(r: Row, f: FilterKey) {
  switch (f) {
    case "todo":
      return true;
    case "por-vencer":
      return bucket(r) === "soon";
    case "vigentes":
      return r.type === "warranty" && (bucket(r) === "active" || bucket(r) === "soon");
    case "devoluciones":
      return r.type === "return" && bucket(r) !== "expired";
    case "por-verificar":
      return needsCheck(r);
    case "sin-fecha":
      return bucket(r) === "undated";
    case "vencidas":
      return bucket(r) === "expired";
  }
}

/** Soonest first; past dates after the future ones (most recent first); undated last. */
function order(a: Row, b: Row) {
  const rank = (r: Row) => (r.days === null ? 2 : r.days < 0 ? 1 : 0);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.days === null || b.days === null) return a.productName.localeCompare(b.productName, "es");
  return rank(a) === 1 ? b.days - a.days : a.days - b.days;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );

function remaining(r: Row) {
  if (r.days === null) return r.type === "warranty" ? "Sin fecha de fin" : null;
  const d = r.days;
  const verb = r.type === "return" ? "Cierra" : "Vence";
  if (d < 0) return d === -1 ? (r.type === "return" ? "Cerró ayer" : "Venció ayer") : `${r.type === "return" ? "Cerró" : "Venció"} hace ${-d} días`;
  if (d === 0) return `${verb} hoy`;
  if (d === 1) return `${verb} mañana`;
  if (d < 60) return `Quedan ${d} días`;
  const months = Math.round(d / 30.4);
  return months < 24 ? `Quedan ${months} meses` : `Quedan ${Math.round(months / 12)} años`;
}

export default async function WarrantiesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireUser("/app/warranties");
  const [profile, entries, { f: rawFilter }] = await Promise.all([
    getProfile(user.id),
    listAllProtection(user.id),
    searchParams,
  ]);
  const today = todayIn(profile?.timezone ?? "America/Lima");
  const filter: FilterKey = FILTERS.some((x) => x.key === rawFilter) ? (rawFilter as FilterKey) : "todo";

  const rows: Row[] = entries.map((e) => ({ ...e, days: e.date ? daysUntil(e.date, today) : null })).sort(order);
  const counts = Object.fromEntries(FILTERS.map((x) => [x.key, rows.filter((r) => matches(r, x.key)).length])) as Record<
    FilterKey,
    number
  >;
  const visible = rows.filter((r) => matches(r, filter));
  const activeWarranties = rows.filter((r) => r.type === "warranty" && (bucket(r) === "active" || bucket(r) === "soon")).length;

  return (
    <>
      <PageHeader
        title="Garantías y devoluciones"
        description={
          rows.length === 0
            ? "Todas las coberturas de tu colección en un solo lugar."
            : [
                `${activeWarranties} ${activeWarranties === 1 ? "garantía vigente" : "garantías vigentes"}`,
                counts["por-vencer"] > 0 && `${counts["por-vencer"]} por vencer pronto`,
                counts["por-verificar"] > 0 && `${counts["por-verificar"]} por verificar`,
              ]
                .filter(Boolean)
                .join(", ") + "."
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-raised px-6 py-14 text-center">
          <ShieldCheck className="mx-auto size-6 text-accent-ink" aria-hidden />
          <p className="mt-4 text-lg font-medium">Aún no registras garantías ni plazos de devolución.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Agrégalos desde la ficha de cada producto o al confirmar un comprobante en el escáner. Solo guardamos los
            plazos que tú registras o que aparecen en tus documentos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/app/products">Ir a mi colección</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/scanner">Escanear un comprobante</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <nav aria-label="Filtrar" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
            {FILTERS.map((x) => (
              <Link
                key={x.key}
                href={x.key === "todo" ? "/app/warranties" : `/app/warranties?f=${x.key}`}
                aria-current={filter === x.key ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  filter === x.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {x.label}{" "}
                <span className="ml-1 tabular-nums opacity-70">{counts[x.key]}</span>
              </Link>
            ))}
          </nav>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Nada en esta vista.{" "}
              <Link href="/app/warranties" className="text-foreground underline underline-offset-4">
                Ver todo
              </Link>
            </p>
          ) : (
            <ul aria-label="Garantías y devoluciones" className="divide-y divide-border rounded-xl border border-border bg-surface">
              {visible.map((r) => (
                <ProtectionRow key={`${r.type}-${r.id}`} row={r} />
              ))}
            </ul>
          )}
          <p className="mt-4 text-[13px] text-muted-foreground">
            No asumimos plazos estándar: si un producto no aparece aquí, es porque no tiene garantía ni devolución
            registrada.
          </p>
        </>
      )}
    </>
  );
}

function ProtectionRow({ row: r }: { row: Row }) {
  const b = bucket(r);
  const Icon = r.type === "warranty" ? ShieldCheck : Undo2;
  const label = r.type === "warranty" ? `Garantía ${WARRANTY_KIND_LABELS[r.kind ?? "other"].toLowerCase()}` : "Devolución";
  const rest = remaining(r);
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border",
            b === "soon" ? "border-danger/40 text-danger" : b === "expired" ? "border-border text-muted-foreground" : "border-accent/50 text-accent-ink",
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <Link href={`/app/products/${r.productId}#garantia`} className="block truncate font-medium hover:underline">
            {r.productName}
          </Link>
          <p className="truncate text-sm text-muted-foreground">
            {label}
            {r.provider ? ` · ${r.provider}` : ""}
            {r.productArchived ? " · producto archivado" : ""}
          </p>
          {r.details && <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">{r.details}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-11 sm:shrink-0 sm:justify-end sm:pl-0 sm:text-right">
        {r.date && <span className="text-sm tabular-nums">{fmtDate(r.date)}</span>}
        {rest && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[12px]",
              b === "soon" ? "bg-danger/10 text-danger" : b === "expired" ? "bg-muted text-muted-foreground" : "bg-muted text-foreground",
            )}
          >
            {rest}
          </span>
        )}
        <VerificationBadge status={r.verification} />
      </div>
    </li>
  );
}
