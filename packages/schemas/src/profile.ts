import { z } from "zod";
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "@orvelia/domain";

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ingresa tu nombre.")
    .max(120, "El nombre es demasiado largo."),
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES, "Idioma no válido."),
  preferredCurrency: z.enum(SUPPORTED_CURRENCIES, "Moneda no válida."),
  timezone: z
    .string()
    .trim()
    .min(1, "Selecciona una zona horaria.")
    .max(64)
    .refine(isValidTimeZone, "Zona horaria no válida."),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
