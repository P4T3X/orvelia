import { Alert } from "@/components/ui/alert";

export function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-8 md:pt-20">
      <h1 className="text-[2.2rem] font-medium tracking-[-0.03em] sm:text-[2.6rem]">{title}</h1>
      <Alert tone="info" title="Borrador" className="mt-8">
        Este texto es un borrador de trabajo y será revisado por asesoría legal antes del lanzamiento público.
      </Alert>
      <div className="mt-12 grid gap-10">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-medium">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 leading-[1.7] text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
