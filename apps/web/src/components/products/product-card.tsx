import { daysUntil, warrantyCoverage, type Coverage } from "@orvelia/api";
import { Package, RotateCcw, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { ProductThumb } from "@/components/products/product-thumb";
import { StatusBadge } from "@/components/products/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import type { ProductListItem } from "@/lib/products";
import { cn } from "@/lib/utils";

/** Short wording for narrow cards (two columns on phones). */
function coverageShort(c: Coverage): string {
  switch (c.state) {
    case "active":
      return c.days === 0 ? "Vence hoy" : c.endingSoon ? `Vence en ${c.days} ${c.days === 1 ? "día" : "días"}` : `Hasta ${formatDate(c.endDate, "short")}`;
    case "expired":
      return "Garantía vencida";
    case "undated":
      return "Sin fecha de fin";
    case "none":
      return "Sin garantía";
  }
}

function coverageText(c: Coverage): string {
  switch (c.state) {
    case "active":
      return c.days === 0 ? "Garantía vence hoy" : c.endingSoon ? `Garantía vence en ${c.days} ${c.days === 1 ? "día" : "días"}` : `Garantía hasta el ${formatDate(c.endDate, "short")}`;
    case "expired":
      return `Garantía vencida el ${formatDate(c.endDate, "short")}`;
    case "undated":
      return "Garantía sin fecha de fin";
    case "none":
      return "Sin garantía registrada";
  }
}

/** Warranty state chip shared by cards and list rows. */
export function CoverageChip({ product, today, className }: { product: ProductListItem; today: string; className?: string }) {
  const c = warrantyCoverage(product.warrantyCount ?? 0, product.warrantyEnd, today);
  const Icon = c.state === "active" ? ShieldCheck : c.state === "none" ? ShieldOff : ShieldAlert;
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-[12px] leading-tight",
        c.state === "active" && !c.endingSoon && "text-success",
        c.state === "active" && c.endingSoon && "font-medium text-accent-ink",
        c.state === "expired" && "text-danger",
        (c.state === "none" || c.state === "undated") && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden strokeWidth={1.75} />
      <span className="truncate sm:hidden">{coverageShort(c)}</span>
      <span className="hidden truncate sm:inline">{coverageText(c)}</span>
    </span>
  );
}

/** Return window still open within the next 7 days: worth flagging on the card. */
function ReturnChip({ deadline, today }: { deadline: string | null | undefined; today: string }) {
  if (!deadline) return null;
  const d = daysUntil(deadline, today);
  if (d < 0 || d > 7) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium leading-tight text-danger">
      <RotateCcw className="size-3.5 shrink-0" aria-hidden strokeWidth={1.75} />
      {d === 0 ? "Último día para devolver" : `Devolución: ${d} ${d === 1 ? "día" : "días"}`}
    </span>
  );
}

export function ProductCard({ product: p, today }: { product: ProductListItem; today: string }) {
  const price = formatMoney(p.purchasePrice, p.currency);
  const subtitle = [p.brand, p.model].filter(Boolean).join(" ");
  return (
    <Link
      href={`/app/products/${p.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface-raised transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket; not optimizable
          <img src={p.imageUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" decoding="async" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-8 text-muted-foreground" aria-hidden strokeWidth={1.25} />
          </div>
        )}
        {p.status !== "active" && <StatusBadge status={p.status} className="absolute left-2.5 top-2.5 bg-surface-raised/95" />}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
        <h3 className="line-clamp-2 font-medium leading-snug">{p.name}</h3>
        <p className="truncate text-[13px] text-muted-foreground">{[subtitle, p.categoryName].filter(Boolean).join(" · ") || "Sin marca ni categoría"}</p>
        <div className="mt-auto grid gap-1.5 pt-3">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium tabular-nums">{price ?? <span className="font-normal text-muted-foreground">Sin precio</span>}</span>
            <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">{formatDate(p.purchaseDate, "short") ?? ""}</span>
          </p>
          <ReturnChip deadline={p.nextReturnDeadline} today={today} />
          <CoverageChip product={p} today={today} />
        </div>
      </div>
    </Link>
  );
}

/** Compact row for the list view (same data as the card). */
export function ProductRow({ product: p, today }: { product: ProductListItem; today: string }) {
  const price = formatMoney(p.purchasePrice, p.currency);
  const subtitle = [p.brand, p.model].filter(Boolean).join(" ");
  return (
    <Link
      href={`/app/products/${p.id}`}
      className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-4 py-3.5 hover:bg-muted sm:grid-cols-[3.5rem_1.6fr_1.2fr_1fr_auto] sm:px-5"
    >
      <ProductThumb url={p.imageUrl} name={p.name} className="size-14" />
      <div className="min-w-0">
        <p className="truncate font-medium">{p.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {subtitle || p.categoryName || "Sin marca"}
          <span className="sm:hidden">{price ? ` · ${price}` : ""}</span>
        </p>
        <CoverageChip product={p} today={today} className="mt-1 sm:hidden" />
      </div>
      <div className="hidden min-w-0 sm:block">
        <CoverageChip product={p} today={today} />
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{p.categoryName ?? "Sin categoría"}</p>
      </div>
      <div className="hidden text-sm sm:block">
        <p className="tabular-nums">{price ?? "—"}</p>
        <p className="text-[13px] text-muted-foreground">{formatDate(p.purchaseDate, "short") ?? "Sin fecha"}</p>
      </div>
      <StatusBadge status={p.status} className={p.status === "active" ? "hidden sm:inline-flex" : undefined} />
    </Link>
  );
}
