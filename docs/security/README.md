# Security baseline

## In place

- **Row Level Security** on every table; owner-only policies use `(select auth.uid())`.
- **Ownership at the database level** via composite foreign keys (see `docs/database/schema.md`).
- **Billing / usage tables are read-only** for users; only the service role writes them.
- **Server-side auth checks**: `src/proxy.ts` refreshes the session and gates
  `/app/*`; the `/app` layout re-verifies the user with `supabase.auth.getUser()`
  (never trusts the cookie alone).
- **Server Actions validate every input with Zod** (same schemas as the client).
- **Open-redirect protection** on `?next=` (`safeRedirectPath`).
- **No account enumeration**: password recovery always returns the same message.
- **Service-role key** is never referenced in client code; `server-only` guards server modules.
- **Security headers** (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy).
- **Private storage bucket** with per-user folder policies, size and MIME limits.

- **Uploads**: size checked before reading; type decided by file signature
  (JPEG/PNG/WEBP/`%PDF-`), never by the browser's MIME type or extension;
  bucket MIME/size limits as a second barrier; images re-encoded client-side
  (removes EXIF/GPS).
- **Private files** are opened through `/app/files/{receipt|document}/{id}`, which
  checks ownership and redirects to a ≤2-minute signed URL (`Cache-Control: no-store`).
- **AI output is untrusted**: validated with Zod, sanitized deterministically,
  shown for confirmation, and never written to the record's columns without it.
- **Quotas** (products, scans) are enforced in Postgres, not in the UI.

- **Scheduled job**: `/api/cron/reminders` requires `Authorization: Bearer $CRON_SECRET`
  (constant-time comparison). It is the only code path that uses the service-role
  key, and it only calls the two delivery functions, which are not executable by
  users.
- **Emails** carry no sensitive data beyond the reminder title; links point to
  the authenticated app.

- **ORVELIA AI** can only read: 8 tools, each scoped by RLS and `user_id`; it has
  no write tools. Record text is passed as data; links in answers are validated
  against the records the tools returned in that turn; amounts are summed by the
  server. Conversations are not stored. Monthly and per-minute limits are
  enforced in Postgres.

- **Payments** never touch card data (Mercado Pago hosted checkout). The webhook
  rejects requests without a valid `x-signature` (HMAC-SHA256, 15-minute window,
  constant-time compare), ignores the request body's claims and re-reads each
  subscription from the Mercado Pago API, checks the amount against the plan price,
  and is idempotent via `billing_events`. Subscriptions and checkouts are written only
  with the service role on the server; users can only read their own rows.

- **Family sharing** keeps private and shared data on separate paths: owner-only RLS on
  every existing table is untouched; members read shared data only through
  security-definer functions that check membership, the active family and the share.
  Family writes happen only in functions that enforce roles, seat limits and one family
  per user. Invitation tokens (244 random bits) are stored as SHA-256 hashes, are
  single-use, expire in 7 days and require the invited e-mail to match the signed-in
  account. Shared files are signed by the server with the service role only after
  `shared_file_path()` authorizes the caller; storage policies stay owner-only.

- **Phase 8 hardening**: a Content-Security-Policy (no `unsafe-eval`, no framing,
  no plugins; scripts and connections limited to this origin and Supabase) on every
  response. `supabase/tests/security_audit.sql` is a CI gate for RLS coverage,
  definer-function exposure and search_path, trigger-function grants and FK indexes.
  Account deletion cancels billing, removes files and deletes the auth user (all
  data cascades); the data export reads only through the user's own session.
  `/api/health` never returns configuration values unless called with
  `CRON_SECRET`, and then only booleans.

- **Mobile API (Phase 9)**: `/api/mobile/*` accepts only `Authorization: Bearer
  <Supabase access token>`, verified with Supabase Auth on every request; there are
  no cookies on that path, so its permissive CORS can't be used for cross-site
  requests with the user's session. The handlers call the same server code as the
  web (same validation, quotas and RLS). The app keeps the session in the device's
  app sandbox (expo-sqlite storage). Push tokens are per user and can only be
  registered through a definer function; tokens the push service reports as
  unregistered are deleted.

## Supabase dashboard settings to configure

- Auth → Email: **Confirm email ON**, secure password change ON.
- Auth → URL configuration: Site URL = production URL; Redirect URLs include
  `http://localhost:3000/auth/confirm` and `https://<prod>/auth/confirm`.
- Auth → Email templates: point confirmation and recovery links to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<signup|recovery>&next=<path>`
  (see README).
- Auth → Rate limits: keep defaults or tighten; enable CAPTCHA (Turnstile/hCaptcha) before public launch.
- Auth → SMTP: use Resend as custom SMTP for deliverability.
- Enable leaked-password protection (Pro plan).

## Pending (tracked for later phases)

- Account deletion flow (server action with service role + storage cleanup).
- Data export.
- Content-Security-Policy with nonces.
- Audit log table (`activity_logs`) for security events.
- Per-minute rate limiting on uploads (assistant has a 10/min limit; scans have monthly quotas).
- Sentry error monitoring.
