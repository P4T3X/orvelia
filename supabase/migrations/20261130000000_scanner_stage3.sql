-- =============================================================================
-- ORVELIA — Stage 3: Smart Scanner
--   * Per-receipt processing history: attempts, last attempt time, error code.
--   * At most 3 failed automatic readings per receipt (failed readings do not
--     count toward the monthly quota, so this keeps retries bounded).
--   * reserve_scan records each attempt atomically with the quota check.
-- =============================================================================

alter table public.receipts
  add column processing_attempts integer not null default 0 check (processing_attempts >= 0),
  add column last_attempt_at timestamptz,
  add column processing_error_code text
    check (processing_error_code in ('timeout', 'invalid_output', 'provider_error', 'configuration', 'file_missing', 'not_purchase'));

-- Constant shared with the app (packages/domain MAX_SCAN_ATTEMPTS).
create or replace function public.max_failed_scans_per_receipt()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

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

  if (select count(*) from public.ai_usage u
       where u.receipt_id = p_receipt_id and u.operation = 'extraction' and u.status = 'failed')
     >= public.max_failed_scans_per_receipt() then
    raise exception 'retry_limit_reached' using errcode = 'P0001';
  end if;

  select scans_per_month into v_limit from public.current_plan_limits(v_user);
  if public.scans_used_this_month(v_user) >= coalesce(v_limit, 0) then
    raise exception 'scan_limit_reached' using errcode = 'P0001', detail = format('limit=%s', v_limit);
  end if;

  insert into public.ai_usage (user_id, operation, units, provider, status, receipt_id)
  values (v_user, 'extraction', 1, left(coalesce(p_provider, 'unknown'), 60), 'reserved', p_receipt_id)
  returning id into v_id;

  update public.receipts
     set processing_attempts = processing_attempts + 1,
         last_attempt_at = now()
   where id = p_receipt_id and user_id = v_user;

  return v_id;
end;
$$;

revoke all on function public.reserve_scan(uuid, text) from public, anon;
grant execute on function public.reserve_scan(uuid, text) to authenticated;
revoke all on function public.max_failed_scans_per_receipt() from public, anon;
grant execute on function public.max_failed_scans_per_receipt() to authenticated;

-- Failed readings left for a receipt (for the UI).
create or replace function public.scan_retries_left(p_receipt_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, public.max_failed_scans_per_receipt() - count(*)::integer)
    from public.ai_usage u
   where u.receipt_id = p_receipt_id
     and u.user_id = auth.uid()
     and u.operation = 'extraction'
     and u.status = 'failed';
$$;

revoke all on function public.scan_retries_left(uuid) from public, anon;
grant execute on function public.scan_retries_left(uuid) to authenticated;
