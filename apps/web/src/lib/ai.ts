import "server-only";

import {
  createFixtureAssistant,
  createFixtureExtractor,
  createGatewayAssistant,
  createGatewayExtractor,
  type AssistantModel,
  type ReceiptExtractor,
} from "@orvelia/ai";

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
    const mode = process.env.ORVELIA_FIXTURE_MODE?.trim();
    return createFixtureExtractor(
      mode === "error" || mode === "flaky" || mode === "invalid" || mode === "auth" ? mode : "ok",
    );
  }

  return null;
}

/**
 * ORVELIA AI. Same provider switch as the scanner:
 *   ORVELIA_AI_PROVIDER=gateway + ORVELIA_ASSISTANT_MODEL (falls back to ORVELIA_EXTRACTION_MODEL)
 *   ORVELIA_AI_PROVIDER=fixture  deterministic test assistant, never in production
 */
export function getAssistantModel(): AssistantModel | null {
  const provider = process.env.ORVELIA_AI_PROVIDER?.trim();
  if (provider === "gateway") {
    const model = (process.env.ORVELIA_ASSISTANT_MODEL ?? process.env.ORVELIA_EXTRACTION_MODEL)?.trim();
    if (!model) {
      console.error("[ai] ORVELIA_AI_PROVIDER=gateway requires ORVELIA_ASSISTANT_MODEL");
      return null;
    }
    return createGatewayAssistant(model);
  }
  if (provider === "fixture") {
    if (process.env.VERCEL_ENV === "production") {
      console.error("[ai] The fixture assistant is not allowed in production");
      return null;
    }
    return createFixtureAssistant();
  }
  return null;
}
