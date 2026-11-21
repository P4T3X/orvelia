import { afterEach, describe, expect, it, vi } from "vitest";
import { greeting, KIND, PLAN_NAMES } from "./labels";

afterEach(() => vi.useRealTimers());

describe("labels", () => {
  it("greets by time of day with the first name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 21, 9, 0));
    expect(greeting("Ana Torres")).toBe("Buenos días, Ana");
    vi.setSystemTime(new Date(2026, 10, 21, 21, 0));
    expect(greeting(null)).toBe("Buenas noches");
  });
  it("has a label and icon for every upcoming kind and plan", () => {
    expect(Object.keys(KIND).sort()).toEqual(["document", "maintenance", "reminder", "return", "warranty"]);
    expect(PLAN_NAMES.ultra).toBe("Ultra");
  });
});
