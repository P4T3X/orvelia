import { describe, expect, it } from "vitest";
import { notificationPrefsSchema, reminderInputSchema, returnDeadlineInputSchema, warrantyInputSchema, zonedToUtc } from "./automation";

describe("warrantyInputSchema", () => {
  const base = { kind: "manufacturer", provider: "", startDate: "", endDate: "", coverage: "", sourceDocumentId: "", verification: "manual" };
  it("allows unknown dates (never assumes a standard period)", () => {
    expect(warrantyInputSchema.parse(base)).toMatchObject({ startDate: null, endDate: null });
  });
  it("rejects end before start", () => {
    expect(warrantyInputSchema.safeParse({ ...base, startDate: "2026-03-01", endDate: "2026-02-01" }).success).toBe(false);
  });
  it("does not let users mark data as extracted", () => {
    expect(warrantyInputSchema.safeParse({ ...base, verification: "extracted" }).success).toBe(false);
  });
});

describe("returnDeadlineInputSchema", () => {
  it("requires a date", () => {
    expect(returnDeadlineInputSchema.safeParse({ deadlineDate: "", policy: "", sourceDocumentId: "", verification: "manual" }).success).toBe(false);
  });
});

describe("reminderInputSchema", () => {
  it("validates time", () => {
    const base = { title: "Mantenimiento", description: "", date: "2026-12-01", time: "09:00", productId: "", recurrence: "yearly", email: true };
    expect(reminderInputSchema.safeParse(base).success).toBe(true);
    expect(reminderInputSchema.safeParse({ ...base, time: "25:00" }).success).toBe(false);
  });
});

describe("notificationPrefsSchema", () => {
  it("dedupes and sorts lead days", () => {
    const r = notificationPrefsSchema.parse({ emailEnabled: true, warrantyLeadDays: [7, 30, 7], returnLeadDays: [], documentLeadDays: [1] });
    expect(r.warrantyLeadDays).toEqual([30, 7]);
  });
});

describe("zonedToUtc", () => {
  it("converts Lima wall time to UTC", () => {
    expect(zonedToUtc("2026-12-01", "09:00", "America/Lima")).toBe("2026-12-01T14:00:00.000Z");
  });
  it("handles DST zones", () => {
    expect(zonedToUtc("2026-07-01", "09:00", "Europe/Madrid")).toBe("2026-07-01T07:00:00.000Z");
    expect(zonedToUtc("2026-01-15", "09:00", "Europe/Madrid")).toBe("2026-01-15T08:00:00.000Z");
  });
});
