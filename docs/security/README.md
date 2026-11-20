# Security baseline (Phase 0–1)

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
- Per-minute rate limiting on uploads and AI calls (monthly quotas exist; burst limits pending).
- Sentry error monitoring.
