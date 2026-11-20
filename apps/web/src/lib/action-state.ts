import type { z } from "zod";

/** Uniform result shape for server actions consumed by forms. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export function fromZodError(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, message: "Revisa los campos marcados.", fieldErrors };
}

/** Map Supabase Auth error codes to user-facing Spanish copy. */
export function authErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "El correo o la contraseña no son correctos.";
    case "email_not_confirmed":
      return "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.";
    case "weak_password":
      return "La contraseña es demasiado débil. Usa una más larga y difícil de adivinar.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la actual.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    case "session_not_found":
    case "session_expired":
      return "Tu sesión expiró. Vuelve a solicitar el enlace.";
    default:
      return fallback;
  }
}
