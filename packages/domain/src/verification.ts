/**
 * Where a piece of warranty / return information came from and how much it
 * can be trusted. ORVELIA never assumes standard warranty or return periods.
 * Must stay in sync with the `verification_status` enum in the database.
 */
export const VERIFICATION_STATUSES = [
  "extracted", // read from a document by OCR/AI, not yet reviewed
  "manual", // typed in by the user
  "confirmed", // reviewed and confirmed by the user
  "needs_verification", // incomplete or conflicting, must be checked
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  extracted: "Extraído de documento",
  manual: "Ingresado manualmente",
  confirmed: "Confirmado",
  needs_verification: "Requiere verificación",
};
