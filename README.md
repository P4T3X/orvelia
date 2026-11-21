# ORVELIA

Personal Ownership Management — *Todo lo que posees. Un solo espacio inteligente.*

Web-first, mobile-ready platform built with Next.js 16 + Supabase. This
repository currently covers **Phase 0 (foundation)**, **Phase 1 (brand and web
foundation)**, **Phase 2 (ownership management)**, **Phase 3 (document
intelligence)**, **Phase 4 (automation)** and **Phase 5 (ORVELIA AI)** of the
master technical document.

## What's in Phase 0–1

| Area | Status |
|---|---|
| pnpm monorepo: `apps/web`, `packages/domain`, `packages/schemas` | ✅ |
| Initial Supabase schema with RLS on every table, private storage bucket | ✅ proposed, **review before applying** |
| Design system (Luxury Technology tokens, Geist, light/dark, primitives) | ✅ |
| Public site: `/`, `/features`, `/pricing`, `/about`, `/privacy`, `/terms` | ✅ (legal pages are drafts) |
| Auth: register, email verification, login, logout, password recovery/reset | ✅ |
| Server-side gating of `/app/*` (proxy + layout `getUser()`) | ✅ |
| `/app` dashboard with real counts, upcoming deadlines, onboarding checklist | ✅ |
| `/app/settings` profile (name, language, currency, time zone), `/app/billing` plan + limits | ✅ |
| Products, scanner, documents, calendar, assistant | Honest placeholders → Phases 2–5 |

## What's in Phase 2

| Area | Status |
|---|---|
| Product create / edit / delete (with confirmation) and status changes | ✅ |
| Categories: 11 system categories + user categories (inline creation, management in Settings) | ✅ |
| Accent-insensitive search (name, brand, model, serial, seller), status/category filters, 4 sort orders, pagination — all in the URL | ✅ |
| Product detail page | ✅ |
| Product photos in the private bucket: resized in the browser (EXIF/GPS stripped), file signature checked on the server, short-lived signed URLs, cleaned up on replace/delete | ✅ |
| Free plan limit (10 products) enforced by a database trigger reading `plan_limits`, plus UI usage meter | ✅ |
| Receipts, documents, warranties per product | Placeholders on the detail page → Phases 3–4 |

## Getting started

Requirements: Node 22+, pnpm 10, a Supabase project, and the Supabase CLI.

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in your Supabase URL + anon key

# Apply the schema to your Supabase project (after reviewing it)
supabase link --project-ref <your-ref>
supabase db push

# Generate exact DB types (replaces the hand-written subset)
supabase gen types typescript --linked > apps/web/src/lib/supabase/database.types.ts

pnpm dev            # http://localhost:3000
```

Without Supabase variables the public site still runs and auth screens show a
setup notice.

### Supabase Auth settings

1. **Authentication → Sign In / Providers → Email**: enable *Confirm email*.
2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (production URL later)
   - Redirect URLs: `http://localhost:3000/auth/confirm`, `https://<prod-domain>/auth/confirm`
3. The default email templates work (PKCE `?code=`). Optionally switch to token-hash links:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/app`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
4. Configure custom SMTP with **Resend** before inviting beta users.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the web app |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm lint` | ESLint (web) + type checks (packages) |
| `pnpm test` | Unit tests (shared Zod schemas) |

SQL smoke tests (against a local DB with the migrations applied):
`supabase/tests/rls_smoke.sql`, `phase2_products.sql`, `phase3_documents.sql`, `phase4_automation.sql`, `phase5_assistant.sql`, `phase6_billing.sql`, `phase7_family.sql` (run with `psql "$DB_URL" -f …`)

## Deploying to Vercel

Import the repo, set **Root Directory** to `apps/web`, and add the variables
from `.env.example`. Vercel detects pnpm workspaces automatically.

## Docs

- `docs/architecture/` — structure and decisions
- `docs/database/schema.md` — schema review notes and open questions
- `docs/security/` — security baseline and pending items

## What's in Phase 3

