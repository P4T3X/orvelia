import { Package } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/app/module-placeholder";

export const metadata: Metadata = { title: "Producto" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  return (
    <ModulePlaceholder
      title="Detalle del producto"
      description="La ficha completa de un producto."
      icon={Package}
      phase="Fase 2"
      capabilities={[
        "Datos de compra, comprobantes y documentos",
        "Garantías y plazos de devolución con su origen",
        "Historial y recordatorios del producto",
      ]}
    />
  );
}
