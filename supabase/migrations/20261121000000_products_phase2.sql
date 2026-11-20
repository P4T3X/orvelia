-- =============================================================================
-- ORVELIA — Phase 2: ownership management
--   * Plan product limit enforced in the database (not only in the UI).
--   * Accent-insensitive search over name, brand, model, serial and seller.
--   * Product images must live in the owner's folder of the private bucket.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Search
-- -----------------------------------------------------------------------------
-- translate() is immutable (unlike unaccent()), so it can back a generated
-- column. The app normalizes the search term the same way.
alter table public.products
  add column search_text text generated always as (
    translate(
      lower(
        coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' ||
        coalesce(serial_number, '') || ' ' || coalesce(seller, '')
      ),
      'áàäâãéèëêíìïîóòöôõúùüûñç',
      'aaaaaeeeeiiiiooooouuuunc'
    )
  ) stored;

create index products_search_trgm_idx on public.products using gin (search_text extensions.gin_trgm_ops);
create index products_user_name_idx on public.products (user_id, lower(name));
create index products_user_purchase_date_idx on public.products (user_id, purchase_date desc nulls last);

-- -----------------------------------------------------------------------------
-- Image path ownership: {user_id}/products/...
-- -----------------------------------------------------------------------------
alter table public.products
  add constraint products_image_path_owner check (
    image_path is null or image_path like (user_id::text || '/products/%')
  );

-- -----------------------------------------------------------------------------
-- Product limit per plan (source of truth: plan_limits)
-- -----------------------------------------------------------------------------
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
  -- Serialize concurrent inserts for the same user so two requests cannot
  -- both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 42));

  select pl.max_products
    into v_limit
    from public.subscriptions s
    join public.plan_limits pl on pl.plan = s.plan
   where s.user_id = new.user_id
     and s.status in ('active', 'trialing');

  if not found then
    -- No active paid subscription: fall back to the Free plan limits.
    select pl.max_products into v_limit from public.plan_limits pl where pl.plan = 'free';
  end if;

  if v_limit is not null then
    select count(*) into v_count from public.products p where p.user_id = new.user_id;
    if v_count >= v_limit then
      raise exception 'product_limit_reached'
        using errcode = 'P0001', detail = format('limit=%s', v_limit);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_product_limit() from public, anon, authenticated;

create trigger products_enforce_limit
  before insert on public.products
  for each row execute function public.enforce_product_limit();

-- -----------------------------------------------------------------------------
-- Usage summary for the UI (counts only; respects RLS via auth.uid()).
-- -----------------------------------------------------------------------------
create or replace function public.product_usage()
returns table (used integer, max_products integer, plan public.plan_id)
language sql
stable
security invoker
set search_path = ''
as $$
  with sub as (
    select case when s.status in ('active', 'trialing') then s.plan else 'free'::public.plan_id end as plan
      from public.subscriptions s
     where s.user_id = (select auth.uid())
  )
  select
    (select count(*)::integer from public.products p where p.user_id = (select auth.uid())),
    pl.max_products,
    pl.plan
  from public.plan_limits pl
  where pl.plan = coalesce((select plan from sub), 'free');
$$;

grant execute on function public.product_usage() to authenticated;
