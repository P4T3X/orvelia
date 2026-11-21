/** Must stay in sync with the `document_type` enum. */
export const DOCUMENT_TYPES = ["receipt", "invoice", "warranty", "manual", "insurance", "certificate", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  receipt: "Comprobante",
  invoice: "Factura",
  warranty: "Garantía",
  manual: "Manual",
  insurance: "Seguro",
  certificate: "Certificado",
  other: "Otro",
};

/** Must stay in sync with the `processing_status` enum. */
export const PROCESSING_STATUSES = ["uploaded", "processing", "needs_review", "confirmed", "failed"] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  uploaded: "Subido",
  processing: "Leyendo",
  needs_review: "Por revisar",
  confirmed: "Confirmado",
  failed: "Error",
};

/** Accepted upload formats for receipts and documents. */
export const UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
/** Failed automatic readings allowed per receipt (mirrors public.max_failed_scans_per_receipt()). */
export const MAX_FAILED_SCANS_PER_RECEIPT = 3;
