"use server";

import { classifyProviderError, ExtractionError, extractReceiptWithRetry, type ExtractionResult } from "@orvelia/ai";
import { UPLOAD_MAX_BYTES } from "@orvelia/domain";
import { receiptConfirmSchema } from "@orvelia/schemas";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getReceiptExtractor } from "@/lib/ai";
import { getProfile, getUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { isHeic, sniffUploadType, UPLOAD_EXTENSION, type UploadType } from "@/lib/file-signature";
import { STORAGE_BUCKET } from "@/lib/products";
import { downloadBytes, removeFolder } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
const idSchema = z.uuid();
/** A reading that started this long ago without finishing is considered abandoned. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

const FAILURE_MESSAGE: Record<string, string> = {
  timeout: "La lectura tardó demasiado.",
  invalid_output: "La lectura devolvió datos que no pudimos validar.",
  provider_error: "El servicio de lectura no respondió.",
  configuration: "La lectura automática no está configurada correctamente. Avisamos al equipo.",
  file_missing: "No encontramos el archivo del comprobante.",
};

function revalidateReceipts(id?: string) {
  revalidatePath("/app");
  revalidatePath("/app/scanner");
  revalidatePath("/app/documents");
  if (id) revalidatePath(`/app/scanner/${id}`);
}

export async function uploadReceipt(formData: FormData): Promise<ActionState<{ id: string }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige un archivo." };
  if (file.size > UPLOAD_MAX_BYTES) return { ok: false, message: "El archivo supera 10 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffUploadType(bytes);
  if (!type) {
    return {
      ok: false,
      message: isHeic(bytes)
        ? "Esta foto está en formato HEIC. Elige “Tomar foto” o guárdala como JPG e inténtalo de nuevo."
        : "Usa una foto (JPG, PNG o WEBP) o un PDF.",
    };
  }

  const id = randomUUID();
  const path = `${user.id}/receipts/${id}/original.${UPLOAD_EXTENSION[type]}`;
  const supabase = await createClient();

  const { error: insertError } = await supabase.from("receipts").insert({
    id,
    user_id: user.id,
    storage_path: path,
    mime_type: type,
    size_bytes: bytes.length,
    processing_status: "uploaded",
  });
  if (insertError) return { ok: false, message: "No pudimos registrar el comprobante. Inténtalo de nuevo." };

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false });
  if (uploadError) {
    await supabase.from("receipts").delete().eq("id", id).eq("user_id", user.id);
    return { ok: false, message: "No pudimos subir el archivo. Inténtalo de nuevo." };
  }

  revalidateReceipts();
  return { ok: true, data: { id } };
}

export type ProcessOutcome = "extracted" | "manual" | "limit" | "retry_limit" | "failed" | "busy" | "done";

export async function processReceipt(id: unknown): Promise<ActionState<{ outcome: ProcessOutcome }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const receiptId = idSchema.safeParse(id);
  if (!receiptId.success) return { ok: false, message: "Comprobante no válido." };

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, processing_status, storage_path, mime_type, updated_at")
    .eq("id", receiptId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!receipt) return { ok: false, message: "Este comprobante ya no existe." };

  if (receipt.processing_status === "confirmed" || receipt.processing_status === "needs_review") {
    return { ok: true, data: { outcome: "done" } };
  }
  if (
    receipt.processing_status === "processing" &&
    Date.now() - new Date(receipt.updated_at).getTime() < STALE_PROCESSING_MS
  ) {
    return { ok: true, data: { outcome: "busy" } };
  }

  const setStatus = (values: {
    processing_status: "processing" | "needs_review" | "failed";
    extraction?: ExtractionResult | null;
    processing_error?: string | null;
    processing_error_code?: string | null;
  }) =>
    supabase
      .from("receipts")
      .update(values as never)
      .eq("id", receipt.id)
      .eq("user_id", user.id);

  const extractor = getReceiptExtractor();
  if (!extractor) {
    await setStatus({ processing_status: "needs_review", processing_error: null });
    revalidateReceipts(receipt.id);
    return { ok: true, data: { outcome: "manual" } };
  }

  // Reserve a scan from the monthly quota (enforced in the database).
  const { data: usageId, error: reserveError } = await supabase.rpc("reserve_scan", {
    p_receipt_id: receipt.id,
    p_provider: extractor.id,
  });
  if (reserveError || !usageId) {
    if (reserveError?.message.includes("retry_limit_reached")) {
      // Keep the failure visible; the user completes the data by hand.
      revalidateReceipts(receipt.id);
      return { ok: true, data: { outcome: "retry_limit" } };
    }
    const limit = reserveError?.message.includes("scan_limit_reached");
    if (limit) {
      await setStatus({ processing_status: "needs_review", processing_error: null, processing_error_code: null });
      revalidateReceipts(receipt.id);
      return { ok: true, data: { outcome: "limit" } };
    }
    return { ok: false, message: "No pudimos iniciar la lectura. Inténtalo de nuevo." };
  }

  await setStatus({ processing_status: "processing", processing_error: null, processing_error_code: null });

  const finish = (succeeded: boolean) =>
    supabase.rpc("finish_scan", { p_usage_id: usageId, p_succeeded: succeeded });

  try {
    const bytes = receipt.storage_path ? await downloadBytes(receipt.storage_path) : null;
    if (!bytes) {
      await setStatus({ processing_status: "failed", processing_error: FAILURE_MESSAGE.file_missing, processing_error_code: "file_missing" });
      await finish(false);
      revalidateReceipts(receipt.id);
      return { ok: true, data: { outcome: "failed" } };
    }

    const profile = await getProfile(user.id);
    const { tries, ...result } = await extractReceiptWithRetry(extractor, {
      data: bytes,
      mediaType: (receipt.mime_type ?? "image/jpeg") as UploadType,
      today: todayIn(profile?.timezone ?? "America/Lima"),
    });

    if (tries > 1) console.info("[scanner] extraction succeeded after retry", { receiptId: receipt.id, tries });
    await setStatus({ processing_status: "needs_review", extraction: result, processing_error: null, processing_error_code: null });
    await finish(true);
    revalidateReceipts(receipt.id);
    return { ok: true, data: { outcome: "extracted" } };
  } catch (error) {
    const { reason } = error instanceof ExtractionError ? error : classifyProviderError(error);
    console.error("[scanner] extraction failed", { receiptId: receipt.id, reason, provider: extractor.id, error });
    await setStatus({
      processing_status: "failed",
      processing_error: FAILURE_MESSAGE[reason] ?? FAILURE_MESSAGE.provider_error,
      processing_error_code: reason,
    });
    await finish(false);
    revalidateReceipts(receipt.id);
    return { ok: true, data: { outcome: "failed" } };
  }
}

const SOURCE_FIELDS = ["merchant", "receiptNumber", "purchaseDate", "total", "tax", "currency"] as const;

export async function confirmReceipt(
  id: unknown,
  input: unknown,
): Promise<ActionState<{ created: number; limitReached: boolean; firstProductId: string | null }>> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const receiptId = idSchema.safeParse(id);
  if (!receiptId.success) return { ok: false, message: "Comprobante no válido." };
  const parsed = receiptConfirmSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, processing_status, extraction, confirmed_at")
    .eq("id", receiptId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!receipt) return { ok: false, message: "Este comprobante ya no existe." };
  if (receipt.processing_status === "processing" || receipt.processing_status === "uploaded") {
    return { ok: false, message: "Espera a que termine la lectura del comprobante." };
  }

  // Provenance is computed on the server from the stored extraction, not trusted from the client.
  const extracted = (receipt.extraction as ExtractionResult | null)?.data;
  const submitted: Record<(typeof SOURCE_FIELDS)[number], string | null> = {
    merchant: d.merchant,
    receiptNumber: d.receiptNumber,
    purchaseDate: d.purchaseDate,
    total: d.total,
    tax: d.tax,
    currency: d.total === null && d.tax === null ? null : d.currency,
  };
  const fromExtraction: Record<string, string | null> = {
    merchant: extracted?.merchant ?? null,
    receiptNumber: extracted?.receiptNumber ?? null,
    purchaseDate: extracted?.purchaseDate ?? null,
    total: extracted?.total == null ? null : extracted.total.toFixed(2),
    tax: extracted?.tax == null ? null : extracted.tax.toFixed(2),
    currency: extracted?.currency ?? null,
  };
  const fieldSources: Record<string, "extracted" | "manual"> = {};
  for (const f of SOURCE_FIELDS) {
    if (submitted[f] === null) continue;
    fieldSources[f] = fromExtraction[f] !== null && fromExtraction[f] === submitted[f] ? "extracted" : "manual";
  }

  const { error: updateError } = await supabase
    .from("receipts")
    .update({
      merchant: d.merchant,
      receipt_number: d.receiptNumber,
      purchase_date: d.purchaseDate,
      total_amount: d.total,
      tax_amount: d.tax,
      currency: submitted.currency,
      field_sources: fieldSources,
      processing_status: "confirmed",
      confirmed_at: receipt.confirmed_at ?? new Date().toISOString(),
      processing_error: null,
    })
    .eq("id", receipt.id)
    .eq("user_id", user.id);
  if (updateError) return { ok: false, message: "No pudimos guardar el comprobante. Inténtalo de nuevo." };

  if (d.linkProductIds.length > 0) {
    await supabase
      .from("products")
      .update({ receipt_id: receipt.id })
      .in("id", d.linkProductIds)
      .eq("user_id", user.id);
  }

  let created = 0;
  let limitReached = false;
  let firstProductId: string | null = d.linkProductIds[0] ?? null;
  for (const p of d.newProducts) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        user_id: user.id,
        name: p.name,
        purchase_price: p.price,
        currency: p.price === null ? null : d.currency,
        purchase_date: d.purchaseDate,
        seller: d.merchant,
        receipt_id: receipt.id,
        status: "active",
      })
      .select("id")
      .single();
    if (error) {
      if (error.message.includes("product_limit_reached")) limitReached = true;
      break;
    }
    created++;
    firstProductId ??= data.id;
  }

  revalidateReceipts(receipt.id);
  revalidatePath("/app/products");
  return {
    ok: true,
    message: "Comprobante guardado.",
    data: { created, limitReached, firstProductId },
  };
}

export async function deleteReceipt(id: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const receiptId = idSchema.safeParse(id);
  if (!receiptId.success) return { ok: false, message: "Comprobante no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .delete()
    .eq("id", receiptId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos eliminar el comprobante." };

  // Products keep existing; their receipt link is cleared by the foreign key.
  await removeFolder(`${user.id}/receipts/${data.id}`);
  revalidateReceipts();
  revalidatePath("/app/products");
  redirect("/app/scanner?deleted=1");
}
