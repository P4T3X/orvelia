import { generateText, Output } from "ai";
import { RECEIPT_INSTRUCTIONS, type ExtractInput, type ReceiptExtractor } from "../extractor";
import { rawReceiptSchema } from "../receipt";

/**
 * Extractor backed by the AI SDK. A string model id ("provider/model") is
 * resolved through the Vercel AI Gateway, so switching provider is a config
 * change (ORVELIA_EXTRACTION_MODEL), not a code change.
 * Auth: AI_GATEWAY_API_KEY locally, or the project's OIDC token on Vercel.
 */
export function createGatewayExtractor(modelId: string, timeoutMs = 45_000): ReceiptExtractor {
  return {
    id: `gateway:${modelId}`,
    isTest: false,
    async extract({ data, mediaType, today, signal }: ExtractInput) {
      const { output } = await generateText({
        model: modelId,
        instructions: RECEIPT_INSTRUCTIONS,
        output: Output.object({ schema: rawReceiptSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Today is ${today}. Extract the purchase data from this document.` },
              { type: "file", mediaType, data },
            ],
          },
        ],
        temperature: 0,
        // One transport-level retry here; extractReceiptWithRetry adds one more for timeouts and bad output.
        maxRetries: 1,
        timeout: timeoutMs,
        abortSignal: signal,
      });
      return output;
    },
  };
}
