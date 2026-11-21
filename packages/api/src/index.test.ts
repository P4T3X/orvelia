import { describe, expect, it } from "vitest";
import { addMonths, daysUntil, productErrorMessage, productToRow, relativeDays, warrantyCoverage } from "./index";

describe("dates", () => {
  it("adds months and clamps to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-20", 12)).toBe("2027-11-20");
    expect(addMonths("2026-11-20", 24)).toBe("2028-11-20");
  });
  it("counts days and words them", () => {
    expect(daysUntil("2026-11-25", "2026-11-20")).toBe(5);
    expect(relativeDays("2026-11-20", "2026-11-20")).toBe("Hoy");
    expect(relativeDays("2026-11-21", "2026-11-20")).toBe("Mañana");
    expect(relativeDays("2026-11-18", "2026-11-20")).toBe("Hace 2 días");
  });
});

describe("products", () => {
  it("drops the currency when there is no price", () => {
    const row = productToRow({
      name: "TV", brand: null, model: null, categoryId: null, description: null, notes: null,
      purchaseDate: null, purchasePrice: null, currency: "PEN", seller: null, serialNumber: null, status: "active",
    });
    expect(row.currency).toBeNull();
  });
  it("maps the plan limit error", () => {
    expect(productErrorMessage({ message: "product_limit_reached" })).toMatch(/límite de productos/);
  });
});

describe("warranty coverage", () => {
  const today = "2026-11-21";
  it("classifies none, undated, active, ending soon and expired", () => {
    expect(warrantyCoverage(0, null, today)).toEqual({ state: "none" });
    expect(warrantyCoverage(1, null, today)).toEqual({ state: "undated" });
    expect(warrantyCoverage(1, "2027-06-01", today)).toMatchObject({ state: "active", endingSoon: false });
    expect(warrantyCoverage(2, "2026-12-01", today)).toMatchObject({ state: "active", days: 10, endingSoon: true });
    expect(warrantyCoverage(1, "2026-11-21", today)).toMatchObject({ state: "active", days: 0 });
    expect(warrantyCoverage(1, "2026-11-20", today)).toEqual({ state: "expired", endDate: "2026-11-20" });
  });
});
