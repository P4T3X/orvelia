"use server";

import { returnDeadlineInputSchema, warrantyInputSchema } from "@orvelia/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
const id = z.uuid();

function refresh(productId: string) {
  revalidatePath(`/app/products/${productId}`);
  revalidatePath("/app");
  revalidatePath("/app/calendar");
}

function dbError(error: { code?: string }) {
  return error.code === "23503"
    ? "El producto o el documento elegido ya no existe."
    : "No pudimos guardar los cambios. Inténtalo de nuevo.";
}

export async function saveWarranty(productId: unknown, warrantyId: unknown, input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  if (!pid.success) return { ok: false, message: "Producto no válido." };
  const parsed = warrantyInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const values = {
    kind: d.kind,
    provider: d.provider,
    start_date: d.startDate,
    end_date: d.endDate,
    coverage_description: d.coverage,
    source_document_id: d.sourceDocumentId,
    verification_status: d.verification,
  };

  const supabase = await createClient();
  if (warrantyId) {
    const wid = id.safeParse(warrantyId);
    if (!wid.success) return { ok: false, message: "Garantía no válida." };
    const { data, error } = await supabase
      .from("warranties")
      .update(values)
      .eq("id", wid.data)
      .eq("product_id", pid.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: dbError(error) };
    if (!data) return { ok: false, message: "Esta garantía ya no existe." };
  } else {
    // The composite FK guarantees the product belongs to this user.
    const { error } = await supabase.from("warranties").insert({ ...values, user_id: user.id, product_id: pid.data });
    if (error) return { ok: false, message: dbError(error) };
  }

  refresh(pid.data);
  return { ok: true, message: warrantyId ? "Garantía actualizada." : "Garantía registrada." };
}

export async function deleteWarranty(productId: unknown, warrantyId: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  const wid = id.safeParse(warrantyId);
  if (!pid.success || !wid.success) return { ok: false, message: "Solicitud no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warranties")
    .delete()
    .eq("id", wid.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar la garantía." };
  refresh(pid.data);
  return { ok: true, message: "Garantía eliminada." };
}

export async function saveReturnDeadline(productId: unknown, returnId: unknown, input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  if (!pid.success) return { ok: false, message: "Producto no válido." };
  const parsed = returnDeadlineInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const values = {
    deadline_date: d.deadlineDate,
    policy_details: d.policy,
    source_document_id: d.sourceDocumentId,
    verification_status: d.verification,
  };

  const supabase = await createClient();
  if (returnId) {
    const rid = id.safeParse(returnId);
    if (!rid.success) return { ok: false, message: "Plazo no válido." };
    const { data, error } = await supabase
      .from("return_deadlines")
      .update(values)
      .eq("id", rid.data)
      .eq("product_id", pid.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: dbError(error) };
    if (!data) return { ok: false, message: "Este plazo ya no existe." };
  } else {
    const { error } = await supabase.from("return_deadlines").insert({ ...values, user_id: user.id, product_id: pid.data });
    if (error) return { ok: false, message: dbError(error) };
  }

  refresh(pid.data);
  return { ok: true, message: returnId ? "Plazo actualizado." : "Plazo de devolución registrado." };
}

export async function deleteReturnDeadline(productId: unknown, returnId: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const pid = id.safeParse(productId);
  const rid = id.safeParse(returnId);
  if (!pid.success || !rid.success) return { ok: false, message: "Solicitud no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("return_deadlines")
    .delete()
    .eq("id", rid.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar el plazo." };
  refresh(pid.data);
  return { ok: true, message: "Plazo eliminado." };
}
