import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./page-header";

/**
 * Honest placeholder for modules scheduled in later phases. It never shows
 * fake data — it says what the module will do and when.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  phase,
  capabilities,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
  capabilities: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="rounded-xl border border-dashed border-border-strong px-6 py-14 sm:px-10">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface">
            <Icon className="size-5 text-accent-ink" aria-hidden strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 text-lg font-medium">En construcción</h2>
          <p className="mt-2 text-muted-foreground">Este módulo llega en la {phase}. Incluirá:</p>
          <ul className="mt-5 grid gap-2 text-left text-[15px]">
            {capabilities.map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-accent" />
                {c}
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary" className="mt-8">
            <Link href="/app">Volver al inicio</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
