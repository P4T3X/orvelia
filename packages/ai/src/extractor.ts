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

export type ExtractionFailure = "invalid_output" | "provider_error" | "timeout" | "configuration";

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly reason: ExtractionFailure,
    /** Worth trying again (temporary outage, timeout, malformed output). */
    readonly retryable = reason !== "configuration",
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
    throw classifyProviderError(error);
  }

  const parsed = rawReceiptSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractionError("Model output failed schema validation", "invalid_output");

  const { data, warnings } = sanitizeReceipt(parsed.data, input.today);
  return { data, warnings, provider: extractor.id, isTest: extractor.isTest, extractedAt: new Date().toISOString() };
}

/**
 * Map any provider failure onto our failure kinds. Authentication and
 * permission errors mean the integration is misconfigured: retrying won't help.
 */
export function classifyProviderError(error: unknown): ExtractionError {
  if (error instanceof ExtractionError) return error;
  const e = error as { name?: string; message?: string; statusCode?: number; cause?: unknown } | null;
  const message = e?.message ?? "Unknown provider error";
  if (e?.name === "AbortError" || e?.name === "TimeoutError") return new ExtractionError(message, "timeout");
  const status = e?.statusCode ?? (e?.cause as { statusCode?: number } | undefined)?.statusCode;
  if (status === 401 || status === 403 || e?.name === "GatewayAuthenticationError" || e?.name === "LoadAPIKeyError") {
    return new ExtractionError(message, "configuration");
  }
  if (e?.name === "AI_NoObjectGeneratedError" || e?.name === "NoObjectGeneratedError") {
    return new ExtractionError(message, "invalid_output");
  }
  return new ExtractionError(message, "provider_error");
}

export type RetryOptions = {
  /** Total tries inside one request, including the first. Default 2. */
  maxTries?: number;
  /** Wait before the second try; doubles after that. Default 1500 ms. */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * extractReceipt with bounded retries for temporary failures. Configuration
 * errors fail immediately. Each try still validates the output with Zod; a
 * result is never produced unless a provider actually returned it.
 */
export async function extractReceiptWithRetry(
  extractor: ReceiptExtractor,
  input: ExtractInput,
  { maxTries = 2, baseDelayMs = 1500, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: RetryOptions = {},
): Promise<ExtractionResult & { tries: number }> {
  let lastError: ExtractionError | undefined;
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      const result = await extractReceipt(extractor, input);
      return { ...result, tries: attempt };
    } catch (error) {
      lastError = classifyProviderError(error);
      if (!lastError.retryable || attempt === maxTries || input.signal?.aborted) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError ?? new ExtractionError("Extraction failed", "provider_error");
}

export const RECEIPT_INSTRUCTIONS = `You read purchase receipts (boletas, facturas, tickets, invoices), mostly from Peru.
Return ONLY values that are printed in the document.
- If a value is not printed, unreadable or ambiguous, return null. Never guess, infer or compute missing values.
- Copy names and numbers exactly as printed (fix only whitespace).
- Dates: YYYY-MM-DD. Peruvian documents print day/month/year.
- Amounts: plain numbers with a dot as decimal separator, no currency symbols or thousands separators.
- "S/" means PEN. "US$" means USD.
- Items: one entry per printed line item; leave quantity or amount null if not printed.
- Warranty and return terms: fill them ONLY from text printed on the document. Most receipts print none; then return null. Never use a typical or legal default.
- If the file is not a purchase document, set isPurchaseDocument to false and the other fields to null.`;
