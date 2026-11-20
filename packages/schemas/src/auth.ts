import { z } from "zod";

/**
 * Auth input schemas. Shared by the client (form validation) and the server
 * (authoritative validation inside server actions). Messages are in Spanish
 * for the initial Peruvian market.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Ingresa tu correo electrónico.")
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Ingresa un correo electrónico válido."))
  .transform((v) => v.toLowerCase());

/** 8–72 chars (bcrypt limit), at least one letter and one number. */
export const newPasswordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede superar 72 caracteres.")
  .regex(/[A-Za-z]/, "Incluye al menos una letra.")
  .regex(/[0-9]/, "Incluye al menos un número.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña.").max(72),
});
export type LoginInput = z.input<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Ingresa tu nombre.")
      .max(120, "El nombre es demasiado largo."),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      error: "Debes aceptar los términos y la política de privacidad.",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

/**
 * Only allow relative, same-origin redirect targets after auth to prevent
 * open-redirect attacks. Anything else falls back to the dashboard.
 */
export function safeRedirectPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
