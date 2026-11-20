import "server-only";

/**
 * Transactional email through Resend's HTTP API. Returns "skipped" when email
 * is not configured — never pretends a message was sent.
 */
export type EmailResult = { status: "sent" } | { status: "skipped" } | { status: "failed"; error: string; transient: boolean };

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailResult> {
  if (!isEmailConfigured()) return { status: "skipped" };
  const url = process.env.EMAIL_API_URL ?? "https://api.resend.com/emails";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": msg.idempotencyKey,
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { status: "sent" };
    const body = (await res.text()).slice(0, 300);
    return { status: "failed", error: `HTTP ${res.status}: ${body}`, transient: res.status === 429 || res.status >= 500 };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "network error", transient: true };
  }
}
