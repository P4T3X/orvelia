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
`supabase/tests/rls_smoke.sql`, `phase2_products.sql`, `phase2b_collection.sql`, `phase3_documents.sql`, `phase4_automation.sql`, `phase5_assistant.sql`, `phase6_billing.sql`, `phase7_family.sql`, `phase8_production.sql`, `phase9_mobile.sql`, `security_audit.sql`; run them all on fresh databases with `scripts/db-test.sh`

## Database migrations on deploy

Production builds on Vercel run `scripts/migrate.mjs` before `next build`. It
applies any pending file in `supabase/migrations` to the Supabase database from
the Vercel integration (`POSTGRES_URL_NON_POOLING`, falling back to
`POSTGRES_URL`), records it in `supabase_migrations.schema_migrations` (the same
table the Supabase CLI uses) and creates the profile and Free plan for accounts
that signed up before the schema existed. A failing migration stops the deploy.

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

## What's in Phase 8

Production readiness. Details and results in `docs/operations/`.

- **Security**: Content-Security-Policy on every response; an automated database
  audit (`supabase/tests/security_audit.sql`) that fails CI if a table loses RLS, a
  definer function becomes callable by visitors, or a foreign key is unindexed (it
  found and the Phase 8 migration fixed both); `pnpm audit` clean.
- **Privacy (Ley 29733)**: Ajustes → *Tus datos*: download everything as JSON, or
  delete the account (cancels the Mercado Pago subscription, removes stored files,
  then deletes the user; every table cascades).
- **Accessibility**: axe-core finds 0 WCAG 2.2 AA violations on 28 pages, light and
  dark, desktop and mobile (calendar ARIA and gold text contrast fixed).
- **Performance**: Lighthouse 100 on desktop and 84–97 on simulated mobile (see the
  quality report).
- **Monitoring**: `GET /api/health` for uptime checks; every server error is logged
  as one JSON line (`src/instrumentation.ts`) with the digest users see.
- **Beta**: *Enviar comentarios* in the sidebar stores feedback with the page it came
  from (10 a day per person).
- **CI**: `.github/workflows/ci.yml` runs lint, types, unit tests, build, `pnpm audit`,
  and every SQL test on a fresh Postgres plus the security audit (`scripts/db-test.sh`).
- **Backups**: Supabase PITR plus `scripts/backup-db.sh` (encrypted `pg_dump`); a
  restore drill is documented and was run locally.
- **Launch**: `docs/operations/launch-checklist.md` lists every account, setting,
  variable and legal step for go-live.

## What's in Phase 9

- **Mobile app** (`apps/mobile`, Expo SDK 58 + Expo Router, iOS and Android):
  sign in or create an account, home, collection with search, product detail,
  add a product with a photo, two-tap warranties, scan and confirm receipts with
  AI, upcoming dates (including family-shared ones), notices, ORVELIA AI and
  in-app account deletion. See `apps/mobile/README.md`.
- **Shared packages**: `@orvelia/api` holds the database types, locale
  formatting and the data-access functions both apps use (RLS still decides
  what each person sees); domain rules and validation stay in `@orvelia/domain`
  and `@orvelia/schemas`.
- **Mobile API** on the web app (`/api/mobile/*`): receipt upload, AI reading,
  confirmation, the assistant and account deletion, authenticated with the
  Supabase access token (`Authorization: Bearer`) and running the same server
  code and quotas as the web.
- **Push notifications**: devices register Expo push tokens
  (`register_push_token`); the daily reminders job sends a push to each device
  alongside the e-mail, removes tokens the service reports as unregistered, and
  respects a per-user on/off switch.
- **Store readiness**: icons, permissions copy in Spanish, `eas.json` build
  profiles, and `docs/mobile/store-submission.md` (listing, privacy labels,
  review notes). Subscriptions remain web-only.

## Stage 2 — My Collection (completion pass)

The collection from Phase 2 already had create, edit, archive, restore, delete,
private photos, categories, search and the plan limit. This pass finishes it:

- **Product cards** (grid of 2 / 3 / 4 columns) and a **list view**
  (`?view=list`), with the photo, brand · model · category, price, purchase
  date and chips for warranty coverage ("Vence en 10 días", "Garantía vencida",
  "Sin garantía", "Hasta 17 nov. 2027") and returns closing within 7 days.
- **More filters**: brand (from your own products, case-insensitive) and
  warranty coverage (active / expired / none), next to status, category and search.
  "Quitar filtros (N)" clears them and keeps the sort and view.
- **More sorts**: newest, name, purchase date (newest / oldest), price
  (high / low) and "warranty that ends first".
- **Database view `product_overview`** (`security_invoker`, so RLS still
  applies) that adds the category name, number of warranties, latest warranty
  end and next open return deadline to each product in one query; index on
  `(user_id, lower(brand))`. Migration: `20261129000000_collection_stage2.sql`.
- Clearer messages after archiving and restoring, a card-grid loading
  skeleton, and invalid URL parameters fall back to the defaults instead of failing.
- Tests: `supabase/tests/phase2b_collection.sql` (view values, filters, and
  that another person can't read, change, delete or attach warranties to your
  products), new schema and coverage unit tests, and a 31-step browser test.

Still open: the "warranty that ends first" sort puts expired and uncovered items
last only within each page of 24; the mobile collection doesn't show coverage
chips yet; everything was verified against a local Postgres with Supabase's
roles and RLS, not yet against a hosted Supabase project.

## Stage 3 — Smart Scanner (completion pass)

