import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "Calendario" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Calendario"
      description="Garantías, devoluciones, mantenimientos y recordatorios."
      icon={CalendarDays}
      phase="Fase 4"
      capabilities={[
        "Vista de calendario y próximos eventos",
        "Recordatorios configurables",
        "Avisos enviados desde el servidor por correo y en la app",
      ]}
    />
  );
}
