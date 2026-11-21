import { describe, expect, it } from "vitest";
import { createMercadoPagoClient, mapPreapprovalStatus, matchesPrice, type Preapproval } from "./mercadopago";
import { signMercadoPagoWebhook, verifyMercadoPagoSignature } from "./signature";

const secret = "whsec_test";
const now = 1_782_000_000_000;
const ts = String(now / 1000);

describe("verifyMercadoPagoSignature", () => {
  const sig = signMercadoPagoWebhook({ dataId: "ABC123", xRequestId: "req-1", ts, secret });

  it("accepts a valid signature (alphanumeric id signed lower-case)", () => {
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "ABC123", secret, now })).toBe(true);
  });

  it("rejects a tampered id, request id or secret", () => {
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "ABC124", secret, now })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-2", dataId: "ABC123", secret, now })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "ABC123", secret: "other", now })).toBe(false);
  });

  it("rejects stale or malformed signatures", () => {
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "ABC123", secret, now: now + 3_600_000 })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: "ts=1,v1=zz", xRequestId: "req-1", dataId: "ABC123", secret, now })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "ABC123", secret, now })).toBe(false);
  });

  it("matches the documented template", async () => {
    const { createHmac } = await import("node:crypto");
    const v1 = createHmac("sha256", secret).update(`id:abc123;request-id:req-1;ts:${ts};`).digest("hex");
    expect(sig).toBe(`ts=${ts},v1=${v1}`);
  });
});

describe("mapping", () => {
  it("maps preapproval statuses", () => {
    expect(mapPreapprovalStatus("authorized")).toBe("active");
    expect(mapPreapprovalStatus("paused")).toBe("past_due");
    expect(mapPreapprovalStatus("cancelled")).toBe("canceled");
    expect(mapPreapprovalStatus("pending")).toBe("incomplete");
  });

  it("checks amount and currency exactly", () => {
    const p = { id: "1", status: "authorized", auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 19.99, currency_id: "PEN" } } as Preapproval;
    expect(matchesPrice(p, 19.99, "PEN")).toBe(true);
    expect(matchesPrice(p, 29.99, "PEN")).toBe(false);
    expect(matchesPrice(p, 19.99, "USD")).toBe(false);
  });
});

describe("client", () => {
  it("creates a pending monthly preapproval with an idempotency key", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ id: "pre_1", status: "pending", init_point: "https://mp/checkout" }), { status: 201 });
    }) as unknown as typeof fetch;
    const mp = createMercadoPagoClient({ accessToken: "TEST-1", fetch: fake });
    const r = await mp.createPreapproval({ reason: "ORVELIA Plus", externalReference: "x", payerEmail: "a@b.c", amount: 19.99, currency: "PEN", backUrl: "https://app/back", idempotencyKey: "k1" });
    expect(r.init_point).toBe("https://mp/checkout");
    expect(seen!.url).toBe("https://api.mercadopago.com/preapproval");
    const body = JSON.parse(String(seen!.init.body));
    expect(body).toMatchObject({ status: "pending", auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 19.99, currency_id: "PEN" } });
    expect((seen!.init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("k1");
  });
});
