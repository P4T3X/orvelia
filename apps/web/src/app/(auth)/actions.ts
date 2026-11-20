"use server";

import {
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "@orvelia/schemas";
import { redirect } from "next/navigation";
import { authErrorMessage, fromZodError, type ActionState } from "@/lib/action-state";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED: ActionState = {
  ok: false,
  message: "La autenticación aún no está configurada en este entorno.",
};

const confirmUrl = (next: string) =>
  `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function signIn(input: unknown, next?: string): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, message: authErrorMessage(error.code, "No pudimos iniciar sesión. Inténtalo de nuevo.") };
  }

  redirect(safeRedirectPath(next));
}

export async function signUp(input: unknown): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password, fullName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: confirmUrl("/app"),
    },
  });
  if (error) {
    return { ok: false, message: authErrorMessage(error.code, "No pudimos crear tu cuenta. Inténtalo de nuevo.") };
  }

  // Email confirmation disabled in the project → session already exists.
  if (data.session) redirect("/app");

  return { ok: true, message: email };
}

export async function resendConfirmation(email: unknown): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, message: "Correo no válido." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: confirmUrl("/app") },
  });
  if (error) {
    return { ok: false, message: authErrorMessage(error.code, "No pudimos reenviar el correo.") };
  }
  return { ok: true, message: "Te enviamos un nuevo enlace de confirmación." };
}

export async function requestPasswordReset(input: unknown): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl("/reset-password"),
  });

  // Only rate limiting is surfaced. Any other outcome returns the same message
  // so the form cannot be used to discover which emails have accounts.
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { ok: false, message: authErrorMessage(error.code, "") };
  }
  return {
    ok: true,
    message: "Si existe una cuenta con ese correo, recibirás un enlace para crear una nueva contraseña.",
  };
}

export async function updatePassword(input: unknown): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, message: "El enlace expiró. Solicita uno nuevo para cambiar tu contraseña." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, message: authErrorMessage(error.code, "No pudimos actualizar tu contraseña.") };
  }
  redirect("/app?password=updated");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
