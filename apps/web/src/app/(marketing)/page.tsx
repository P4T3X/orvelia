import { Lock, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { OwnershipRecord } from "@/components/marketing/ownership-record";
import { ScannerDemo } from "@/components/marketing/scanner-demo";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Sube tu comprobante",
    body: "Una foto de la boleta, un PDF o la factura que te llegó por correo. Se guarda en tu espacio privado.",
  },
  {
    title: "Revisa lo que leímos",
    body: "ORVELIA extrae tienda, fecha, montos y productos. Tú corriges y confirmas; nada se guarda sin tu visto bueno.",
  },
  {
    title: "Recibe el aviso a tiempo",
    body: "Te avisamos antes de que cierre un plazo de devolución o venza una garantía, por correo y en la app.",
  },
];

const capabilities = [
  {
    name: "Mi colección",
    body: "Cada cosa que posees con su marca, modelo, precio, tienda, número de serie, fotos y notas. Busca y filtra en segundos.",
  },
  {
    name: "Escáner inteligente",
    body: "Convierte boletas, facturas y comprobantes digitales en registros ordenados, siempre con tu confirmación.",
  },
  {
    name: "Garantías y devoluciones",
    body: "Fechas, cobertura y el documento de respaldo. Cada dato indica si vino de un documento, lo escribiste tú o falta verificarlo.",
  },
  {
    name: "Calendario",
    body: "Vencimientos, devoluciones, mantenimientos y tus propios recordatorios en una sola vista.",
  },
  {
    name: "ORVELIA AI",
    body: "Pregunta qué garantías siguen activas o cuánto gastaste en electrónica. Responde solo con tus registros.",
  },
  {
    name: "ORVELIA Family",
    body: "Una familia de hasta 5 personas en Ultra, con permisos claros entre lo personal y lo común.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-20 pt-14 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-28">
        <div className="max-w-xl">
          <h1 className="text-[2.6rem] font-medium leading-[1.04] tracking-[-0.035em] text-balance sm:text-[3.4rem] lg:text-[3.75rem]">
            Todo lo que posees. Un solo espacio inteligente.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground text-pretty">
            Comprobantes, garantías, plazos de devolución y documentos de cada cosa que compras,
            ordenados y a la mano. ORVELIA te avisa antes de que algo venza.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">Crear cuenta gratis</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/features">Ver cómo funciona</Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Plan Free con hasta 10 productos. Sin tarjeta.
          </p>
        </div>

        <OwnershipRecord />
      </section>

      {/* How it works — a real sequence, so it is numbered */}
      <section aria-labelledby="how" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <h2 id="how" className="max-w-lg text-3xl font-medium tracking-[-0.025em] text-balance sm:text-[2.2rem]">
            De la boleta al recordatorio, sin escribir nada dos veces.
          </h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-sm tabular-nums">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span aria-hidden className="hidden h-px flex-1 bg-border-strong md:block" />
                  )}
                </div>
                <h3 className="mt-5 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Hands-on scanner demo */}
      <section aria-labelledby="try" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <h2 id="try" className="max-w-xl text-3xl font-medium tracking-[-0.025em] text-balance sm:text-[2.2rem]">
            Pruébalo con una boleta de ejemplo.
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
            Así funciona el escáner: lee, tú revisas y nada se guarda sin tu confirmación.
          </p>
          <div className="mt-12">
            <ScannerDemo />
          </div>
        </div>
      </section>

      {/* Capabilities — definition list, not a card grid */}
      <section aria-labelledby="capabilities" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 id="capabilities" className="text-3xl font-medium tracking-[-0.025em] text-balance sm:text-[2.2rem]">
              Lo que ORVELIA guarda por ti.
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">
              Una ficha completa de cada cosa que posees, con la información que necesitas el día que la necesitas.
            </p>
          </div>
          <dl className="divide-y divide-border border-y border-border">
            {capabilities.map((c) => (
              <div key={c.name} className="grid gap-2 py-6 sm:grid-cols-[13rem_1fr] sm:gap-8">
                <dt className="flex items-center gap-2.5 font-medium">
                  {c.name}
                </dt>
                <dd className="leading-relaxed text-muted-foreground">{c.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Privacy */}
      <section aria-labelledby="privacy" className="bg-[#111315] text-[#F6F4EF] dark:border-y dark:border-border dark:bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <h2 id="privacy" className="max-w-2xl text-3xl font-medium tracking-[-0.025em] text-balance sm:text-[2.2rem]">
            Tu información es tuya. La tratamos con ese respeto.
          </h2>
          <ul className="mt-12 grid gap-10 md:grid-cols-3">
            <li>
              <Lock className="size-5 text-[#C7A66A]" aria-hidden strokeWidth={1.5} />
              <p className="mt-4 font-medium">Archivos privados</p>
              <p className="mt-2 leading-relaxed text-[#B7BBC0]">
                Tus documentos se guardan cifrados y solo se abren con enlaces temporales que expiran en minutos.
              </p>
            </li>
            <li>
              <ShieldCheck className="size-5 text-[#C7A66A]" aria-hidden strokeWidth={1.5} />
              <p className="mt-4 font-medium">Nada inventado</p>
              <p className="mt-2 leading-relaxed text-[#B7BBC0]">
                Si un dato no está en tu comprobante, queda vacío. Nunca asumimos garantías ni plazos estándar.
              </p>
            </li>
            <li>
              <Trash2 className="size-5 text-[#C7A66A]" aria-hidden strokeWidth={1.5} />
              <p className="mt-4 font-medium">Control total</p>
              <p className="mt-2 leading-relaxed text-[#B7BBC0]">
                Exporta o elimina tu cuenta y tus archivos cuando quieras.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 lg:py-28">
        <h2 className="mx-auto max-w-xl text-3xl font-medium tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          Empieza por lo último que compraste.
        </h2>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted-foreground">
          Registra tu primer producto en menos de un minuto.
        </p>
        <Button asChild size="lg" className="mt-9">
          <Link href="/register">Crear cuenta gratis</Link>
        </Button>
      </section>
    </>
  );
}
