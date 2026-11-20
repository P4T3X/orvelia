# Database schema — review notes

Migrations:
- `supabase/migrations/20261120000000_initial_schema.sql` — Phase 0–1
- `supabase/migrations/20261121000000_products_phase2.sql` — Phase 2
- `supabase/migrations/20261122000000_documents_phase3.sql` — Phase 3

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

## Phase 2 additions

- `products.search_text`: generated, lower-cased and accent-folded (`translate`)
  text of name, brand, model, serial and seller, with a `pg_trgm` GIN index.
  The app folds the search term the same way (`normalizeSearch`).
- `products_image_path_owner` check: an image path must start with `{user_id}/products/`.
- `enforce_product_limit` trigger (before insert): reads the user's active
  subscription and `plan_limits.max_products`; `past_due`/`canceled` fall back
  to Free. Uses a per-user advisory lock so concurrent inserts can't exceed the
  limit. Raises `product_limit_reached`. Products of any status count toward the limit.
- `product_usage()` (security invoker): `{used, max_products, plan}` for the UI.
- Verified on PostgreSQL 16: 11th product rejected on Free, allowed on Plus,
  rejected again when the subscription is `past_due`; accent-insensitive search;
  foreign image paths rejected; another user's category rejected by RLS.

## Phase 3 additions

- **Receipt ↔ product**: `receipts.product_id` was replaced by `products.receipt_id`
  (composite FK to `receipts(id, user_id)`, `on delete set null`): one receipt can
  cover several products; each product has at most one purchase receipt.
- `receipts`: `mime_type`, `size_bytes`, `field_sources` (`extracted`/`manual` per
  confirmed field), storage path must start with `{user_id}/receipts/`, and
  `processing_status = 'confirmed'` ⇔ `confirmed_at is not null`.
  The raw validated extraction stays in `receipts.extraction` for traceability;
  the columns are only written on confirmation.
- `documents`: storage path must start with `{user_id}/documents/`; MIME allow-list.
- **Scan quota**: `reserve_scan(receipt_id, provider)` (checks `plan_limits.scans_per_month`
  for the user's month in their time zone, per-user advisory lock, raises
  `scan_limit_reached`) and `finish_scan(usage_id, succeeded)`. Failed scans and
  reservations older than 15 minutes don't count. `scan_usage()` for the UI.
  Internal helpers (`scans_used_this_month`, `current_plan_limits`) are not callable by users.
- Verified on PostgreSQL 16 (`supabase/tests/phase3_documents.sql`).

## Open questions for review

1. Initial `storage_mb` and `ai_queries_per_month` values per plan are placeholders.
2. ~~User categories in V1?~~ Implemented in Phase 2 (create inline, delete in Settings).
4. Should archived/sold products count toward the Free limit? Currently all statuses count.
5. Scan quota resets on the 1st of each month in the user's time zone; should it follow the billing period for paid plans instead?
3. Payment provider for Peru (affects `subscriptions.provider` values and webhooks).
