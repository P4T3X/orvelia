import { Bell, Bot, CalendarDays, Package, ScanLine, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Funciones",
  description: "Colección, escáner de comprobantes, garantías, devoluciones, calendario y asistente con IA.",
};

const modules = [
  {
    icon: Package,
    name: "Mi colección",
    lead: "La ficha de cada cosa que posees.",
    points: [
      "Nombre, marca, modelo, categoría y descripción",
      "Fecha y precio de compra, moneda y tienda",
      "Número de serie, fotos, notas y documentos asociados",
      "Estados: activo, vendido, regalado, archivado o desechado",
    ],
  },
  {
    icon: ScanLine,
    name: "Escáner inteligente",
    lead: "Fotos, PDFs y comprobantes digitales convertidos en datos.",
    points: [
      "Lee tienda, fecha, total, moneda, impuestos y número de comprobante",
      "Pantalla de revisión editable antes de guardar",
      "Si un dato no aparece, queda vacío: nunca se inventa",
      "Te ofrece crear el producto y sus recordatorios",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Garantías y devoluciones",
    lead: "Fechas claras y su origen a la vista.",
    points: [
      "Inicio, fin, proveedor y cobertura de cada garantía",
      "Plazo y condiciones de devolución",
      "Cada dato indica si fue extraído, ingresado, confirmado o pendiente de verificar",
      "Sin suposiciones de plazos estándar",
    ],
  },
  {
    icon: CalendarDays,
    name: "Calendario",
    lead: "Todo lo que vence, en una sola vista.",
    points: [
      "Vencimientos de garantías y documentos",
      "Plazos de devolución y mantenimientos",
      "Recordatorios personalizados",
    ],
  },
  {
    icon: Bell,
    name: "Avisos confiables",
    lead: "Los recordatorios se envían desde nuestros servidores.",
    points: [
      "Llegan aunque no tengas la app abierta",
      "Por correo y en la app; notificaciones push en las apps móviles",
      "Tú eliges con cuánta anticipación",
    ],
  },
  {
    icon: Bot,
    name: "ORVELIA AI",
    lead: "Pregunta en lenguaje natural sobre lo que posees.",
    points: [
      "¿Qué garantías siguen activas? ¿Qué productos no tienen comprobante?",
      "Responde solo con tus registros y enlaza a cada uno",
      "No inventa fechas, montos ni condiciones",
    ],
  },
  {
    icon: Users,
    name: "ORVELIA Family",
    lead: "Un espacio compartido para el hogar.",
    points: [
      "Invitaciones y roles por miembro",
      "Productos, documentos y recordatorios compartidos",
      "Lo privado sigue siendo privado",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageIntro title="Cada cosa que posees, con su historia completa.">
        Desde el comprobante de compra hasta el último día de garantía. Estas son las piezas de ORVELIA.
      </PageIntro>

      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="divide-y divide-border border-y border-border">
          {modules.map(({ icon: Icon, ...m }) => (
            <section key={m.name} className="grid gap-6 py-10 md:grid-cols-[1fr_1.3fr] md:gap-12">
              <div>
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-accent-ink" aria-hidden strokeWidth={1.5} />
                  <h2 className="text-xl font-medium tracking-[-0.01em]">{m.name}</h2>
                </div>
                <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">{m.lead}</p>
              </div>
              <ul className="grid gap-3">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-3 leading-relaxed">
                    <span aria-hidden className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-border-strong" />
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg">Empieza con el plan Free. Sin tarjeta.</p>
          <Button asChild size="lg">
            <Link href="/register">Crear cuenta gratis</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
