import "server-only";

import { createFixtureExtractor, createGatewayExtractor, type ReceiptExtractor } from "@orvelia/ai";

/**
 * Chooses the receipt extractor from configuration. Business logic only sees
 * the ReceiptExtractor interface.
 *
 *   ORVELIA_AI_PROVIDER=gateway   + ORVELIA_EXTRACTION_MODEL=<provider/model>  (production)
 *   ORVELIA_AI_PROVIDER=fixture   local development and automated tests only
 *   (unset)                       scanner works in manual-entry mode
 */
export function getReceiptExtractor(): ReceiptExtractor | null {
  const provider = process.env.ORVELIA_AI_PROVIDER?.trim();

  if (provider === "gateway") {
    const model = process.env.ORVELIA_EXTRACTION_MODEL?.trim();
    if (!model) {
      console.error("[ai] ORVELIA_AI_PROVIDER=gateway requires ORVELIA_EXTRACTION_MODEL");
      return null;
    }
    return createGatewayExtractor(model);
  }

  if (provider === "fixture") {
    // Never simulate AI in production.
    if (process.env.VERCEL_ENV === "production") {
      console.error("[ai] The fixture extractor is not allowed in production; scanner falls back to manual entry");
      return null;
    }
    return createFixtureExtractor();
  }

  return null;
}
