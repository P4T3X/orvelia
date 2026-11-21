import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cuenta eliminada", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <>
      <PageIntro title="Tu cuenta fue eliminada.">
        Borramos tu perfil, tus productos, comprobantes, documentos y archivos. Si tenías una suscripción, ya no se te
        cobrará.
      </PageIntro>
      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <Button asChild variant="secondary">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </>
  );
}
