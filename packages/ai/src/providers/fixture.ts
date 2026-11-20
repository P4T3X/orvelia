import type { ReceiptExtractor } from "../extractor";

/**
 * Deterministic extractor for local development and automated tests.
 * It does not read the file. The app labels its results as test data and
 * refuses to create it in production (see apps/web/src/lib/ai.ts).
 */
export function createFixtureExtractor(): ReceiptExtractor {
  return {
    id: "fixture",
    isTest: true,
    async extract() {
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
