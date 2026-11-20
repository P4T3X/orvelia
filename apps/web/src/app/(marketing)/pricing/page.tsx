import { PLANS } from "@orvelia/domain";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Planes",
  description: "Free, Plus y Ultra. Empieza gratis y crece cuando lo necesites.",
};

export default function PricingPage() {
  return (
    <>
      <PageIntro title="Empieza gratis. Crece cuando lo necesites.">
        Los planes de pago se activarán pronto. Mientras tanto, el plan Free está disponible para todos.
      </PageIntro>

      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
          {PLANS.map((plan) => {
            const available = plan.id === "free";
            return (
              <section
                key={plan.id}
                aria-labelledby={`plan-${plan.id}`}
                className={cn(
                  "flex flex-col bg-background p-7 sm:p-8",
                  plan.highlighted && "bg-surface",
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 id={`plan-${plan.id}`} className="text-xl font-medium">
                    {plan.name}
                  </h2>
                  {plan.highlighted && (
                    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[12px] text-accent-ink">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mt-2 text-muted-foreground">{plan.tagline}</p>

                <p className="mt-8 text-3xl font-medium tracking-[-0.02em]">
                  {available ? "Gratis" : "Precio por anunciar"}
                </p>

                <ul className="mt-8 grid flex-1 content-start gap-3 text-[15px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                {available ? (
                  <Button asChild className="mt-10" size="lg">
                    <Link href="/register">Crear cuenta gratis</Link>
                  </Button>
                ) : (
                  <Button className="mt-10" size="lg" variant="secondary" disabled>
                    Disponible pronto
                  </Button>
                )}
              </section>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Los límites de cada plan se aplican en nuestros servidores y pueden ajustarse antes del lanzamiento.
        </p>
      </div>
    </>
  );
}