The scanner from Phase 3 already uploaded photos and PDFs to private storage,
read them through a provider-independent `ReceiptExtractor`, validated the
result with Zod, showed an editable review, linked receipts to existing products
or created new ones after confirmation, and counted readings against the monthly
plan quota. This pass adds:

- **Automatic retries** (`extractReceiptWithRetry` in `@orvelia/ai`): temporary
  failures (outage, timeout, output that fails validation) are retried once with
  backoff inside the same request. Credential or permission errors are not retried.
- **Error classification**: `timeout`, `invalid_output`, `provider_error`,
  `configuration`, `file_missing`, stored in `receipts.processing_error_code`
  with a plain message for the user.
- **Attempt history and cap**: every reading attempt is counted
  (`receipts.processing_attempts`, `last_attempt_at`). After 3 failed readings
  of the same receipt, `reserve_scan` refuses with `retry_limit_reached` and the
  app offers manual entry. Failed readings still don't use the monthly quota.
  The cap is computed from `ai_usage`, which users can't write.
- **HEIC photos**: a clear message when the browser can't open a HEIC file, and
  the server recognizes HEIC uploads instead of a generic error. Safari converts
  HEIC on upload, so iPhone users are normally unaffected.
- Longer function time (`maxDuration = 180`) for the pages and mobile route that
  read receipts.
- Test provider failure modes (`ORVELIA_FIXTURE_MODE=error|flaky|invalid|auth`,
  never available in production) so failure handling is tested for real.
- Migration: `20261130000000_scanner_stage3.sql`.
- Tests: `supabase/tests/phase3b_scanner.sql`, 7 new unit tests in
  `packages/ai`, and a 29-step browser test covering retries, the cap, manual
  entry, HEIC, oversized files, PDFs and ownership.

### Turning on automatic reading

Reading is real only when a provider is configured; without one, receipts are
stored and the user completes the data by hand. Nothing is ever simulated in
production.

| Variable | Value |
|---|---|
| `ORVELIA_AI_PROVIDER` | `gateway` |
| `ORVELIA_EXTRACTION_MODEL` | a model with vision and PDF input, e.g. `anthropic/claude-haiku-5.5` |
| Credentials | on Vercel, the project's OIDC token (automatic); locally `AI_GATEWAY_API_KEY` |

The Vercel team needs AI Gateway enabled with credits or a payment method. If
the gateway rejects the credentials, receipts fail with "no está configurada
correctamente" and aren't retried. Set an AI Gateway budget before launch.

## Stage 4 — Warranties and returns

Warranties and return windows per product (provider, dates, coverage, policy,
source document, verification state and automatic reminders) already existed
from Phase 4. This stage adds:

- **Garantías page** (`/app/warranties`, in the main navigation): every warranty
  and return window across the collection, most urgent first, with filters
  (por vencer, vigentes, devoluciones, por verificar, sin fecha de fin, vencidas)
  and counts. Warranties ending within 30 days and returns closing within 7 count
  as "por vencer". Each row opens the product's warranty section.
- **Scanner → warranty and return** (Module 4, step 9): when confirming a
  receipt that creates products, a "Garantía y devolución" section lets the user
  record them for those products. The reader now captures warranty and return
  terms **only when printed** (`warrantyMonths`, `warrantyTerms`, `returnDays`,
  `returnPolicy`); dates are computed from the printed term and the purchase
  date, never from a typical policy. Without printed terms the fields stay empty.
- **Provenance**: a date the user keeps exactly as computed from the document is
  saved as `confirmed`; anything typed or changed is `manual`. Reminders are
  created by the existing database triggers.
- Validation: a warranty can't end, and a return deadline can't fall, before the
  purchase date; protection needs at least one new product (checked on the server).
- No migration needed. Tests: 4 new unit tests (printed terms, date math,
  confirmation schema) and a 29-step browser test.

## Stage 5 — Smart Calendar: maintenance

The calendar from Phase 4 already showed warranty ends, return deadlines,
document expiries and custom reminders, with notification preferences and a
scheduled backend job. This stage adds **maintenance schedules** (Module 6):

- **Per product** ("Mantenimiento" section on the product page): what to do,
  how often (every N days / weeks / months / years), the next date and how many
  days before to be notified. Plans can be edited, paused (no reminders) and
  deleted (history is kept).
- **"Marcar como hecho"** records the date, optional cost (per currency, never
  mixed), who did it and notes, and moves the next date forward in one database
  transaction (`complete_maintenance`). Logging an older visit never pulls the
  schedule back; future dates are rejected.
- **History** of every completed maintenance with the total spent.
- **Reminders**: created by a database trigger N days before and on the due date
  (source `maintenance`), rebuilt on every change, removed when paused or deleted,
  and renamed when the product is renamed. Delivered by the existing cron job.
- **Calendar** shows the next date and projects the following occurrences;
  **Inicio** lists due and overdue maintenance; the **mobile app**'s upcoming
  list includes it; **ORVELIA AI** has a `list_maintenance` tool (real data,
  links to products); **data export** includes plans and logs.
- Migration: `20261201000000_maintenance_stage5.sql` (tables
  `maintenance_plans`, `maintenance_logs`, owner-only RLS, composite FKs,
  `complete_maintenance()`, reminder triggers).
- Tests: `supabase/tests/phase5b_maintenance.sql`, 5 new unit tests (schemas,
  interval math, assistant), and a 27-step browser test.

## What's next

All nine phases of the technical document are built. Remaining work needs your
accounts: deploy (see `docs/operations/launch-checklist.md`), run the closed
beta, and build and submit the mobile app with EAS.

---

Made by: Lucioni Enterprises
