import { Package } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "Mi colección" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Mi colección"
      description="Todos tus productos, con su historia de compra y documentos."
      icon={Package}
      phase="Fase 2"
      capabilities={[
        "Crear, editar, archivar y eliminar productos",
        "Búsqueda y filtros por categoría, estado y fecha",
        "Fotos, número de serie, notas y documentos asociados",
      ]}
    />
  );
}
