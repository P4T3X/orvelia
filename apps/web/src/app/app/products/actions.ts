"use server";

import { productErrorMessage, productToRow } from "@orvelia/api";
import {
  categoryInputSchema,
  PRODUCT_IMAGE_MAX_BYTES,
  productInputSchema,
  productStatusUpdateSchema,
  type ProductData,
} from "@orvelia/schemas";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { EXTENSION_FOR, sniffImageType } from "@/lib/file-signature";
import { STORAGE_BUCKET } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
const idSchema = z.uuid();

const toRow = productToRow;
const dbErrorMessage = productErrorMessage;

function revalidateProducts(id?: string) {
  revalidatePath("/app");
  revalidatePath("/app/products");
  if (id) revalidatePath(`/app/products/${id}`);
}

export async function createProduct(input: unknown): Promise<ActionState<{ id: string }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...toRow(parsed.data), user_id: user.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: dbErrorMessage(error) };

  revalidateProducts();
  return { ok: true, message: "Producto agregado.", data: { id: data.id } };
}

export async function updateProduct(id: unknown, input: unknown): Promise<ActionState<{ id: string }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const productId = idSchema.safeParse(id);
  if (!productId.success) return { ok: false, message: "Producto no válido." };
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(toRow(parsed.data))
    .eq("id", productId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data) return { ok: false, message: "Este producto ya no existe." };

  revalidateProducts(data.id);
  return { ok: true, message: "Cambios guardados.", data: { id: data.id } };
}

export async function updateProductStatus(input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = productStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Estado no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos cambiar el estado." };

  revalidateProducts(parsed.data.id);
  return { ok: true, message: "Estado actualizado." };
}

export async function deleteProduct(id: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const productId = idSchema.safeParse(id);
  if (!productId.success) return { ok: false, message: "Producto no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId.data)
    .eq("user_id", user.id)
    .select("image_path")
    .maybeSingle();
  if (error) return { ok: false, message: "No pudimos eliminar el producto. Inténtalo de nuevo." };
  if (!data) return { ok: false, message: "Este producto ya no existe." };

  // Remove all files under the product's folder (current and orphaned images).
  await removeProductFolder(user.id, productId.data);

  revalidateProducts();
  redirect("/app/products?deleted=1");
}

async function removeProductFolder(userId: string, productId: string) {
  const supabase = await createClient();
  const folder = `${userId}/products/${productId}`;
  const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 100 });
  if (files && files.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }
}

export async function uploadProductImage(formData: FormData): Promise<ActionState<{ path: string }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;

  const productId = idSchema.safeParse(formData.get("productId"));
  const file = formData.get("image");
  if (!productId.success || !(file instanceof File)) return { ok: false, message: "Solicitud no válida." };
  if (file.size === 0) return { ok: false, message: "El archivo está vacío." };
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return { ok: false, message: "La imagen supera 5 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, message: "Usa una imagen JPG, PNG o WEBP." };

  const supabase = await createClient();
  const { data: product, error: readError } = await supabase
    .from("products")
    .select("id, image_path")
    .eq("id", productId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError || !product) return { ok: false, message: "Este producto ya no existe." };

  const path = `${user.id}/products/${product.id}/${randomUUID()}.${EXTENSION_FOR[type]}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false, cacheControl: "3600" });
  if (uploadError) return { ok: false, message: "No pudimos subir la imagen. Inténtalo de nuevo." };

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_path: path })
    .eq("id", product.id)
    .eq("user_id", user.id);
  if (updateError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    return { ok: false, message: "No pudimos guardar la imagen. Inténtalo de nuevo." };
  }

  if (product.image_path) await supabase.storage.from(STORAGE_BUCKET).remove([product.image_path]);

  revalidateProducts(product.id);
  return { ok: true, message: "Foto actualizada.", data: { path } };
}

export async function removeProductImage(id: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const productId = idSchema.safeParse(id);
  if (!productId.success) return { ok: false, message: "Producto no válido." };

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, image_path")
    .eq("id", productId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!product) return { ok: false, message: "Este producto ya no existe." };
  if (!product.image_path) return { ok: true };

  const { error } = await supabase
    .from("products")
    .update({ image_path: null })
    .eq("id", product.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "No pudimos quitar la foto." };
  await supabase.storage.from(STORAGE_BUCKET).remove([product.image_path]);

  revalidateProducts(product.id);
  return { ok: true, message: "Foto eliminada." };
}

export async function createCategory(input: unknown): Promise<ActionState<{ id: string; name: string }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name: parsed.data.name, icon: "tag" })
    .select("id, name")
    .single();
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Ya tienes una categoría con ese nombre." : "No pudimos crear la categoría.",
      fieldErrors: error.code === "23505" ? { name: "Ya tienes una categoría con ese nombre." } : undefined,
    };
  }
  revalidatePath("/app/settings");
  return { ok: true, message: "Categoría creada.", data };
}

export async function deleteCategory(id: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const categoryId = idSchema.safeParse(id);
  if (!categoryId.success) return { ok: false, message: "Categoría no válida." };

  const supabase = await createClient();
  // Products in this category keep existing; their category becomes empty (FK on delete set null).
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar la categoría." };

  revalidatePath("/app/settings");
  revalidateProducts();
  return { ok: true, message: "Categoría eliminada." };
}
