"use server";

import { askAssistant, AssistantError, type AnswerSegment, type RecordRef } from "@orvelia/ai";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getAssistantModel } from "@/lib/ai";
import { createAssistantDataSource } from "@/lib/assistant-data";
import { getProfile, getUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  question: z.string().trim().min(2, "Escribe una pregunta.").max(500, "Máximo 500 caracteres."),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(12),
});

export type AssistantReply = { segments: AnswerSegment[]; refs: RecordRef[]; isTest: boolean };

const LIMIT_MESSAGES: Record<string, string> = {
  ai_not_included: "ORVELIA AI no está incluido en tu plan actual.",
  ai_limit_reached: "Usaste todas tus consultas de este mes. El contador se reinicia el primer día del mes.",
  rate_limited: "Hiciste muchas preguntas seguidas. Espera un minuto y vuelve a intentarlo.",
};

export async function askOrvelia(input: unknown): Promise<ActionState<AssistantReply>> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Pregunta no válida." };

  const model = getAssistantModel();
  if (!model) return { ok: false, message: "ORVELIA AI aún no está activo." };

  const supabase = await createClient();
  const { data: usageId, error: reserveError } = await supabase.rpc("reserve_assistant_query", { p_provider: model.id });
  if (reserveError || !usageId) {
    const code = Object.keys(LIMIT_MESSAGES).find((k) => reserveError?.message.includes(k));
    return { ok: false, message: code ? LIMIT_MESSAGES[code] : "No pudimos procesar tu pregunta. Inténtalo de nuevo." };
  }

  const profile = await getProfile(user.id);
  const timeZone = profile?.timezone ?? "America/Lima";
  try {
    const answer = await askAssistant(model, {
      question: parsed.data.question,
      // Only the last turns, as plain text: earlier links are rebuilt from fresh tool calls.
      history: parsed.data.history.slice(-6),
      today: todayIn(timeZone),
      timeZone,
      data: await createAssistantDataSource(user.id, timeZone),
    });
    await supabase.rpc("finish_usage", { p_usage_id: usageId, p_succeeded: true });
    if (answer.droppedRefs > 0) console.warn("[assistant] dropped unverified references", { count: answer.droppedRefs });
    return { ok: true, data: { segments: answer.segments, refs: answer.refs, isTest: answer.isTest } };
  } catch (error) {
    await supabase.rpc("finish_usage", { p_usage_id: usageId, p_succeeded: false });
    console.error("[assistant] failed", error);
    const timeout = error instanceof AssistantError && error.reason === "timeout";
    return {
      ok: false,
      message: timeout
        ? "La respuesta tardó demasiado. Inténtalo de nuevo; esta consulta no cuenta para tu límite."
        : "No pudimos responder ahora. Inténtalo de nuevo; esta consulta no cuenta para tu límite.",
    };
  }
}
