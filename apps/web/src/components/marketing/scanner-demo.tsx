"use client";

import { Bell, Check, RotateCcw, ScanLine } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Hands-on demo of the scanner with a sample receipt drawn in HTML. Nothing is
 * uploaded or read: the "reading" is scripted for this one example document.
 */
type Field = { key: string; label: string; read: string | null; mono?: boolean };

const FIELDS: Field[] = [
  { key: "merchant", label: "Tienda", read: "Electro Hogar Lima S.A.C." },
  { key: "number", label: "N.º de comprobante", read: "B003-018842", mono: true },
  { key: "date", label: "Fecha de compra", read: "2026-11-02" },
  { key: "total", label: "Total", read: "1,338.00" },
];

const ITEMS = [
  { name: "Licuadora de alta potencia 1.8 L", price: "1,199.00" },
  { name: "Jarra adicional", price: null as string | null },
];

type Stage = "idle" | "reading" | "review" | "saved";

export function ScannerDemo() {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [shown, setShown] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState([true, true]);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function read() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStage("reading");
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, f.read ?? ""])));
    setShown(0);
    const first = reduce ? 0 : 1300;
    const step = reduce ? 0 : 140;
    timers.current.push(setTimeout(() => setStage("review"), first));
    for (let i = 1; i <= FIELDS.length + ITEMS.length + 1; i++) {
      timers.current.push(setTimeout(() => setShown(i), first + i * step));
    }
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStage("idle");
    setShown(0);
    setSelected([true, true]);
  }

  const created = selected.filter(Boolean).length;
  const first = ITEMS.find((_, i) => selected[i]);
  const short = first ? (first.name.startsWith("Licuadora") ? "licuadora" : "jarra") : "";

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
      {/* Sample receipt */}
      <div className="relative mx-auto w-full max-w-[340px]">
        <div
          aria-label="Comprobante de ejemplo"
          role="img"
          className="relative overflow-hidden rounded-sm bg-[#FBFAF7] px-6 py-7 font-mono text-[12px] leading-relaxed text-[#2A2C2E] shadow-[0_1px_0_rgba(17,19,21,0.06),0_18px_40px_-20px_rgba(17,19,21,0.35)] [mask-image:linear-gradient(to_bottom,black_96%,transparent)]"
        >
          <p className="text-center text-[13px] font-semibold tracking-wide">ELECTRO HOGAR LIMA S.A.C.</p>
          <p className="text-center">RUC 20601234567</p>
          <p className="text-center">Av. Javier Prado Este 4200</p>
          <p className="mt-3 text-center font-semibold">BOLETA DE VENTA ELECTRÓNICA</p>
          <p className="text-center">B003-018842</p>
          <p className="mt-3">Fecha: 02/11/2026 18:41</p>
          <div className="my-3 border-t border-dashed border-[#2A2C2E]/40" />
          <div className="flex justify-between gap-3">
            <span>1 LICUADORA ALTA POT 1.8L</span>
            <span>1,199.00</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>1 JARRA ADICIONAL</span>
            <span>139.00</span>
          </div>
          <div className="my-3 border-t border-dashed border-[#2A2C2E]/40" />
          <div className="flex justify-between">
            <span>OP. GRAVADA</span>
            <span>1,133.90</span>
          </div>
          <div className="flex justify-between">
            <span>IGV 18%</span>
            <span>204.10</span>
          </div>
          <div className="mt-1 flex justify-between text-[13px] font-semibold">
            <span>TOTAL S/</span>
            <span>1,338.00</span>
          </div>
          <p className="mt-4 text-center">Garantía: 12 meses con el fabricante</p>
          <p className="text-center">Gracias por su compra</p>
          {stage === "reading" && <div aria-hidden className="scan-line absolute inset-x-0 h-16" />}
        </div>
        <p className="mt-3 text-center text-[12px] text-muted-foreground">Comprobante de ejemplo para esta demostración.</p>
      </div>

      {/* Review panel */}
      <div className="min-w-0 rounded-xl border border-border bg-surface-raised p-6 sm:p-7">
        {stage === "idle" && (
          <div className="py-6 text-center sm:text-left">
            <p className="text-lg font-medium">Prueba el escáner con esta boleta</p>
            <p className="mt-2 max-w-md text-muted-foreground">
              Mira qué lee ORVELIA, corrige lo que quieras y confirma. En la demostración no se sube nada.
            </p>
            <Button className="mt-6" onClick={read}>
              <ScanLine aria-hidden />
              Leer comprobante
            </Button>
          </div>
        )}

        {stage === "reading" && (
          <div role="status" className="py-10 text-center">
            <p className="text-lg font-medium">Leyendo…</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Buscamos tienda, fecha, montos y productos.</p>
          </div>
        )}

        {stage === "review" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStage("saved");
            }}
            className="grid gap-5"
          >
            <p className="text-sm text-muted-foreground">
              Revisa cada dato. Lo marcado como <span className="text-accent-ink">Leído</span> viene del comprobante; si algo no aparece, queda vacío.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f, i) => {
                const edited = values[f.key] !== (f.read ?? "");
                return (
                  <label key={f.key} className={cn("grid gap-1.5 transition-opacity duration-300", shown > i ? "opacity-100" : "opacity-0")}>
                    <span className="flex items-center justify-between text-sm">
                      {f.label}
                      <span className={cn("rounded-full px-2 py-px text-[11px]", edited ? "bg-muted text-muted-foreground" : "bg-accent/15 text-accent-ink")}>
                        {edited ? "Editado por ti" : "Leído"}
                      </span>
                    </span>
                    <input
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      type={f.key === "date" ? "date" : "text"}
                      className={cn(
                        "h-10 rounded-md border border-border bg-background px-3 text-[15px] outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
                        f.mono && "font-mono text-[14px]",
                      )}
                    />
                  </label>
                );
              })}
            </div>
            <fieldset className={cn("grid gap-2 transition-opacity duration-300", shown > FIELDS.length ? "opacity-100" : "opacity-0")}>
              <legend className="mb-2 text-sm">Crear en tu colección</legend>
              {ITEMS.map((item, i) => (
                <label key={item.name} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected[i]}
                    onChange={(e) => setSelected((s) => s.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="size-4 accent-[#111315] dark:accent-[#C7A66A]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{item.name}</span>
                  <span className={cn("shrink-0 text-sm tabular-nums", !item.price && "text-muted-foreground")}>
                    {item.price ? `S/ ${item.price}` : "Precio no leído"}
                  </span>
                </label>
              ))}
              <p className="text-[13px] text-muted-foreground">
                El precio de la jarra no se leyó con claridad, así que queda vacío: no lo completamos por ti.
              </p>
            </fieldset>
            <div className={cn("rounded-md bg-muted px-3 py-2.5 text-[13px] transition-opacity duration-300", shown > FIELDS.length + 1 ? "opacity-100" : "opacity-0")}>
              La boleta dice “Garantía: 12 meses”, así que proponemos una garantía hasta el 2 de noviembre de 2027.
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-5">
              <Button type="submit">
                <Check aria-hidden />
                Confirmar
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Empezar de nuevo
              </Button>
            </div>
          </form>
        )}

        {stage === "saved" && (
          <div className="grid gap-5" aria-live="polite">
            <div>
              <p className="text-lg font-medium">
                {created === 0 ? "Comprobante guardado." : `Comprobante guardado y ${created === 1 ? "1 producto creado" : `${created} productos creados`}.`}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Así quedaría en tu cuenta. La boleta no indica plazo de devolución, así que no programamos ninguno:
              </p>
            </div>
            <ol className="grid gap-2">
              {(created > 0
                ? [
                    { date: "3 oct 2027", text: `La garantía de tu ${short} vence en 30 días` },
                    { date: "26 oct 2027", text: `La garantía de tu ${short} vence en 7 días` },
                  ]
                : []
              ).map((n) => (
                <li key={n.text} className="notice-in flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
                  <Bell className="size-4 shrink-0 text-accent-ink" aria-hidden />
                  <span className="min-w-0 flex-1">{n.text}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{n.date}</span>
                </li>
              ))}
            </ol>
            {created === 0 && <p className="text-sm text-muted-foreground">No marcaste productos, así que no hay avisos.</p>}
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href="/register">Crear mi cuenta gratis</a>
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden />
                Probar de nuevo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
