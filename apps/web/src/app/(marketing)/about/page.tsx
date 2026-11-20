import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "ORVELIA crea la categoría de gestión personal de propiedad.",
};

const principles = [
  { name: "Simplicidad", body: "Se entiende al primer uso. Sin manuales." },
  { name: "Inteligencia", body: "La IA se encarga del trabajo repetitivo; tú decides." },
  { name: "Confiabilidad", body: "Cada dato importante es exacto y se puede rastrear hasta su origen." },
  { name: "Privacidad", body: "Tú eres dueño de tu información y la controlas." },
];

export default function AboutPage() {
  return (
    <>
      <PageIntro title="Construimos el lugar donde vive todo lo que posees.">
        ORVELIA nace en Perú con una idea simple: las cosas que compramos vienen con papeles, plazos y
        garantías que se pierden. Queremos que nunca más tengas que buscarlos.
      </PageIntro>
      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <h2 className="text-2xl font-medium tracking-[-0.02em]">Cómo trabajamos</h2>
        <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {principles.map((p) => (
            <div key={p.name} className="bg-background p-7">
              <dt className="font-medium">{p.name}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">{p.body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-sm text-muted-foreground">ORVELIA es un producto de Lucioni Enterprises.</p>
      </div>
    </>
  );
}
