import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Mercado Pago webhook.
 * x-signature: "ts=<timestamp>,v1=<hex hmac>"
 * Signed template: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" — a pair is
 * omitted when its value is missing. HMAC-SHA256 (hex) with the webhook secret.
 * `data.id` comes from the query string; alphanumeric ids are signed lower-case,
 * so both forms are accepted.
 */
export function verifyMercadoPagoSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  /** Reject notifications older than this (seconds). Default 15 minutes. */
  toleranceSeconds?: number;
  now?: number;
}): boolean {
  if (!input.xSignature || !input.secret) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k?.trim() ?? "", v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  // ts may be seconds or milliseconds.
  const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  const tolerance = (input.toleranceSeconds ?? 15 * 60) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs((input.now ?? Date.now()) - tsMs) > tolerance) return false;

  const candidates = new Set([input.dataId, input.dataId?.toLowerCase()]);
  for (const id of candidates) {
    let manifest = "";
    if (id) manifest += `id:${id};`;
    if (input.xRequestId) manifest += `request-id:${input.xRequestId};`;
    manifest += `ts:${ts};`;
    const expected = createHmac("sha256", input.secret).update(manifest).digest();
    const got = Buffer.from(v1, "hex");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return true;
  }
  return false;
}

/** Builds a valid signature (tests and local simulators). */
export function signMercadoPagoWebhook(input: { dataId: string; xRequestId: string; ts: string; secret: string }) {
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.xRequestId};ts:${input.ts};`;
  return `ts=${input.ts},v1=${createHmac("sha256", input.secret).update(manifest).digest("hex")}`;
}
