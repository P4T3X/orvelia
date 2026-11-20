-- =============================================================================
-- ORVELIA — initial schema
-- -----------------------------------------------------------------------------
-- STATUS: proposed. Review docs/database/schema.md before applying
-- (`supabase db push` or `supabase migration up`).
--
-- Principles
--   * UUID primary keys, created_at / updated_at timestamps.
--   * Row Level Security enabled on every table.
--   * Child rows reference (id, user_id) composites, so the database itself
--     guarantees a receipt / warranty / reminder can only point at a product
--     owned by the same user.
--   * Billing and usage tables are read-only for users; only trusted server
--     code (service role: payment webhooks, scanner jobs) writes to them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.product_status as enum ('active', 'sold', 'gifted', 'archived', 'disposed');

create type public.verification_status as enum (
  'extracted',          -- read from a document by OCR/AI, not yet reviewed
  'manual',             -- typed in by the user
  'confirmed',          -- reviewed and confirmed by the user
  'needs_verification'  -- incomplete or conflicting
);

create type public.processing_status as enum (
  'uploaded', 'processing', 'needs_review', 'confirmed', 'failed'
);

create type public.document_type as enum (
  'receipt', 'invoice', 'warranty', 'manual', 'insurance', 'certificate', 'other'
);

create type public.reminder_status as enum ('scheduled', 'sent', 'dismissed', 'cancelled', 'failed');

create type public.plan_id as enum ('free', 'plus', 'ultra');

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text check (char_length(full_name) <= 120),
  avatar_url         text check (char_length(avatar_url) <= 2048),
  preferred_language text not null default 'es' check (preferred_language in ('es', 'en')),
  preferred_currency text not null default 'PEN' check (preferred_currency ~ '^[A-Z]{3}$'),
  timezone           text not null default 'America/Lima' check (char_length(timezone) <= 64),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- No insert/delete policies: rows are created by the signup trigger and
-- removed by cascade when the auth user is deleted.

-- Create a profile (and a free subscription row) for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), '')
  );

  insert into public.subscriptions (user_id, plan, status, provider)
  values (new.id, 'free', 'active', 'none');

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- categories (system categories have user_id = null)
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  icon       text check (char_length(icon) <= 60),
  created_at timestamptz not null default now()
);

create unique index categories_system_name_key on public.categories (lower(name)) where user_id is null;
create unique index categories_user_name_key on public.categories (user_id, lower(name)) where user_id is not null;

alter table public.categories enable row level security;

create policy "categories: read system and own" on public.categories
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);

create policy "categories: insert own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "categories: update own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "categories: delete own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- System reference data (not demo data).
insert into public.categories (name, icon) values
  ('Electrónica', 'smartphone'),
  ('Computación', 'laptop'),
  ('Electrodomésticos', 'refrigerator'),
  ('Muebles', 'sofa'),
  ('Vehículos', 'car'),
  ('Relojes y joyería', 'watch'),
  ('Ropa y accesorios', 'shirt'),
  ('Deportes', 'dumbbell'),
  ('Herramientas', 'wrench'),
  ('Hogar', 'house'),
  ('Otros', 'package');

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 160),
  brand          text check (char_length(brand) <= 80),
  model          text check (char_length(model) <= 80),
  category_id    uuid references public.categories (id) on delete set null,
  description    text check (char_length(description) <= 4000),
  notes          text check (char_length(notes) <= 4000),
  purchase_date  date,
  purchase_price numeric(14, 2) check (purchase_price >= 0),
  currency       char(3) check (currency ~ '^[A-Z]{3}$'),
  seller         text check (char_length(seller) <= 160),
  serial_number  text check (char_length(serial_number) <= 120),
  image_path     text check (char_length(image_path) <= 512),
  status         public.product_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint products_price_requires_currency check (purchase_price is null or currency is not null),
  constraint products_id_user_key unique (id, user_id)
);

create index products_user_status_idx on public.products (user_id, status);
create index products_user_created_idx on public.products (user_id, created_at desc);
create index products_category_idx on public.products (category_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "products: read own" on public.products
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "products: insert own" on public.products
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and (c.user_id is null or c.user_id = (select auth.uid()))
      )
    )
  );

create policy "products: update own" on public.products
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and (c.user_id is null or c.user_id = (select auth.uid()))
      )
    )
  );

create policy "products: delete own" on public.products
  for delete to authenticated using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- documents (generic private files: warranties, manuals, invoices...)
-- -----------------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id    uuid,
  document_type public.document_type not null default 'other',
  title         text not null check (char_length(title) between 1 and 200),
  storage_path  text not null check (char_length(storage_path) <= 512),
  mime_type     text check (char_length(mime_type) <= 100),
  size_bytes    bigint check (size_bytes >= 0),
  expires_on    date,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint documents_id_user_key unique (id, user_id),
  constraint documents_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete set null (product_id)
);

create index documents_user_created_idx on public.documents (user_id, created_at desc);
create index documents_product_idx on public.documents (product_id);
create index documents_user_expires_idx on public.documents (user_id, expires_on) where expires_on is not null;

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- receipts
-- -----------------------------------------------------------------------------
create table public.receipts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id        uuid,
  merchant          text check (char_length(merchant) <= 160),
  receipt_number    text check (char_length(receipt_number) <= 80),
  purchase_date     date,
  total_amount      numeric(14, 2) check (total_amount >= 0),
  tax_amount        numeric(14, 2) check (tax_amount >= 0),
  currency          char(3) check (currency ~ '^[A-Z]{3}$'),
  storage_path      text check (char_length(storage_path) <= 512),
  processing_status public.processing_status not null default 'uploaded',
  extraction        jsonb,          -- raw validated extraction output, kept for traceability
  processing_error  text check (char_length(processing_error) <= 1000),
  confirmed_at      timestamptz,    -- set only when the user confirms the data
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint receipts_amount_requires_currency check (total_amount is null or currency is not null),
  constraint receipts_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete set null (product_id)
);

