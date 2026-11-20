import { BadgeCheck, Camera, FileText } from "lucide-react";

/**
 * Illustrative ownership record used in the hero. It shows what ORVELIA keeps
 * for one item — it is product illustration, not user data.
 */
export function OwnershipRecord() {
  // Warranty: 24 months from Mar 2026; illustration frozen at ~9 months in.
  const elapsed = 0.37;

  return (
    <figure
      aria-label="Ejemplo de un registro de propiedad en ORVELIA"
      className="relative mx-auto w-full max-w-[440px]"
    >
      {/* the collection behind the record */}
      <div
        aria-hidden
        className="absolute inset-x-6 -top-3 h-full rounded-xl border border-border bg-surface opacity-70"
      />
      <div
        aria-hidden
        className="absolute inset-x-3 -top-1.5 h-full rounded-xl border border-border bg-surface"
      />

      <div className="animate-record-in relative rounded-xl border border-border-strong bg-surface-raised p-6 shadow-[0_1px_0_rgba(17,19,21,0.04),0_24px_48px_-24px_rgba(17,19,21,0.18)] sm:p-7 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>Registro de propiedad</span>
          <span className="font-mono text-[12px]">ORV-0417</span>
        </div>

        <div className="mt-6 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Camera className="size-5" aria-hidden strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-medium leading-snug tracking-[-0.01em]">Cámara mirrorless full frame</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Comprada el 14 de marzo de 2026</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 text-sm">
          <div>
            <dt className="text-muted-foreground">Precio</dt>
            <dd className="mt-1 font-medium tabular-nums">S/ 8,499.00</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">N.º de serie</dt>
            <dd className="mt-1 font-mono text-[13px]">4K7-20391-QX</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Comprobante</dt>
            <dd className="mt-1 flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" aria-hidden strokeWidth={1.5} />
              <span>Boleta electrónica B001-004521</span>
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Garantía del fabricante</span>
            <span className="text-muted-foreground">Vence en 15 meses</span>
          </div>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="animate-fill-bar absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${elapsed * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[12px] tabular-nums text-muted-foreground">
            <span>Mar 2026</span>
            <span>Mar 2028</span>
          </div>
        </div>

        <figcaption className="mt-5 flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
          <BadgeCheck className="size-4 shrink-0 text-accent-ink" aria-hidden />
          Leído de tu boleta y confirmado por ti.
        </figcaption>
      </div>
    </figure>
  );
}
