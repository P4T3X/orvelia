import { z } from "zod";

export const feedbackSchema = z.object({
  kind: z.enum(["idea", "problem", "other"], { error: "Elige un tipo." }),
  message: z
    .string()
    .trim()
    .min(5, "Cuéntanos un poco más (al menos 5 caracteres).")
    .max(2000, "Usa como máximo 2000 caracteres."),
  page: z
    .string()
    .max(200)
    .regex(/^\/[^\s]*$/)
    .optional()
    .catch(undefined),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;
