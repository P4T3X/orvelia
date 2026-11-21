# Database schema — review notes

Migrations:
- `supabase/migrations/20261120000000_initial_schema.sql` — Phase 0–1
- `supabase/migrations/20261121000000_products_phase2.sql` — Phase 2
- `supabase/migrations/20261122000000_documents_phase3.sql` — Phase 3
- `supabase/migrations/20261123000000_automation_phase4.sql` — Phase 4
- `supabase/migrations/20261124000000_assistant_phase5.sql` — Phase 5

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

## Phase 4 additions

- `warranties.kind` (manufacturer / store / extended / other).
- `reminders`: `source` (`warranty` / `return` / `document` / `custom`), `source_id`,
  `lead_days`, `recurrence` (custom only), and delivery bookkeeping
  (`claimed_at`, `attempts`, `last_error`). Users can insert **custom** reminders
  only and update only user-facing columns (column-level grants).
- `sync_auto_reminders(source, id)` + triggers on `warranties`, `return_deadlines`,
  `documents` and product renames: pending automatic reminders are rebuilt from
  the record and the user's preferences; past lead times are skipped.
  `resync_my_reminders()` rebuilds all of a user's (after changing preferences/time zone).
- `notification_preferences` (email on/off, lead days per kind; validated 0–365, max 5).
- `notifications` (in-app inbox): written only by the job; users can read,
  mark read (`read_at` only) and delete their own.
- Delivery API for the service role: `claim_due_reminders(limit)` (atomic,
  `skip locked`, stale claims re-claimable after 10 min) and
  `complete_reminder(id, email_status, error, retry)`.
- Verified on PostgreSQL 16 (`supabase/tests/phase4_automation.sql`).

## Phase 5 additions

- `plan_limits.ai_queries_per_month`: Free 0, Plus 100, Ultra 500 (were `null` =
  unlimited, which left AI cost unbounded). Placeholders.
- `reserve_assistant_query(provider)`: raises `ai_not_included`, `ai_limit_reached`
  (monthly, user's time zone) or `rate_limited` (>10 per minute). `finish_usage(id, ok)`
  closes any reservation of the caller; failed answers don't count. `assistant_usage()` for the UI.
- `usage_this_month(user, operation)` generalizes the scan counter (internal only).
- No conversation storage: questions and answers are not persisted.
- Verified on PostgreSQL 16 (`supabase/tests/phase5_assistant.sql`).

## Phase 6 additions

- `plan_limits.price_monthly` / `currency`: Free 0, Plus 19.99, Ultra 29.99 (PEN).
- `subscriptions.cancel_at_period_end`, `last_payment_status`.
- `effective_plan(user)`: `active`/`trialing`, or `canceled`/`past_due` while
  `current_period_end > now()`; otherwise `free`. `current_plan_limits`,
  `enforce_product_limit` and `product_usage` now use it.
- `billing_checkouts`: one row per checkout attempt (plan, amount, provider subscription
  id, status). Users can read their own; only the server (service role) writes.
- `billing_events`: webhook log, unique `(provider, event_id)`, no policies (service role only).
- `billing_overview()` RPC for the billing page.
- Verified on PostgreSQL 16 (`supabase/tests/phase6_billing.sql`).

## Phase 7 additions

- `plan_limits.family_members` (seats incl. owner: Free 0, Plus 0, Ultra 5) and
  `advanced_analytics` (Plus, Ultra).
- `families` (one per owner), `family_members` (one family per user; roles `owner`,
  `admin`, `member`; exactly one owner), `family_invitations` (e-mail, role, SHA-256
  token hash, expiry, accepted/revoked), `shared_resources` (family × product, composite
  FK to the product so deleting it unshares it), `activity_logs` (family events).
- Existing tables keep their owner-only policies unchanged. Shared data is read only
  through security-definer functions that check membership, the active family and the
  share: `family_shared_products()`, `family_shared_product(id)`,
  `family_shared_events(from, to)`, `shared_file_path(kind, id)`.
- All family writes go through functions: `create_family`, `rename_family`,
  `delete_family`, `create_family_invitation`, `revoke_family_invitation`,
  `accept_family_invitation`, `update_family_member_role`, `remove_family_member`,
  `leave_family`, `share_product`, `unshare_product`. Family tables are read-only for
  members (`family_invitations` has no policies at all); `invitation_preview(token)`
  is the only function anon can call.
- A family is active while its owner's effective plan has seats; otherwise every
  shared read returns nothing and invitations are refused.
- Leaving or being removed deletes that member's shares (trigger).
- `analytics_overview()` returns the caller's own aggregates, gated by plan.
- Verified on PostgreSQL 16 (`supabase/tests/phase7_family.sql`).

## Phase 8 additions

- Indexes for nine foreign keys that had none (found by the security audit).
- Trigger functions and `product_usage()` are no longer callable by `anon`.
- `feedback` (kind, message ≤ 2000, app page): users insert and read their own,
  append-only, at most 10 per day (trigger). The team reads it with the service role.

## Phase 9 additions

- `push_tokens` (Expo push token, platform, device name): users read and delete
  their own; registration only through `register_push_token()`, which moves a
  token to whoever signed in last on that device and keeps 10 devices per user.
- `notification_preferences.push_enabled` (default on).

## Stage 2 additions (My Collection)

- View `product_overview` (`security_invoker = true`): every product column the
  list needs plus `category_name`, `warranty_count`, `warranty_end` (latest
  warranty end date) and `next_return_deadline` (earliest return deadline from
  today). Because it runs with the caller's rights, products RLS applies;
  `anon` has no access.
- Index `products_user_brand_idx` on `(user_id, lower(brand))` for the brand filter.

## Stage 3 additions (Smart Scanner)

- `receipts.processing_attempts`, `receipts.last_attempt_at` and
  `receipts.processing_error_code` (`timeout`, `invalid_output`,
  `provider_error`, `configuration`, `file_missing`, `not_purchase`).
- `reserve_scan` now also refuses with `retry_limit_reached` after
  `max_failed_scans_per_receipt()` (3) failed readings of the same receipt, and
  records each attempt on the receipt.
- `scan_retries_left(receipt_id)` returns the automatic readings still allowed
  for the caller's receipt.

## Open questions for review

1. Initial `storage_mb` and `ai_queries_per_month` values per plan are placeholders.
2. ~~User categories in V1?~~ Implemented in Phase 2 (create inline, delete in Settings).
4. Should archived/sold products count toward the Free limit? Currently all statuses count.
7. AI quotas per plan (Free 0 / Plus 100 / Ultra 500) are placeholders: set them from measured cost per question.
6. Should automatic reminders also go out for products marked sold/gifted/disposed? Currently they do until the warranty/return is deleted.
5. Scan quota resets on the 1st of each month in the user's time zone; should it follow the billing period for paid plans instead?
3. ~~Payment provider for Peru?~~ Mercado Pago Suscripciones (Phase 6).
8. Electronic receipts (SUNAT boletas/facturas) and IGV on subscription prices are not handled yet; confirm with an accountant whether 19.99/29.99 include IGV.
9. Downgrade Ultra → Plus currently starts the new plan at its first payment (no proration).
10. Family seats (5 incl. owner) and the 20 invitations/day limit are placeholders.
11. Sharing is read-only. Should members be able to add reminders or documents to a shared product?
12. Shared reminders appear in members' calendars but are e-mailed only to the product's owner.
13. Should push reminders follow their own lead days, separate from e-mail? Today both use the same schedule.
14. Should the brand list be cleaned up (for example "samsung" and "Samsung" are shown once but stored as typed)?
