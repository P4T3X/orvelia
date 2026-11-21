/**
 * Minimal Mercado Pago Suscripciones client (preapproval API).
 * Docs: https://www.mercadopago.com.pe/developers/es/reference/online-payments/subscriptions/overview
 */

export type PreapprovalStatus = "pending" | "authorized" | "paused" | "cancelled";

export type Preapproval = {
  id: string;
  status: PreapprovalStatus;
  external_reference?: string | null;
  payer_email?: string | null;
  payer_id?: number | null;
  init_point?: string | null;
  next_payment_date?: string | null;
  date_created?: string | null;
  auto_recurring?: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
};

export type AuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  status: string; // e.g. "processed", "recycling", "scheduled"
  payment?: { id?: number; status?: string; status_detail?: string } | null;
  transaction_amount?: number;
  currency_id?: string;
};

export class MercadoPagoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export function createMercadoPagoClient(opts: { accessToken: string; baseUrl?: string; fetch?: typeof fetch }) {
  const base = (opts.baseUrl ?? "https://api.mercadopago.com").replace(/\/$/, "");
  const doFetch = opts.fetch ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) throw new MercadoPagoError(`Mercado Pago ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`, res.status);
    return (text ? JSON.parse(text) : {}) as T;
  }

  return {
    /** Subscription without an associated plan, pending payment: the payer completes it at `init_point`. */
    createPreapproval(input: {
      reason: string;
      externalReference: string;
      payerEmail: string;
      amount: number;
      currency: string;
      backUrl: string;
      idempotencyKey: string;
    }) {
      return call<Preapproval>(
        "POST",
        "/preapproval",
        {
          reason: input.reason,
          external_reference: input.externalReference,
          payer_email: input.payerEmail,
          back_url: input.backUrl,
          status: "pending",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: input.amount,
            currency_id: input.currency,
          },
        },
        input.idempotencyKey,
      );
    },
    getPreapproval: (id: string) => call<Preapproval>("GET", `/preapproval/${encodeURIComponent(id)}`),
    cancelPreapproval: (id: string) => call<Preapproval>("PUT", `/preapproval/${encodeURIComponent(id)}`, { status: "cancelled" }),
    getAuthorizedPayment: (id: string) => call<AuthorizedPayment>("GET", `/authorized_payments/${encodeURIComponent(id)}`),
  };
}

export type MercadoPagoClient = ReturnType<typeof createMercadoPagoClient>;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";

/** Map a preapproval to ORVELIA's subscription status. */
export function mapPreapprovalStatus(status: PreapprovalStatus): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "canceled";
    default:
      return "incomplete";
  }
}

/** True when the preapproval charges exactly the expected amount and currency. */
export function matchesPrice(p: Preapproval, amount: number, currency: string) {
  const r = p.auto_recurring;
  return Boolean(r) && r!.currency_id === currency && Math.round(r!.transaction_amount * 100) === Math.round(amount * 100);
}
