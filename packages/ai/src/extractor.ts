import { rawReceiptSchema, sanitizeReceipt, type ExtractionWarning, type RawReceipt, type ReceiptExtraction } from "./receipt";

export type ExtractInput = {
  data: Uint8Array;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  /** YYYY-MM-DD in the user's time zone; anchors dates without a year. */
  today: string;
  signal?: AbortSignal;
};

/**
 * Provider-independent contract. Business logic depends on this interface
 * only; concrete providers live in their own modules.
 */
export interface ReceiptExtractor {
  /** e.g. "gateway:anthropic/…" or "fixture" — recorded for traceability. */
  readonly id: string;
  readonly isTest: boolean;
  extract(input: ExtractInput): Promise<RawReceipt>;
}

export type ExtractionResult = {
  data: ReceiptExtraction;
  warnings: ExtractionWarning[];
  provider: string;
  isTest: boolean;
  extractedAt: string;
};

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid_output" | "provider_error" | "timeout",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Run an extractor, validate its output with Zod and sanitize it. */
export async function extractReceipt(extractor: ReceiptExtractor, input: ExtractInput): Promise<ExtractionResult> {
  let raw: unknown;
  try {
    raw = await extractor.extract(input);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    throw new ExtractionError(
      error instanceof Error ? error.message : "Unknown provider error",
      aborted ? "timeout" : "provider_error",
    );
  }

  const parsed = rawReceiptSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractionError("Model output failed schema validation", "invalid_output");

  const { data, warnings } = sanitizeReceipt(parsed.data, input.today);
  return { data, warnings, provider: extractor.id, isTest: extractor.isTest, extractedAt: new Date().toISOString() };
}

export const RECEIPT_INSTRUCTIONS = `You read purchase receipts (boletas, facturas, tickets, invoices), mostly from Peru.
Return ONLY values that are printed in the document.
- If a value is not printed, unreadable or ambiguous, return null. Never guess, infer or compute missing values.
- Copy names and numbers exactly as printed (fix only whitespace).
- Dates: YYYY-MM-DD. Peruvian documents print day/month/year.
- Amounts: plain numbers with a dot as decimal separator, no currency symbols or thousands separators.
- "S/" means PEN. "US$" means USD.
- Items: one entry per printed line item; leave quantity or amount null if not printed.
- If the file is not a purchase document, set isPurchaseDocument to false and the other fields to null.`;
