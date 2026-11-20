import { Bot } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "ORVELIA AI" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="ORVELIA AI"
      description="Pregunta sobre lo que posees en lenguaje natural."
      icon={Bot}
      phase="Fase 5"
      capabilities={[
        "Respuestas basadas solo en tus registros",
        "Enlaces a cada producto o documento citado",
        "Sin datos, fechas ni montos inventados",
      ]}
    />
  );
}