create index receipts_user_created_idx on public.receipts (user_id, created_at desc);
create index receipts_product_idx on public.receipts (product_id);
create index receipts_status_idx on public.receipts (processing_status)
  where processing_status in ('uploaded', 'processing');

create trigger receipts_set_updated_at
  before update on public.receipts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- warranties
-- -----------------------------------------------------------------------------
create table public.warranties (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id           uuid not null,
  provider             text check (char_length(provider) <= 160),
  start_date           date,
  end_date             date,
  coverage_description text check (char_length(coverage_description) <= 4000),
  source_document_id   uuid,
  verification_status  public.verification_status not null default 'manual',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint warranties_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint warranties_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete cascade,
  constraint warranties_document_fk foreign key (source_document_id, user_id)
    references public.documents (id, user_id) on delete set null (source_document_id)
);

create index warranties_product_idx on public.warranties (product_id);
create index warranties_user_end_idx on public.warranties (user_id, end_date);

create trigger warranties_set_updated_at
  before update on public.warranties
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- return_deadlines
-- -----------------------------------------------------------------------------
create table public.return_deadlines (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id          uuid not null,
  deadline_date       date not null,
  policy_details      text check (char_length(policy_details) <= 4000),
  source_document_id  uuid,
  verification_status public.verification_status not null default 'manual',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint return_deadlines_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete cascade,
  constraint return_deadlines_document_fk foreign key (source_document_id, user_id)
    references public.documents (id, user_id) on delete set null (source_document_id)
);

create index return_deadlines_product_idx on public.return_deadlines (product_id);
create index return_deadlines_user_date_idx on public.return_deadlines (user_id, deadline_date);

create trigger return_deadlines_set_updated_at
  before update on public.return_deadlines
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- reminders
-- -----------------------------------------------------------------------------
create table public.reminders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id            uuid,
  title                 text not null check (char_length(title) between 1 and 160),
  description           text check (char_length(description) <= 2000),
  scheduled_at          timestamptz not null,
  status                public.reminder_status not null default 'scheduled',
  notification_channels text[] not null default array['email']::text[]
    check (notification_channels <@ array['email', 'push', 'in_app']::text[]),
  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint reminders_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete set null (product_id)
);

create index reminders_user_scheduled_idx on public.reminders (user_id, scheduled_at);
-- Used by the backend scheduler to pick due reminders.
create index reminders_due_idx on public.reminders (scheduled_at) where status = 'scheduled';

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Owner-only CRUD policies for user content tables
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['documents', 'receipts', 'warranties', 'return_deadlines', 'reminders']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: read own" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s: insert own" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s: update own" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s: delete own" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- plan_limits — backend-configurable limits (source of truth)
-- -----------------------------------------------------------------------------
create table public.plan_limits (
  plan                  public.plan_id primary key,
  max_products          integer check (max_products is null or max_products >= 0),   -- null = unlimited
  scans_per_month       integer not null check (scans_per_month >= 0),
  storage_mb            integer not null check (storage_mb >= 0),
  ai_queries_per_month  integer check (ai_queries_per_month is null or ai_queries_per_month >= 0),
  updated_at            timestamptz not null default now()
);

alter table public.plan_limits enable row level security;

create policy "plan_limits: public read" on public.plan_limits
  for select to anon, authenticated using (true);

-- Storage and AI quotas are initial placeholders to be tuned before launch.
insert into public.plan_limits (plan, max_products, scans_per_month, storage_mb, ai_queries_per_month) values
  ('free',  10,   3,   250,   0),
  ('plus',  null, 30,  5120,  null),
  ('ultra', null, 100, 20480, null);

-- -----------------------------------------------------------------------------
-- subscriptions — written only by payment-provider webhooks (service role)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles (id) on delete cascade,
  provider                 text not null check (char_length(provider) <= 40),
  provider_customer_id     text check (char_length(provider_customer_id) <= 120),
  provider_subscription_id text unique check (char_length(provider_subscription_id) <= 120),
  plan                     public.plan_id not null default 'free',
  status                   public.subscription_status not null default 'active',
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions: read own" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- ai_usage — metering for OCR / extraction / assistant (written by server)
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  operation  text not null check (operation in ('ocr', 'extraction', 'classification', 'assistant')),
  units      integer not null default 1 check (units >= 0),
  provider   text not null check (char_length(provider) <= 60),
  status     text not null check (status in ('succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create index ai_usage_user_op_created_idx on public.ai_usage (user_id, operation, created_at desc);

alter table public.ai_usage enable row level security;

create policy "ai_usage: read own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Signup trigger (after subscriptions exists)
-- -----------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Private storage bucket. Object paths MUST start with the owner's user id:
--   {user_id}/{receipts|documents|products}/{uuid}.{ext}
-- Files are served to the browser only through short-lived signed URLs.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-files',
  'user-files',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
);

create policy "user-files: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
