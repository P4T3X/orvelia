"use server";

import { feedbackSchema } from "@orvelia/schemas";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Beta feedback from inside the app (10 per person per day, enforced in the database). */
export async function sendFeedback(input: unknown): Promise<ActionState> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const user = await getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, kind: parsed.data.kind, message: parsed.data.message, page: parsed.data.page ?? null });
  if (error) {
    if (error.message.includes("feedback_rate_limited")) {
      return { ok: false, message: "Ya nos enviaste varios comentarios hoy. ¡Gracias! Inténtalo mañana." };
    }
    console.error("[feedback] insert failed", error.message);
    return { ok: false, message: "No pudimos enviar tu comentario. Inténtalo de nuevo." };
  }
  return { ok: true, message: "¡Gracias! Leemos cada comentario." };
}