| Area | Status |
|---|---|
| Receipt upload (photo, camera on mobile, PDF; ≤10 MB; file signature checked on the server; photos resized and stripped of EXIF/GPS in the browser) | ✅ |
| Provider-independent AI layer (`packages/ai`): `ReceiptExtractor` interface, AI Gateway implementation, Zod-validated output, deterministic sanitizing that never fills missing values, warnings | ✅ |
| Review screen: every field editable and tagged *Leído* / *Editado*; nothing saved before confirmation; per-field provenance stored (`field_sources`) | ✅ |
| Create products from receipt items, or link the receipt to existing products | ✅ |
| Monthly scan quota from `plan_limits`, enforced in the database; failed readings don't count; manual entry when the quota is used or AI is not configured | ✅ |
| Documents (warranty, manual, invoice, insurance, certificate…) with type, optional product and expiry date | ✅ |
| Private file access through an ownership-checked route that redirects to a 2-minute signed URL | ✅ |
| Product page shows its receipt and documents; dashboard shows receipts pending review | ✅ |

### Turning on automatic reading

Set in `apps/web/.env.local` (or Vercel project settings):

```
ORVELIA_AI_PROVIDER=gateway
ORVELIA_EXTRACTION_MODEL=<provider/model with vision + PDF input, from the AI Gateway model list>
AI_GATEWAY_API_KEY=<only for local dev; on Vercel the project OIDC token is used>
```

Without these, the scanner still stores files and the user types the data.
`ORVELIA_AI_PROVIDER=fixture` returns labeled test data for local development and
is refused when `VERCEL_ENV=production`.

## What's in Phase 4

| Area | Status |
|---|---|
| Warranties per product: kind, provider, start/end, coverage, backing document, verification status (manual / confirmed / needs verification); time left and progress | ✅ |
| Return deadlines with conditions, backing document and verification status | ✅ |
| No assumed standard periods: only dates the user records | ✅ |
| Automatic reminders generated **in Postgres triggers** when a warranty end, return deadline or document expiry is created/changed/deleted, at 09:00 in the user's time zone; product renames update titles | ✅ |
| Lead times configurable in Settings (e.g. 30 and 7 days before), email on/off; changing them or the time zone re-times every pending reminder | ✅ |
| Calendar: month grid + month agenda + scheduled reminders; manual and recurring reminders (maintenance: monthly → yearly) | ✅ |
| Scheduled delivery job `/api/cron/reminders` (Vercel Cron, `CRON_SECRET`): atomic claim (`for update skip locked`), email through Resend with idempotency keys, 2 retries on transient failures, in-app notification always created, next occurrence for recurring reminders | ✅ |
| In-app inbox `/app/notifications` and bell with unread count | ✅ |

### Turning on delivery

```
SUPABASE_SERVICE_ROLE_KEY=<server only>
CRON_SECRET=<random string; Vercel sends it to the cron route>
RESEND_API_KEY=<from resend.com>          # optional: without it, in-app only
EMAIL_FROM="ORVELIA <avisos@your-domain>" # a domain verified in Resend
```

`apps/web/vercel.ts` schedules the job daily at 14:00 UTC (09:00 Lima), which
works on the Hobby plan. On Pro, change it to hourly (`0 * * * *`) so users in
other time zones get reminders at their own 09:00.

## What's in Phase 5

| Area | Status |
|---|---|
| `/app/assistant` chat with suggested questions (active warranties, upcoming deadlines, spending, missing receipts, recent purchases, maintenance) | ✅ |
| Provider-independent `AssistantModel` (`packages/ai`): AI Gateway implementation with tool calling, plus a labeled test assistant refused in production | ✅ |
| 8 **read-only** tools; every query runs with the user's session (RLS) **and** an explicit `user_id` filter | ✅ |
| Spending totals computed by the server in integer cents, **per currency** (never mixed or converted); products without price reported separately | ✅ |
| Record links: the model writes `[[product:ID]]` tokens; the server keeps only ids returned by a tool in that same turn and drops the rest | ✅ |
| Prompt rules: answer only from tool results, never invent dates/amounts/terms, treat record text as data | ✅ |
| Monthly quota per plan + 10 questions/minute burst limit, enforced in Postgres; failed answers don't count; conversations are not stored | ✅ |

