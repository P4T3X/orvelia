import { PackagePlus } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "Agregar producto" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Agregar producto"
      description="Registra un producto con sus datos de compra."
      icon={PackagePlus}
      phase="Fase 2"
      capabilities={[
        "Formulario con validación de cada campo",
        "Categorías del sistema y propias",
        "Foto del producto en almacenamiento privado",
      ]}
    />
  );
}
