"use server";

import { UPLOAD_MAX_BYTES } from "@orvelia/domain";
import { documentUploadSchema } from "@orvelia/schemas";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { sniffUploadType, UPLOAD_EXTENSION } from "@/lib/file-signature";
import { STORAGE_BUCKET } from "@/lib/products";
import { removeFolder } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };

function revalidateDocuments(productId?: string | null) {
  revalidatePath("/app/documents");
  if (productId) revalidatePath(`/app/products/${productId}`);
}

export async function uploadDocument(formData: FormData): Promise<ActionState<{ id: string; productId: string | null }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;

  const parsed = documentUploadSchema.safeParse({
    title: formData.get("title") ?? "",
    documentType: formData.get("documentType") ?? "",
    productId: formData.get("productId") ?? "",
    expiresOn: formData.get("expiresOn") ?? "",
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { file: "Elige un archivo." } };
  if (file.size > UPLOAD_MAX_BYTES) return { ok: false, fieldErrors: { file: "El archivo supera 10 MB." } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffUploadType(bytes);
  if (!type) return { ok: false, fieldErrors: { file: "Usa un PDF o una imagen JPG, PNG o WEBP." } };

  const id = randomUUID();
  const path = `${user.id}/documents/${id}/file.${UPLOAD_EXTENSION[type]}`;
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false });
  if (uploadError) return { ok: false, message: "No pudimos subir el archivo. Inténtalo de nuevo." };

  const { error } = await supabase.from("documents").insert({
    id,
    user_id: user.id,
    title: parsed.data.title,
    document_type: parsed.data.documentType,
    product_id: parsed.data.productId,
    expires_on: parsed.data.expiresOn,
    storage_path: path,
    mime_type: type,
    size_bytes: bytes.length,
  });
  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    return {
      ok: false,
      message: error.code === "23503" ? "El producto elegido ya no existe." : "No pudimos guardar el documento.",
    };
  }

  revalidateDocuments(parsed.data.productId);
  return { ok: true, message: "Documento guardado.", data: { id, productId: parsed.data.productId } };
}

export async function deleteDocument(id: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const docId = z.uuid().safeParse(id);
  if (!docId.success) return { ok: false, message: "Documento no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId.data)
    .eq("user_id", user.id)
    .select("id, product_id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar el documento." };

  await removeFolder(`${user.id}/documents/${data.id}`);
  revalidateDocuments(data.product_id);
  return { ok: true, message: "Documento eliminado." };
}
