import { ScanLine } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "Escáner" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Escáner"
      description="Convierte boletas, facturas y comprobantes en registros."
      icon={ScanLine}
      phase="Fase 3"
      capabilities={[
        "Carga de fotos, PDFs y comprobantes digitales",
        "Lectura de tienda, fecha, total, moneda e impuestos",
        "Pantalla de revisión: nada se guarda sin tu confirmación",
      ]}
    />
  );
}
