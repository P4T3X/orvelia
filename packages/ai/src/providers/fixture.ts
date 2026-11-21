import type { ReceiptExtractor } from "../extractor";

/**
 * Deterministic extractor for local development and automated tests.
 * It does not read the file. The app labels its results as test data and
 * refuses to create it in production (see apps/web/src/lib/ai.ts).
 */
export type FixtureMode = "ok" | "error" | "flaky" | "invalid" | "auth";

/**
 * Failure modes exist so tests can exercise real failure handling:
 *   error   every call fails like a provider outage (HTTP 503)
 *   flaky   every other call fails, so one automatic retry succeeds
 *   invalid returns output that fails schema validation
 *   auth    fails like a missing/invalid credential (HTTP 401)
 */
export function createFixtureExtractor(mode: FixtureMode = "ok"): ReceiptExtractor {
  let calls = 0;
  return {
    id: "fixture",
    isTest: true,
    async extract() {
      calls++;
      if (mode === "error" || (mode === "flaky" && calls % 2 === 1)) {
        throw Object.assign(new Error("Fixture provider unavailable"), { statusCode: 503 });
      }
      if (mode === "auth") throw Object.assign(new Error("Fixture credentials rejected"), { statusCode: 401 });
      if (mode === "invalid") return { unexpected: true } as never;
      return {
        isPurchaseDocument: true,
        documentKind: "boleta",
        merchant: "Tienda de prueba S.A.C.",
        merchantTaxId: "20000000001",
        receiptNumber: "B001-000123",
        purchaseDate: "2026-11-02",
        currency: "S/",
        total: 1338.0,
        tax: 204.1,
        items: [
          { description: "Audífonos inalámbricos con cancelación de ruido", quantity: 1, amount: 1199.0 },
          { description: "Funda protectora", quantity: 1, amount: 139.0 },
        ],
      };
    },
  };
}
