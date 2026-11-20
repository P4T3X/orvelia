import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DocumentForm } from "@/components/documents/document-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Subir documento" };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const user = await requireUser("/app/documents/new");
  const { product } = await searchParams;
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name")
    .limit(500);

  const defaultProductId = product && isUuid(product) && products?.some((p) => p.id === product) ? product : null;

  return (
    <>
      <PageHeader title="Subir documento" description="Certificados de garantía, manuales, facturas, pólizas o cualquier papel importante." />
      <DocumentForm products={products ?? []} defaultProductId={defaultProductId} />
    </>
  );
}
