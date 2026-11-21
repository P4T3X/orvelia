import { describe, expect, it } from "vitest";
import { askAssistant, type AssistantModel } from "./assistant";
import { collectRefs, toSegments } from "./answer";
import type { AssistantDataSource } from "./contract";
import { createFixtureAssistant } from "./fixture";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ref = (id: string, label: string) => ({ type: "product" as const, id, label });

describe("toSegments", () => {
  it("links only refs returned by tools and drops the rest", () => {
    const allowed = collectRefs([{ products: [{ ref: ref(A, "Laptop") }] }]);
    const { segments, dropped } = toSegments(`Tu [[product:${A}]] y tu [[product:${B}]].`, allowed);
    expect(dropped).toBe(1);
    expect(segments).toEqual([
      { kind: "text", text: "Tu " },
      { kind: "ref", ref: ref(A, "Laptop") },
      { kind: "text", text: " y tu " },
      { kind: "text", text: "." },
    ]);
  });
});

const data = (over: Partial<AssistantDataSource> = {}): AssistantDataSource => ({
  search_products: async () => ({ products: [], total: 0 }),
  get_product: async () => ({ product: null }),
  list_warranties: async () => ({
    warranties: [{ product: ref(A, "Laptop"), kind: "manufacturer", provider: null, endDate: "2027-01-10", daysLeft: 51, verification: "confirmed" }],
  }),
  upcoming_deadlines: async () => ({ deadlines: [] }),
  spending_summary: async () => ({
    period: { from: null, to: null },
    category: "Electrónica",
    totals: [
      { currency: "PEN", amount: 1500, count: 2 },
      { currency: "USD", amount: 200, count: 1 },
    ],
    groups: [],
    productsWithoutPrice: 1,
  }),
  products_missing_receipts: async () => ({ products: [], total: 0 }),
  recent_purchases: async () => ({ products: [] }),
  list_reminders: async () => ({ reminders: [] }),
  list_maintenance: async () => ({ plans: [] }),
  ...over,
});
const base = { history: [], today: "2026-11-20", timeZone: "America/Lima" };

describe("askAssistant with the fixture", () => {
  it("answers active warranties with a verified link", async () => {
    const a = await askAssistant(createFixtureAssistant(), { ...base, question: "¿Qué garantías tengo activas?", data: data() });
    expect(a.toolsUsed).toEqual(["list_warranties"]);
    expect(a.refs).toEqual([ref(A, "Laptop")]);
    expect(a.isTest).toBe(true);
  });

  it("reports spending per currency without mixing and notes missing prices", async () => {
    const a = await askAssistant(createFixtureAssistant(), { ...base, question: "¿Cuánto gasté en electrónica?", data: data() });
    const text = a.segments.map((s) => (s.kind === "text" ? s.text : "")).join("");
    expect(text).toContain("S/");
    expect(text).toMatch(/(US\$|USD|\$)\s?200\.00/);
    expect(text).toContain("1 sin precio");
  });

  it("says when nothing is found instead of inventing", async () => {
    const a = await askAssistant(createFixtureAssistant(), { ...base, question: "¿Qué vence pronto?", data: data() });
    expect(a.segments).toEqual([{ kind: "text", text: "No tienes vencimientos en los próximos 60 días." }]);
  });
});

describe("askAssistant guards", () => {
  it("drops links the model invents", async () => {
    const lying: AssistantModel = {
      id: "x",
      isTest: true,
      ask: async () => ({ text: `Mira [[product:${B}]]`, toolOutputs: [{ products: [{ ref: ref(A, "Laptop") }] }], toolsUsed: ["search_products"] }),
    };
    const a = await askAssistant(lying, { ...base, question: "x", data: data() });
    expect(a.droppedRefs).toBe(1);
    expect(a.refs).toEqual([]);
  });

  it("rejects empty answers", async () => {
    const empty: AssistantModel = { id: "x", isTest: true, ask: async () => ({ text: " ", toolOutputs: [], toolsUsed: [] }) };
    await expect(askAssistant(empty, { ...base, question: "x", data: data() })).rejects.toMatchObject({ reason: "empty" });
  });
});

describe("maintenance questions", () => {
  it("lists scheduled maintenance with verified links", async () => {
    const d = data({
      list_maintenance: async () => ({
        plans: [
          {
            product: ref(A, "Laptop"),
            title: "Limpieza de filtros",
            every: "Cada 6 meses",
            nextDueDate: "2026-11-10",
            daysLeft: -10,
            lastDoneDate: "2026-05-10",
            spent: [],
          },
        ],
      }),
    });
    const a = await askAssistant(createFixtureAssistant(), { ...base, question: "¿Qué mantenimiento está programado?", data: d });
    const text = a.segments.map((s) => (s.kind === "text" ? s.text : "")).join("");
    expect(a.toolsUsed).toEqual(["list_maintenance"]);
    expect(text).toContain("Limpieza de filtros");
    expect(text).toContain("atrasado");
    expect(a.refs).toEqual([ref(A, "Laptop")]);
  });
});
