import "server-only";

import type { DocumentType } from "@orvelia/domain";
import { createClient } from "@/lib/supabase/server";

export type DocumentItem = {
  id: string;
  title: string;
  type: DocumentType;
  mimeType: string | null;
  sizeBytes: number | null;
  expiresOn: string | null;
  productId: string | null;
  productName: string | null;
  createdAt: string;
};

type ProductRef = { name: string } | { name: string }[] | null;
const nameOf = (p: ProductRef) => (Array.isArray(p) ? p[0]?.name : p?.name) ?? null;

export async function listDocuments(
  userId: string,
  opts: { productId?: string; type?: DocumentType; limit?: number } = {},
): Promise<DocumentItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select("id, title, document_type, mime_type, size_bytes, expires_on, product_id, created_at, products!documents_product_fk(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.productId) q = q.eq("product_id", opts.productId);
  if (opts.type) q = q.eq("document_type", opts.type);
  const { data, error } = await q;
  if (error) throw new Error(`No se pudieron cargar los documentos: ${error.message}`);
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    type: d.document_type,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    expiresOn: d.expires_on,
    productId: d.product_id,
    productName: nameOf(d.products as ProductRef),
    createdAt: d.created_at,
  }));
}