```
ORVELIA_AI_PROVIDER=gateway
ORVELIA_ASSISTANT_MODEL=<provider/model with tool calling>   # falls back to ORVELIA_EXTRACTION_MODEL
```

Plan quotas (`plan_limits.ai_queries_per_month`): Free 0 · Plus 100 · Ultra 500 —
**placeholders to tune** against real cost per question before launch.

## What's in Phase 6

- **Plans and prices** (soles, monthly): Free S/ 0, Plus S/ 19.99, Ultra S/ 29.99.
  Prices live in `plan_limits.price_monthly`; the pricing page and `/app/billing` read them.
- **Mercado Pago Suscripciones** (`packages/billing`): checkout via a `preapproval`
  (card, Yape or Mercado Pago balance, automatic monthly charge and retries). ORVELIA never
  sees card data.
- **Webhook** `POST /api/webhooks/mercadopago`: verifies the `x-signature` HMAC, handles
  `subscription_preapproval` and `subscription_authorized_payment`, re-reads the real state
  from the Mercado Pago API (never trusts the body), checks the amount against the plan
  price, and records each event once in `billing_events` (idempotent; 500 → MP retries).
  It is the only writer of `subscriptions` besides the user's own cancel action.
- **Billing page**: current plan, renewal date, usage (products, scans, AI), subscribe /
  change plan, cancel. On return from checkout the page confirms the payment itself.
- **Plan rules** (`effective_plan()` in Postgres): canceled or past-due subscriptions keep
  the plan until `current_period_end`, then fall back to Free. Changing plan starts the new
  plan when its first payment is approved and cancels the previous subscription.

### Turning on payments

1. In Mercado Pago Developers create an application (product: *Suscripciones*) with
   your Peruvian Mercado Pago account.
2. Copy the **Access Token** (use the test one first) → `MERCADOPAGO_ACCESS_TOKEN`.
3. *Webhooks* → URL `https://<prod>/api/webhooks/mercadopago`, events **Planes y
   suscripciones** (both). Copy the generated secret → `MERCADOPAGO_WEBHOOK_SECRET`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` (used for the return URL).
5. Test with Mercado Pago *test users* (one seller, one buyer) before switching to the
   production token.

Without these variables the billing page shows plans but disables checkout.

## What's in Phase 7

- **Family (Ultra)**: the Ultra subscriber creates a family of up to 5 people (seats in
  `plan_limits.family_members`). Members don't need to pay; a free account is enough.
- **Invitations**: by e-mail (Resend) and as a copyable link (handy for WhatsApp). The
  token is random, shown once, stored only as a SHA-256 hash, single-use, valid 7 days,
  and can only be accepted by the invited e-mail address. Pending invitations count
  toward the seat limit; up to 20 invitations per family per day.
- **Roles**: Titular (owner), Administrador, Miembro. The owner changes roles and can
  remove anyone; admins invite members and remove members; everyone can leave except
  the owner, who can delete the family. Nothing a person owns is deleted.
- **Read-only sharing**: from a product page, "Compartir con la familia". Members see
  the product with its warranties, return deadlines, confirmed receipt, documents and
  reminders, and shared dates appear in their calendar. Only the owner edits.
- **Pause on downgrade**: if the owner's Ultra lapses, sharing and invitations pause;
  nothing is deleted, and it resumes when Ultra is active again.
- **Activity log** of family events, and an in-app notification when someone joins.
- **Advanced analytics** (Plus and Ultra): collection value, purchases by month,
  categories, warranty/receipt/document coverage, upcoming expirations.

The family needs `SUPABASE_SERVICE_ROLE_KEY` on the server to open shared files
(storage stays owner-only; the server signs a shared file only after
`shared_file_path()` authorizes it) and `RESEND_API_KEY` to e-mail invitations
(without it, the invite link is shown to copy).

## Next: Phase 8 — Production

Security review, performance and accessibility passes, backups, monitoring,
deployment, beta testing and public launch.

---

Made by: Lucioni Enterprises
