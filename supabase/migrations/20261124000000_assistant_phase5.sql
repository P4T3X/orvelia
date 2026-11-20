-- =============================================================================
-- ORVELIA — Phase 5: ORVELIA AI
--   * Monthly assistant quota per plan + per-minute burst limit, in Postgres.
--   * Finite AI quotas: the Phase 0 seed had "unlimited" (null) for Plus/Ultra,
--     which leaves AI cost per user unbounded. Values below are placeholders to
--     tune before launch; Free keeps 0 (AI is not part of the Free plan).
-- =============================================================================

update public.plan_limits set ai_queries_per_month = 0   where plan = 'free';
update public.plan_limits set ai_queries_per_month = 100 where plan = 'plus';
update public.plan_limits set ai_queries_per_month = 500 where plan = 'ultra';

-- Usage of an operation in the user's current calendar month (their time zone).
create or replace function public.usage_this_month(p_user uuid, p_operation text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.ai_usage u
   where u.user_id = p_user
     and u.operation = p_operation
     and (u.status = 'succeeded' or (u.status = 'reserved' and u.created_at > now() - interval '15 minutes'))
     and u.created_at >= (
       date_trunc('month', now() at time zone coalesce(
         (select p.timezone from public.profiles p where p.id = p_user), 'America/Lima'))
       at time zone coalesce((select p.timezone from public.profiles p where p.id = p_user), 'America/Lima')
     );
$$;

revoke all on function public.usage_this_month(uuid, text) from public, anon, authenticated;

-- Reserve one assistant question. Raises:
--   ai_not_included  (plan quota is 0)
--   ai_limit_reached (monthly quota used)
--   rate_limited     (more than 10 questions in the last minute)
create or replace function public.reserve_assistant_query(p_provider text)
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

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 44));

  select ai_queries_per_month into v_limit from public.current_plan_limits(v_user);
  if v_limit = 0 then
    raise exception 'ai_not_included' using errcode = 'P0001';
  end if;
  if v_limit is not null and public.usage_this_month(v_user, 'assistant') >= v_limit then
    raise exception 'ai_limit_reached' using errcode = 'P0001', detail = format('limit=%s', v_limit);
  end if;
  if (select count(*) from public.ai_usage u
       where u.user_id = v_user and u.operation = 'assistant'
         and u.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.ai_usage (user_id, operation, units, provider, status)
  values (v_user, 'assistant', 1, left(coalesce(p_provider, 'unknown'), 60), 'reserved')
  returning id into v_id;
  return v_id;
end;
$$;

-- Close any reservation of the caller (assistant or scanner).
create or replace function public.finish_usage(p_usage_id uuid, p_succeeded boolean)
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

create or replace function public.assistant_usage()
returns table (used integer, queries_per_month integer, plan public.plan_id)
language sql
stable
security definer
set search_path = ''
as $$
  select public.usage_this_month(auth.uid(), 'assistant'), l.ai_queries_per_month, l.plan
    from public.current_plan_limits(auth.uid()) l
   where auth.uid() is not null;
$$;

revoke all on function public.reserve_assistant_query(text) from public, anon;
revoke all on function public.finish_usage(uuid, boolean) from public, anon;
revoke all on function public.assistant_usage() from public, anon;
grant execute on function public.reserve_assistant_query(text) to authenticated;
grant execute on function public.finish_usage(uuid, boolean) to authenticated;
grant execute on function public.assistant_usage() to authenticated;
