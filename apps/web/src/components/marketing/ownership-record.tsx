"use client";

import { BadgeCheck, Bell, Camera, FileText, Laptop, Refrigerator, type LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive illustration for the hero: pick an example item and move time
 * forward to see when ORVELIA would notify. Example data, not user data.
 */
type Example = {
  key: string;
  tab: string;
  icon: LucideIcon;
  name: string;
  price: string;
  serial: string;
  receipt: string;
  purchase: string; // YYYY-MM-DD
  warrantyMonths: number;
  warrantyLabel: string;
  returnDays: number;
  source: string;
};

const EXAMPLES: Example[] = [
  {
    key: "camera",
    tab: "Cámara",
    icon: Camera,
    name: "Cámara mirrorless full frame",
    price: "S/ 8,499.00",
    serial: "4K7-20391-QX",
    receipt: "Boleta electrónica B001-004521",
    purchase: "2026-03-14",
    warrantyMonths: 24,
    warrantyLabel: "Garantía del fabricante",
    returnDays: 30,
    source: "Leído de tu boleta y confirmado por ti.",
  },
  {
    key: "fridge",
    tab: "Refrigeradora",
    icon: Refrigerator,
    name: "Refrigeradora no frost 420 L",
    price: "S/ 3,299.00",
    serial: "RF42-88310",
    receipt: "Factura F002-000187",
    purchase: "2026-01-20",
    warrantyMonths: 12,
    warrantyLabel: "Garantía de la tienda",
    returnDays: 7,
    source: "Ingresado por ti desde el certificado de garantía.",
  },
  {
    key: "laptop",
    tab: "Laptop",
    icon: Laptop,
    name: "Laptop 14” para trabajo",
    price: "US$ 1,249.00",
    serial: "C02XG0FJH7",
    receipt: "Comprobante digital por correo",
    purchase: "2026-06-02",
    warrantyMonths: 12,
    warrantyLabel: "Garantía del fabricante",
    returnDays: 15,
    source: "Leído del PDF que te llegó por correo.",
  },
];

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const addMonths = (iso: string, m: number) => {
  const d = new Date(toTime(iso));
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.getTime();
};
// Deterministic formatting (server and browser ICU data differ, which would
// break hydration).
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
function fmt(t: number, opts: { day?: "numeric"; month?: "short" | "long"; year?: "numeric" } = { day: "numeric", month: "short", year: "numeric" }) {
  const d = new Date(t);
  const parts: string[] = [];
  const month = opts.month === "long" ? MONTHS[d.getUTCMonth()] : SHORT[d.getUTCMonth()];
  if (opts.day) parts.push(String(d.getUTCDate()));
  if (opts.month) parts.push(opts.month === "long" && opts.day ? `de ${month}` : month!);
  if (opts.year) parts.push(opts.month === "long" && opts.day ? `de ${d.getUTCFullYear()}` : String(d.getUTCFullYear()));
  return parts.join(" ");
}

function timeLeft(days: number) {
  if (days < 0) return "Vencida";
  if (days === 0) return "Vence hoy";
  if (days < 60) return `Vence en ${days} días`;
  const months = Math.round(days / 30.4);
  return `Vence en ${months} ${months === 1 ? "mes" : "meses"}`;
}

export function OwnershipRecord() {
  const [index, setIndex] = React.useState(0);
  const ex = EXAMPLES[index]!;
  const start = toTime(ex.purchase);
  const end = addMonths(ex.purchase, ex.warrantyMonths);
  const span = Math.round((end - start) / DAY) + 45;
  // Start ~37% into the warranty, like the original illustration.
  const [day, setDay] = React.useState(() => Math.round(((end - start) / DAY) * 0.37));
  const now = start + day * DAY;
  const warrantyDays = Math.round((end - now) / DAY);
  const returnEnd = start + ex.returnDays * DAY;
  const returnDays = Math.round((returnEnd - now) / DAY);
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));

  const notices = [
    { at: returnEnd - 3 * DAY, text: `Quedan 3 días para devolver tu ${ex.tab.toLowerCase()}` },
    { at: end - 30 * DAY, text: `La garantía de tu ${ex.tab.toLowerCase()} vence en 30 días` },
    { at: end - 7 * DAY, text: `La garantía de tu ${ex.tab.toLowerCase()} vence en 7 días` },
  ]
    .filter((n) => n.at <= now)
    .slice(-2)
    .reverse();

  const Icon = ex.icon;
  const sliderId = React.useId();

  return (
    <figure aria-label="Ejemplo interactivo de un registro de propiedad en ORVELIA" className="relative mx-auto w-full max-w-[440px]">
      <div role="tablist" aria-label="Producto de ejemplo" className="mb-5 flex gap-1 rounded-lg border border-border bg-surface p-1">
        {EXAMPLES.map((e, i) => (
          <button
            key={e.key}
            role="tab"
            type="button"
            aria-selected={i === index}
            onClick={() => {
              setIndex(i);
              const s = toTime(e.purchase);
              setDay(Math.round(((addMonths(e.purchase, e.warrantyMonths) - s) / DAY) * 0.37));
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
              i === index ? "bg-surface-raised font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {e.tab}
          </button>
        ))}
      </div>

      <div className="relative">
        <div aria-hidden className="absolute inset-x-6 -top-3 h-full rounded-xl border border-border bg-surface opacity-70" />
        <div aria-hidden className="absolute inset-x-3 -top-1.5 h-full rounded-xl border border-border bg-surface" />

        <div
          key={ex.key}
          className="animate-record-in relative rounded-xl border border-border-strong bg-surface-raised p-6 shadow-[0_1px_0_rgba(17,19,21,0.04),0_24px_48px_-24px_rgba(17,19,21,0.18)] sm:p-7 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>Registro de propiedad</span>
            <span className="font-mono text-[12px]">ORV-04{17 + index}</span>
          </div>

          <div className="mt-6 flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Icon className="size-5" aria-hidden strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-medium leading-snug tracking-[-0.01em]">{ex.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Comprada el {fmt(start, { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 text-sm">
            <div>
              <dt className="text-muted-foreground">Precio</dt>
              <dd className="mt-1 font-medium tabular-nums">{ex.price}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">N.º de serie</dt>
              <dd className="mt-1 font-mono text-[13px]">{ex.serial}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Comprobante</dt>
              <dd className="mt-1 flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden strokeWidth={1.5} />
                <span>{ex.receipt}</span>
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{ex.warrantyLabel}</span>
              <span className={cn("tabular-nums", warrantyDays < 0 ? "text-muted-foreground" : warrantyDays <= 30 ? "font-medium text-danger" : "text-muted-foreground")} aria-live="polite">
                {timeLeft(warrantyDays)}
              </span>
            </div>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-150", warrantyDays < 0 ? "bg-muted-foreground/40" : "bg-accent")}
                style={{ width: `${elapsed * 100}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[12px] tabular-nums text-muted-foreground">
              <span>{fmt(start, { month: "short", year: "numeric" })}</span>
              <span>{fmt(end, { month: "short", year: "numeric" })}</span>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">
              Devolución:{" "}
              {returnDays >= 0 ? (
                <span className={cn(returnDays <= 3 && "font-medium text-danger")}>
                  {returnDays === 0 ? "último día hoy" : `quedan ${returnDays} días`}
                </span>
              ) : (
                "plazo cerrado"
              )}
            </p>
          </div>

          <figcaption className="mt-5 flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
            <BadgeCheck className="size-4 shrink-0 text-accent-ink" aria-hidden />
            {ex.source}
          </figcaption>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor={sliderId} className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Mueve el tiempo</span>
          <span className="tabular-nums text-muted-foreground">{fmt(now)}</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={span}
          value={Math.min(day, span)}
          onChange={(e) => setDay(Number(e.target.value))}
          aria-valuetext={`${fmt(now, { day: "numeric", month: "long", year: "numeric" })}: ${timeLeft(warrantyDays).toLowerCase()}`}
          className="time-slider mt-2 w-full"
        />
        <ul aria-live="polite" aria-label="Avisos que recibirías" className="mt-3 grid min-h-[4.75rem] content-start gap-2">
          {notices.length === 0 ? (
            <li className="text-[13px] text-muted-foreground">Aún no hay avisos: ORVELIA te escribe antes de cada fecha importante.</li>
          ) : (
            notices.map((n) => (
              <li key={n.text} className="notice-in flex items-center gap-2.5 rounded-md border border-border bg-surface-raised px-3 py-2 text-[13px]">
                <Bell className="size-3.5 shrink-0 text-accent-ink" aria-hidden />
                <span className="min-w-0 flex-1">{n.text}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{fmt(n.at, { day: "numeric", month: "short" })}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </figure>
  );
}
