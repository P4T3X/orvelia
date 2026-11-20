-- =============================================================================
-- ORVELIA — Phase 3: document intelligence
--   * A product points to the receipt it was bought with (products.receipt_id);
--     one receipt can cover several products. Replaces receipts.product_id
--     (no data existed yet when this migration was written).
--   * Monthly scan quota enforced in the database (reserve → finish).
--   * Storage paths of receipts and documents must live in the owner's folder.
--   * Per-field provenance for confirmed receipt data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- receipts
-- -----------------------------------------------------------------------------
alter table public.receipts drop constraint receipts_product_fk;
drop index if exists public.receipts_product_idx;
alter table public.receipts drop column product_id;

alter table public.receipts
  add constraint receipts_id_user_key unique (id, user_id),
  add column mime_type text check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  add column size_bytes bigint check (size_bytes between 1 and 10485760),
  -- For each confirmed field: 'extracted' (read from the document and kept as is)
  -- or 'manual' (typed or corrected by the user).
  add column field_sources jsonb not null default '{}'::jsonb,
  add constraint receipts_storage_path_owner check (
    storage_path is null or storage_path like (user_id::text || '/receipts/%')
  ),
  add constraint receipts_confirmed_consistency check (
    (processing_status = 'confirmed') = (confirmed_at is not null)
  );

create index receipts_user_status_idx on public.receipts (user_id, processing_status, created_at desc);

-- -----------------------------------------------------------------------------
-- products.receipt_id
-- -----------------------------------------------------------------------------
alter table public.products
  add column receipt_id uuid,
  add constraint products_receipt_fk foreign key (receipt_id, user_id)
    references public.receipts (id, user_id) on delete set null (receipt_id);

create index products_receipt_idx on public.products (receipt_id) where receipt_id is not null;

-- -----------------------------------------------------------------------------
-- documents
-- -----------------------------------------------------------------------------
alter table public.documents
  add constraint documents_storage_path_owner check (storage_path like (user_id::text || '/documents/%')),
  add constraint documents_mime_type_allowed check (
    mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  );

create index documents_user_type_idx on public.documents (user_id, document_type, created_at desc);

-- -----------------------------------------------------------------------------
-- Scan quota
-- -----------------------------------------------------------------------------
alter table public.ai_usage drop constraint ai_usage_status_check;
alter table public.ai_usage
  add constraint ai_usage_status_check check (status in ('reserved', 'succeeded', 'failed')),
  add column receipt_id uuid,
  add column finished_at timestamptz;

-- Scans that count this month: succeeded, or reserved in the last 15 minutes
-- (a reservation older than that belongs to a crashed request and is ignored).
create or replace function public.scans_used_this_month(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.ai_usage u
   where u.user_id = p_user
     and u.operation = 'extraction'
     and (u.status = 'succeeded' or (u.status = 'reserved' and u.created_at > now() - interval '15 minutes'))
     and u.created_at >= (
       date_trunc('month', now() at time zone coalesce(
         (select p.timezone from public.profiles p where p.id = p_user), 'America/Lima'))
       at time zone coalesce((select p.timezone from public.profiles p where p.id = p_user), 'America/Lima')
     );
$$;

revoke all on function public.scans_used_this_month(uuid) from public, anon, authenticated;

create or replace function public.current_plan_limits(p_user uuid)
returns public.plan_limits
language sql
stable
security definer
set search_path = ''
as $$
  select pl.*
    from public.plan_limits pl
   where pl.plan = coalesce(
     (select s.plan from public.subscriptions s
       where s.user_id = p_user and s.status in ('active', 'trialing')),
     'free');
$$;

revoke all on function public.current_plan_limits(uuid) from public, anon, authenticated;

-- Reserve one scan for a receipt the caller owns. Raises scan_limit_reached.
create or replace function public.reserve_scan(p_receipt_id uuid, p_provider text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.receipts r where r.id = p_receipt_id and r.user_id = v_user) then
    raise exception 'receipt_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 43));

  select scans_per_month into v_limit from public.current_plan_limits(v_user);
  if public.scans_used_this_month(v_user) >= coalesce(v_limit, 0) then
    raise exception 'scan_limit_reached' using errcode = 'P0001', detail = format('limit=%s', v_limit);
  end if;

  insert into public.ai_usage (user_id, operation, units, provider, status, receipt_id)
  values (v_user, 'extraction', 1, left(coalesce(p_provider, 'unknown'), 60), 'reserved', p_receipt_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Close a reservation. Failed scans do not count toward the quota.
create or replace function public.finish_scan(p_usage_id uuid, p_succeeded boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set status = case when p_succeeded then 'succeeded' else 'failed' end,
         finished_at = now()
   where id = p_usage_id
     and user_id = auth.uid()
     and status = 'reserved';
$$;

create or replace function public.scan_usage()
returns table (used integer, scans_per_month integer, plan public.plan_id)
language sql
stable
security definer
set search_path = ''
as $$
  select public.scans_used_this_month(auth.uid()), l.scans_per_month, l.plan
    from public.current_plan_limits(auth.uid()) l
   where auth.uid() is not null;
$$;

revoke all on function public.reserve_scan(uuid, text) from public, anon;
revoke all on function public.finish_scan(uuid, boolean) from public, anon;
revoke all on function public.scan_usage() from public, anon;
grant execute on function public.reserve_scan(uuid, text) to authenticated;
grant execute on function public.finish_scan(uuid, boolean) to authenticated;
grant execute on function public.scan_usage() to authenticated;
