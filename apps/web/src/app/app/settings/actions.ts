"use server";

import { profileUpdateSchema } from "@orvelia/schemas";
import { revalidatePath } from "next/cache";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: unknown): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      preferred_language: parsed.data.preferredLanguage,
      preferred_currency: parsed.data.preferredCurrency,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id); // ownership check in addition to RLS

  if (error) return { ok: false, message: "No pudimos guardar los cambios. Inténtalo de nuevo." };

  revalidatePath("/app", "layout");
  return { ok: true, message: "Cambios guardados." };
}
