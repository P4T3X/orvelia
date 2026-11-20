import { describe, expect, it } from "vitest";
import { normalizeSearch, parsePrice, productFiltersSchema, productInputSchema } from "./product";

const base = {
  name: "Cámara mirrorless",
  brand: "",
  model: "",
  categoryId: "",
  description: "",
  notes: "",
  purchaseDate: "",
  purchasePrice: "",
  currency: "PEN",
  seller: "",
  serialNumber: "",
  status: "active",
};

describe("parsePrice", () => {
  it.each([
    ["8499", "8499.00"],
    ["8499.9", "8499.90"],
    ["8 499,90", "8499.90"],
    ["8,499.90", "8499.90"],
    ["S/ 120", "120.00"],
    ["", null],
  ])("parses %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each(["abc", "-5", "1.234", "12.345,67.8"])("rejects %s", (input) => {
    expect(parsePrice(input)).toBeUndefined();
  });
});

describe("productInputSchema", () => {
  it("turns empty optional fields into null", () => {
    const r = productInputSchema.parse(base);
    expect(r).toMatchObject({ brand: null, categoryId: null, purchaseDate: null, purchasePrice: null });
  });

  it("requires a name", () => {
    expect(productInputSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });

  it("rejects future purchase dates", () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(productInputSchema.safeParse({ ...base, purchaseDate: future }).success).toBe(false);
  });

  it("rejects invalid category ids and statuses", () => {
    expect(productInputSchema.safeParse({ ...base, categoryId: "x" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, status: "lost" }).success).toBe(false);
  });

  it("normalizes price", () => {
    expect(productInputSchema.parse({ ...base, purchasePrice: "1,299.5" }).purchasePrice).toBe("1299.50");
  });
});

describe("productFiltersSchema", () => {
  it("falls back on invalid values instead of failing", () => {
    const r = productFiltersSchema.parse({ status: "nope", sort: "drop table", page: "-3", category: "x" });
    expect(r).toEqual({ q: undefined, status: undefined, sort: undefined, page: undefined, category: undefined });
  });

  it("normalizes the search term", () => {
    expect(productFiltersSchema.parse({ q: "  CÁMARA   Sony " }).q).toBe("camara sony");
    expect(normalizeSearch("Ñandú")).toBe("nandu");
  });
});
