# Database schema — review notes

Migration: `supabase/migrations/20261120000000_initial_schema.sql`
Status: **proposed — review before applying.**

The migration was verified against PostgreSQL 16 with Supabase-like `auth` /
`storage` stubs using `supabase/tests/rls_smoke.sql` (two users, isolation,
cross-user references, read-only billing tables, storage paths, cascades).

## Tables

| Table | Purpose | Who writes |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; name, language, currency, timezone | Signup trigger, owner (update) |
| `categories` | System categories (`user_id is null`) + user categories | Owner (own rows only) |
| `products` | Owned items (Module 3) | Owner |
| `documents` | Private files: warranties, manuals, invoices… | Owner |
| `receipts` | Purchase receipts + scanner state and extraction | Owner / scanner job |
| `warranties` | Warranty facts with `verification_status` | Owner |
| `return_deadlines` | Return windows with `verification_status` | Owner |
| `reminders` | Scheduled reminders (backend scheduler sends them) | Owner / scheduler |
| `plan_limits` | Configurable limits per plan — **source of truth** | Admin only |
| `subscriptions` | Plan + status per user | Payment webhooks only (service role) |
| `ai_usage` | OCR / extraction / assistant metering | Server only (service role) |

## Deliberate changes from the master document

- **`notes`** added to `products` (listed as a product field in Module 3).
- **`updated_at`** added to every mutable table, kept fresh by a trigger.
- **`receipts`**: `tax_amount`, `extraction` (validated raw output, for
  traceability), `processing_error`, `confirmed_at` (set only on user
  confirmation — Module 4 rule "save only after confirmation").
- **`documents`**: `mime_type`, `size_bytes`, `expires_on` (for Module 6
  document-expiration events).
- **`reminders`**: `sent_at` and a partial index for the scheduler.
- **`plan_limits`** table so limits are configurable on the backend (Module 9).
- **Composite ownership foreign keys** `(product_id, user_id)` → `products(id, user_id)`:
  the database rejects linking a record to another user's product even if
  application code has a bug.
- Deleting a product **cascades** to its warranties and return deadlines but
  **keeps** receipts, documents and reminders (their `product_id` is set to null).
- Deleting the auth user cascades all rows. Storage objects under
  `{user_id}/` must be removed by the account-deletion job (Phase 1 follow-up).

## Enums

`product_status`, `verification_status` (extracted / manual / confirmed /
needs_verification), `processing_status`, `document_type`, `reminder_status`,
`plan_id`, `subscription_status`. TypeScript mirrors live in `packages/domain`.

## Storage

Private bucket `user-files` (10 MB, JPEG/PNG/WEBP/HEIC/PDF). Object paths must
begin with the owner's id: `{user_id}/{receipts|documents|products}/{uuid}.{ext}`.
Serve files only through short-lived signed URLs.

## Open questions for review

1. Initial `storage_mb` and `ai_queries_per_month` values per plan are placeholders.
2. Should users be able to create their own categories in V1, or only use system ones?
3. Payment provider for Peru (affects `subscriptions.provider` values and webhooks).
