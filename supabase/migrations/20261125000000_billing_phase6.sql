-- =============================================================================
-- ORVELIA — Phase 6: monetization (Mercado Pago Suscripciones)
--   * Prices live in plan_limits (server is the source of truth).
--   * effective_plan(): paid plan while active/trialing, and also while
--     canceled or past_due until the paid period ends. Every limit uses it.
--   * billing_checkouts: each checkout the server starts (maps a provider
--     subscription to a user and plan; never trusted from the client).
--   * billing_events: webhook log for idempotency and audit.
-- All billing writes happen with the service role (webhook / server code).
-- =============================================================================

alter table public.plan_limits
  add column price_monthly numeric(10, 2) not null default 0 check (price_monthly >= 0),
  add column currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$');

update public.plan_limits set price_monthly = 0,     currency = 'PEN' where plan = 'free';
update public.plan_limits set price_monthly = 19.99, currency = 'PEN' where plan = 'plus';
update public.plan_limits set price_monthly = 29.99, currency = 'PEN' where plan = 'ultra';

alter table public.subscriptions
  add column cancel_at_period_end boolean not null default false,
  add column last_payment_status text check (char_length(last_payment_status) <= 40);

-- -----------------------------------------------------------------------------
-- Effective plan
-- -----------------------------------------------------------------------------
create or replace function public.effective_plan(p_user uuid)
returns public.plan_id
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan
       from public.subscriptions s
      where s.user_id = p_user
        and (
          s.status in ('active', 'trialing')
          or (s.status in ('canceled', 'past_due') and s.current_period_end > now())
        )),
    'free'::public.plan_id);
$$;

revoke all on function public.effective_plan(uuid) from public, anon, authenticated;

create or replace function public.current_plan_limits(p_user uuid)
returns public.plan_limits
language sql
stable
security definer
set search_path = ''
as $$
  select pl.* from public.plan_limits pl where pl.plan = public.effective_plan(p_user);
$$;

-- Product limit uses the effective plan too.
create or replace function public.enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 42));
  select max_products into v_limit from public.current_plan_limits(new.user_id);
  if v_limit is not null then
    select count(*) into v_count from public.products p where p.user_id = new.user_id;
    if v_count >= v_limit then
      raise exception 'product_limit_reached' using errcode = 'P0001', detail = format('limit=%s', v_limit);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.product_usage()
returns table (used integer, max_products integer, plan public.plan_id)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer from public.products p where p.user_id = auth.uid()),
         l.max_products, l.plan
    from public.current_plan_limits(auth.uid()) l
   where auth.uid() is not null;
$$;

grant execute on function public.product_usage() to authenticated;

-- -----------------------------------------------------------------------------
-- billing_checkouts
-- -----------------------------------------------------------------------------
create table public.billing_checkouts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  plan                     public.plan_id not null check (plan <> 'free'),
  amount                   numeric(10, 2) not null check (amount > 0),
  currency                 char(3) not null,
  provider                 text not null default 'mercadopago',
  provider_subscription_id text unique,
  status                   text not null default 'created'
    check (status in ('created', 'pending', 'authorized', 'cancelled', 'expired', 'failed')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index billing_checkouts_user_idx on public.billing_checkouts (user_id, created_at desc);

create trigger billing_checkouts_set_updated_at
  before update on public.billing_checkouts
  for each row execute function public.set_updated_at();

alter table public.billing_checkouts enable row level security;
create policy "billing_checkouts: read own" on public.billing_checkouts
  for select to authenticated using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- billing_events (webhook log)
-- -----------------------------------------------------------------------------
create table public.billing_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  event_id      text not null,
  type          text not null,
  data_id       text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text check (char_length(error) <= 500),
  constraint billing_events_unique unique (provider, event_id)
);

alter table public.billing_events enable row level security;
-- No policies: only the service role reads or writes this table.

-- -----------------------------------------------------------------------------
-- UI helper: plan, prices and usage in one call
-- -----------------------------------------------------------------------------
create or replace function public.billing_overview()
returns table (
  effective_plan public.plan_id,
  subscribed_plan public.plan_id,
  status public.subscription_status,
  provider text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  last_payment_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select public.effective_plan(auth.uid()), s.plan, s.status, s.provider,
         s.current_period_end, s.cancel_at_period_end, s.last_payment_status
    from public.subscriptions s
   where s.user_id = auth.uid();
$$;

revoke all on function public.billing_overview() from public, anon;
grant execute on function public.billing_overview() to authenticated;
