import { z } from "zod";

export const familyNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe un nombre para la familia.")
    .max(60, "Usa como máximo 60 caracteres."),
});
export type FamilyNameInput = z.input<typeof familyNameSchema>;

export const familyInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Ingresa el correo de la persona.")
    .max(254, "Correo demasiado largo.")
    .pipe(z.email("Ingresa un correo electrónico válido.")),
  role: z.enum(["member", "admin"], { error: "Elige un rol." }),
});
export type FamilyInviteInput = z.input<typeof familyInviteSchema>;

/** Invitation tokens: 64 lowercase hex characters. */
export const invitationTokenSchema = z.string().regex(/^[0-9a-f]{64}$/, "Enlace de invitación no válido.");
