import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      sections={[
        {
          heading: "Qué datos tratamos",
          body: [
            "Los datos de tu cuenta (nombre, correo, idioma, moneda y zona horaria) y la información que registras: productos, comprobantes, documentos, garantías, plazos y recordatorios.",
            "No almacenamos datos completos de tarjetas de pago. Los pagos los procesa un proveedor especializado.",
          ],
        },
        {
          heading: "Para qué los usamos",
          body: [
            "Para prestarte el servicio: organizar tu información, extraer datos de los documentos que subes con tu confirmación y enviarte los recordatorios que configures.",
            "No vendemos tu información ni la usamos para publicidad de terceros.",
          ],
        },
        {
          heading: "Cómo los protegemos",
          body: [
            "Tus archivos se guardan en almacenamiento privado y solo se abren mediante enlaces temporales. Cada registro está aislado por usuario a nivel de base de datos.",
          ],
        },
        {
          heading: "Tus derechos",
          body: [
            "Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, así como exportarlos o eliminar tu cuenta, conforme a la Ley N.º 29733, Ley de Protección de Datos Personales del Perú, y su reglamento.",
          ],
        },
      ]}
    />
  );
}
