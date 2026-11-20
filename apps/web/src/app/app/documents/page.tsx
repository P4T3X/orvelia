import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "Documentos" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Documentos"
      description="Garantías, manuales, facturas y certificados en un solo lugar."
      icon={FileText}
      phase="Fase 3"
      capabilities={[
        "Almacenamiento privado con enlaces temporales",
        "Asociación de documentos a productos",
        "Fechas de vencimiento de documentos",
      ]}
    />
  );
}
