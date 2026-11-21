# Launch checklist

Work top to bottom. Each item names where it is done.

## 1. Accounts and domain
- [ ] Domain bought and added to Vercel (Project → Domains); `www` redirects to the apex or the other way round.
- [ ] Supabase project on **Pro** in São Paulo (`sa-east-1`, closest to Peru), PITR enabled.
- [ ] Vercel project connected to the GitHub repo; Production branch `main`.
- [ ] GitHub: branch protection on `main` requiring the **CI** workflow.

## 2. Database
- [ ] Apply migrations in order: `supabase db push` (or run each file in `supabase/migrations`).
- [ ] Run `supabase/tests/security_audit.sql` against production: it must print `all checks passed`.
- [ ] Storage bucket `user-files` exists, private, 10 MB limit (created by the migrations).
- [ ] Auth → URL configuration: Site URL `https://<domain>`, redirect `https://<domain>/auth/confirm`.
- [ ] Auth → Email: **Confirm email** on; custom SMTP (Resend) so sign-up mail isn't rate-limited.
- [ ] Auth → Rate limits reviewed; leaked-password protection on.

## 3. Environment variables (Vercel → Settings → Environment Variables, Production)
| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | secret; server only |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` (enables `upgrade-insecure-requests`) |
| `CRON_SECRET` | random 32+ chars; Vercel sends it to the cron route |
| `RESEND_API_KEY`, `EMAIL_FROM` | domain verified in Resend (SPF, DKIM, DMARC) |
| `AI_GATEWAY_API_KEY` (or Vercel OIDC), `ORVELIA_AI_PROVIDER=gateway` | set an AI Gateway budget |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | production credentials, after testing with test users |

Never set `ORVELIA_AI_PROVIDER=fixture`, `MERCADOPAGO_API_URL` or `EMAIL_API_URL` in production.

## 4. Integrations
- [ ] Mercado Pago: webhook `https://<domain>/api/webhooks/mercadopago`, events *Planes y suscripciones*; one real S/ payment made and refunded.
- [ ] Resend: send a test reminder to yourself.
- [ ] Cron: Vercel → Cron Jobs shows `/api/cron/reminders`; trigger it once manually.

## 5. Quality gates (before every release)
- [ ] CI green (lint, types, unit tests, build, migrations + RLS tests + security audit, `pnpm audit`).
- [ ] Preview deployment smoke test: sign up, add a product, scan a receipt, set a reminder, invite a family member.
- [ ] `/api/health` returns `ok` on the preview.

## 6. Monitoring (see `monitoring.md`)
- [ ] Uptime monitor on `/api/health`.
- [ ] Log drain + error alert.
- [ ] Spend alerts: Vercel, Supabase, AI Gateway.

## 7. Legal (Peru) — confirm with a lawyer/accountant
- [ ] Privacy policy and terms reviewed; personal-data bank registered with the
      Autoridad Nacional de Protección de Datos Personales (Ley 29733).
- [ ] Users can download and delete their data in Ajustes → Tus datos (built).
- [ ] SUNAT electronic receipts (boletas/facturas) for subscriptions and IGV on the prices.
- [ ] Libro de Reclamaciones virtual (Código de Protección al Consumidor).

## 8. Launch day
- [ ] Promote the preview to production; check `/api/health` and sign-up.
- [ ] Watch logs and the feedback table for the first 24 hours.
- [ ] Rollback plan: Vercel → Deployments → *Instant Rollback*; database changes are additive, so the previous release keeps working.
