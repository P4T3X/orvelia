import { describe, expect, it } from "vitest";
import { createFixtureExtractor } from "./providers/fixture";
import { ExtractionError, extractReceipt, type ReceiptExtractor } from "./extractor";
import { sanitizeReceipt, type RawReceipt } from "./receipt";

const TODAY = "2026-11-20";
const base: RawReceipt = {
  isPurchaseDocument: true,
  documentKind: "boleta",
  merchant: "  Tienda   Uno ",
  merchantTaxId: null,
  receiptNumber: "B001-1",
  purchaseDate: "2026-03-14",
  currency: "S/",
  total: 100,
  tax: 15.25,
  items: [{ description: "Producto", quantity: 1, amount: 100 }],
};

describe("sanitizeReceipt", () => {
  it("normalizes whitespace and currency aliases", () => {
    const { data, warnings } = sanitizeReceipt(base, TODAY);
    expect(data.merchant).toBe("Tienda Uno");
    expect(data.currency).toBe("PEN");
    expect(warnings).toEqual([]);
  });

  it("never fills missing values", () => {
    const { data } = sanitizeReceipt({ ...base, merchant: null, total: null, purchaseDate: null }, TODAY);
    expect(data.merchant).toBeNull();
    expect(data.total).toBeNull();
    expect(data.purchaseDate).toBeNull();
  });

  it("drops impossible and future dates with a warning", () => {
    expect(sanitizeReceipt({ ...base, purchaseDate: "2026-02-30" }, TODAY)).toMatchObject({
      data: { purchaseDate: null },
      warnings: ["invalid_date"],
    });
    expect(sanitizeReceipt({ ...base, purchaseDate: "14/03/2026" }, TODAY).warnings).toContain("invalid_date");
    expect(sanitizeReceipt({ ...base, purchaseDate: "2026-12-01" }, TODAY)).toMatchObject({
      data: { purchaseDate: null },
      warnings: ["future_date"],
    });
  });

  it("drops negative amounts and flags tax over total", () => {
    expect(sanitizeReceipt({ ...base, total: -5 }, TODAY)).toMatchObject({ data: { total: null } });
    expect(sanitizeReceipt({ ...base, tax: 500 }, TODAY).warnings).toContain("tax_exceeds_total");
  });

  it("flags item sums that do not match the total", () => {
    const r = sanitizeReceipt({ ...base, items: [{ description: "A", quantity: 1, amount: 60 }] }, TODAY);
    expect(r.warnings).toContain("items_total_mismatch");
  });

  it("flags unknown currency and non-receipts", () => {
    expect(sanitizeReceipt({ ...base, currency: "$" }, TODAY)).toMatchObject({
      data: { currency: null },
      warnings: ["unknown_currency"],
    });
    expect(sanitizeReceipt({ ...base, isPurchaseDocument: false }, TODAY).warnings).toContain("not_a_receipt");
  });
});

describe("extractReceipt", () => {
  const input = { data: new Uint8Array([1]), mediaType: "image/jpeg" as const, today: TODAY };

  it("validates and sanitizes provider output", async () => {
    const r = await extractReceipt(createFixtureExtractor(), input);
    expect(r.provider).toBe("fixture");
    expect(r.isTest).toBe(true);
    expect(r.data.currency).toBe("PEN");
    expect(r.data.items).toHaveLength(2);
  });

  it("rejects output that does not match the schema", async () => {
    const bad: ReceiptExtractor = { id: "bad", isTest: true, extract: async () => ({ merchant: 42 }) as never };
    await expect(extractReceipt(bad, input)).rejects.toMatchObject({ reason: "invalid_output" });
  });

  it("wraps provider failures", async () => {
    const failing: ReceiptExtractor = {
      id: "x",
      isTest: true,
      extract: async () => {
        throw new Error("503");
      },
    };
    await expect(extractReceipt(failing, input)).rejects.toBeInstanceOf(ExtractionError);
  });
});
