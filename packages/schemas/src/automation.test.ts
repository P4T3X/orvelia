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

import { describeInterval, maintenanceNextDate } from "@orvelia/domain";
import { maintenanceDoneSchema, maintenancePlanSchema } from "./automation";

describe("maintenance", () => {
  const plan = { title: "Cambio de aceite", intervalCount: "6", intervalUnit: "months", nextDueDate: "2026-12-01", leadDays: "7", notes: "" };

  it("accepts a plan and converts numbers", () => {
    const r = maintenancePlanSchema.parse(plan);
    expect(r).toMatchObject({ intervalCount: 6, leadDays: 7, notes: null });
  });

  it("rejects bad intervals and units", () => {
    expect(maintenancePlanSchema.safeParse({ ...plan, intervalCount: "0" }).success).toBe(false);
    expect(maintenancePlanSchema.safeParse({ ...plan, intervalCount: "2.5" }).success).toBe(false);
    expect(maintenancePlanSchema.safeParse({ ...plan, intervalUnit: "hours" }).success).toBe(false);
    expect(maintenancePlanSchema.safeParse({ ...plan, leadDays: "91" }).success).toBe(false);
  });

  it("completion: no future dates, optional cost", () => {
    const ok = { performedOn: "2026-11-01", cost: "", currency: "PEN", provider: "", notes: "" };
    expect(maintenanceDoneSchema.parse(ok).cost).toBeNull();
    expect(maintenanceDoneSchema.parse({ ...ok, cost: "150" }).cost).toBe("150.00");
    expect(maintenanceDoneSchema.safeParse({ ...ok, performedOn: "2999-01-01" }).success).toBe(false);
  });

  it("interval math and labels", () => {
    expect(maintenanceNextDate("2026-01-31", 1, "months")).toBe("2026-02-28");
    expect(maintenanceNextDate("2026-11-21", 2, "weeks")).toBe("2026-12-05");
    expect(maintenanceNextDate("2024-02-29", 1, "years")).toBe("2025-02-28");
    expect(describeInterval(1, "weeks")).toBe("Cada semana");
    expect(describeInterval(6, "months")).toBe("Cada 6 meses");
  });
});
