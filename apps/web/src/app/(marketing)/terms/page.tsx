import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Términos" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos del servicio"
      sections={[
        {
          heading: "El servicio",
          body: [
            "ORVELIA te permite organizar información sobre los bienes que posees. La información extraída de documentos es una ayuda: revísala y confírmala antes de guardarla.",
          ],
        },
        {
          heading: "Tu cuenta",
          body: [
            "Eres responsable de mantener la confidencialidad de tu contraseña y de la información que registras.",
          ],
        },
        {
          heading: "Garantías y plazos",
          body: [
            "ORVELIA no determina las condiciones de garantía ni de devolución de ningún producto. Las fechas que registras provienen de tus documentos o de lo que ingresas; las condiciones vigentes son las del vendedor o fabricante.",
          ],
        },
        {
          heading: "Planes",
          body: [
            "El plan Free es gratuito con los límites publicados. Los planes de pago, sus precios y condiciones se publicarán antes de su activación.",
          ],
        },
      ]}
    />
  );
}
