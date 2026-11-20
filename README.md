# ORVELIA

Personal Ownership Management — *Todo lo que posees. Un solo espacio inteligente.*

Web-first, mobile-ready platform built with Next.js 16 + Supabase. This
repository currently covers **Phase 0 (foundation)** and **Phase 1 (brand and
web foundation)** of the master technical document.

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

RLS smoke test (against a local DB with the migration applied):
`psql "$DB_URL" -f supabase/tests/rls_smoke.sql`

## Deploying to Vercel

Import the repo, set **Root Directory** to `apps/web`, and add the variables
from `.env.example`. Vercel detects pnpm workspaces automatically.

## Docs

- `docs/architecture/` — structure and decisions
- `docs/database/schema.md` — schema review notes and open questions
- `docs/security/` — security baseline and pending items

## Next: Phase 2 — Ownership management

Product CRUD, categories, search and filters, product detail page and product
images in the private bucket, with backend enforcement of the Free plan's
10-product limit.

---

Made by: Lucioni Enterprises
