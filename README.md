# ORVELIA

Personal Ownership Management — *Todo lo que posees. Un solo espacio inteligente.*

Web-first, mobile-ready platform built with Next.js 16 + Supabase. This
repository currently covers **Phase 0 (foundation)**, **Phase 1 (brand and web
foundation)**, **Phase 2 (ownership management)** and **Phase 3 (document
intelligence)** of the master technical document.

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
`supabase/tests/rls_smoke.sql`, `phase2_products.sql`, `phase3_documents.sql` (run with `psql "$DB_URL" -f …`)

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

## Next: Phase 4 — Automation

Warranties and return deadlines per product (with source and verification
status), the calendar, reminders and notifications sent by a scheduled backend
job (Supabase cron / Vercel cron), not browser timers.

---

Made by: Lucioni Enterprises
