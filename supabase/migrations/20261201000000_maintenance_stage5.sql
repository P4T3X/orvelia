-- =============================================================================
-- ORVELIA — Stage 5: Smart Calendar — maintenance schedules
--   * maintenance_plans: what to do for a product and how often.
--   * maintenance_logs: what was actually done (date, cost, who, notes).
--   * complete_maintenance(): records a log and moves the plan's next date in
--     one transaction.
--   * Automatic reminders (source 'maintenance') before and on the due date,
--     rebuilt by trigger like warranties and returns.
-- =============================================================================

alter type public.reminder_source add value if not exists 'maintenance';

-- -----------------------------------------------------------------------------
-- maintenance_plans
-- -----------------------------------------------------------------------------
create table public.maintenance_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id     uuid not null,
  title          text not null check (char_length(title) between 1 and 160),
  notes          text check (char_length(notes) <= 2000),
  interval_count integer not null check (interval_count between 1 and 365),
  interval_unit  text not null check (interval_unit in ('days', 'weeks', 'months', 'years')),
  next_due_date  date not null,
  last_done_date date,
  lead_days      integer not null default 7 check (lead_days between 0 and 90),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint maintenance_plans_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete cascade,
  constraint maintenance_plans_id_user_key unique (id, user_id)
);

create index maintenance_plans_user_due_idx on public.maintenance_plans (user_id, next_due_date) where active;
create index maintenance_plans_product_idx on public.maintenance_plans (product_id);

create trigger maintenance_plans_set_updated_at
  before update on public.maintenance_plans
  for each row execute function public.set_updated_at();

alter table public.maintenance_plans enable row level security;

create policy "maintenance_plans: select own" on public.maintenance_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "maintenance_plans: insert own" on public.maintenance_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "maintenance_plans: update own" on public.maintenance_plans
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "maintenance_plans: delete own" on public.maintenance_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.maintenance_plans from anon;

-- -----------------------------------------------------------------------------
-- maintenance_logs
-- -----------------------------------------------------------------------------
create table public.maintenance_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id   uuid not null,
  plan_id      uuid,
  title        text not null check (char_length(title) between 1 and 160),
  performed_on date not null,
  cost         numeric(12, 2) check (cost >= 0),
  currency     text check (currency ~ '^[A-Z]{3}$'),
  provider     text check (char_length(provider) <= 160),
  notes        text check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  constraint maintenance_logs_cost_currency check ((cost is null) = (currency is null)),
  constraint maintenance_logs_product_fk foreign key (product_id, user_id)
    references public.products (id, user_id) on delete cascade,
  constraint maintenance_logs_plan_fk foreign key (plan_id, user_id)
    references public.maintenance_plans (id, user_id) on delete set null (plan_id)
);

create index maintenance_logs_product_idx on public.maintenance_logs (product_id, performed_on desc);
create index maintenance_logs_user_idx on public.maintenance_logs (user_id, performed_on desc);
create index maintenance_logs_plan_idx on public.maintenance_logs (plan_id);

alter table public.maintenance_logs enable row level security;

create policy "maintenance_logs: select own" on public.maintenance_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "maintenance_logs: insert own" on public.maintenance_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "maintenance_logs: update own" on public.maintenance_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "maintenance_logs: delete own" on public.maintenance_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.maintenance_logs from anon;

-- -----------------------------------------------------------------------------
-- Date math shared by the app and the database
-- -----------------------------------------------------------------------------
create or replace function public.maintenance_next_date(p_from date, p_count integer, p_unit text)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_from + case p_unit
      when 'days' then make_interval(days => p_count)
      when 'weeks' then make_interval(weeks => p_count)
      when 'months' then make_interval(months => p_count)
      when 'years' then make_interval(years => p_count)
    end)::date;
$$;

-- Record a completed maintenance and schedule the next one. Runs with the
-- caller's rights: RLS guarantees the plan belongs to the caller.
create or replace function public.complete_maintenance(
  p_plan_id uuid,
  p_performed_on date,
  p_cost numeric default null,
  p_currency text default null,
  p_provider text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.maintenance_plans;
  v_log uuid;
begin
  select * into v_plan from public.maintenance_plans where id = p_plan_id for update;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if p_performed_on > (now() at time zone coalesce(
       (select p.timezone from public.profiles p where p.id = v_plan.user_id), 'America/Lima'))::date then
    raise exception 'performed_in_future' using errcode = 'P0001';
  end if;

  insert into public.maintenance_logs (user_id, product_id, plan_id, title, performed_on, cost, currency, provider, notes)
  values (v_plan.user_id, v_plan.product_id, v_plan.id, v_plan.title, p_performed_on, p_cost,
          case when p_cost is null then null else p_currency end, p_provider, p_notes)
  returning id into v_log;

  -- Only move forward: logging an older visit never pulls the schedule back.
  update public.maintenance_plans
     set last_done_date = greatest(coalesce(last_done_date, p_performed_on), p_performed_on),
         next_due_date = greatest(
           next_due_date,
           public.maintenance_next_date(greatest(coalesce(last_done_date, p_performed_on), p_performed_on), interval_count, interval_unit))
   where id = v_plan.id
     and (last_done_date is null or p_performed_on >= last_done_date);

  return v_log;
end;
$$;

revoke all on function public.complete_maintenance(uuid, date, numeric, text, text, text) from public, anon;
grant execute on function public.complete_maintenance(uuid, date, numeric, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Automatic reminders for maintenance
-- -----------------------------------------------------------------------------
create or replace function public.sync_maintenance_reminders(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan record;
  v_email boolean;
  v_lead integer;
  v_at timestamptz;
  v_title text;
begin
  delete from public.reminders
   where source = 'maintenance' and source_id = p_plan_id and status = 'scheduled';

  select m.user_id, m.product_id, m.title, m.next_due_date, m.lead_days, m.active, p.name as product_name
    into v_plan
    from public.maintenance_plans m join public.products p on p.id = m.product_id
   where m.id = p_plan_id;
  if not found or not v_plan.active then
    return;
  end if;

  select np.email_enabled into v_email from public.notification_preferences np where np.user_id = v_plan.user_id;
  v_email := coalesce(v_email, true);

  foreach v_lead in array (select array_agg(distinct x) from unnest(array[v_plan.lead_days, 0]) x)
  loop
    v_at := public.reminder_time(v_plan.user_id, v_plan.next_due_date, v_lead);
    continue when v_at <= now();
    v_title := case when v_lead = 0
      then format('Hoy toca: %s (%s)', v_plan.title, v_plan.product_name)
      else format('%s de %s: %s', v_plan.title, v_plan.product_name, public.lead_phrase(v_lead))
    end;
    insert into public.reminders
      (user_id, product_id, title, scheduled_at, status, notification_channels, source, source_id, lead_days)
    values
      (v_plan.user_id, v_plan.product_id, left(v_title, 160), v_at, 'scheduled',
       case when v_email then array['email', 'in_app'] else array['in_app'] end,
       'maintenance', p_plan_id, v_lead);
  end loop;
end;
$$;

revoke all on function public.sync_maintenance_reminders(uuid) from public, anon, authenticated;

create or replace function public.trg_sync_maintenance_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.reminders where source = 'maintenance' and source_id = old.id and status = 'scheduled';
    return old;
  end if;
  perform public.sync_maintenance_reminders(new.id);
  return new;
end;
$$;

create trigger maintenance_plans_sync_reminders
  after insert or update of next_due_date, lead_days, active, title, product_id or delete on public.maintenance_plans
  for each row execute function public.trg_sync_maintenance_reminders();

-- Product renamed → maintenance reminder titles follow.
create or replace function public.trg_product_renamed_maintenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.maintenance_plans where product_id = new.id loop
    perform public.sync_maintenance_reminders(r.id);
  end loop;
  return new;
end;
$$;

create trigger products_rename_sync_maintenance
  after update of name on public.products
  for each row when (old.name is distinct from new.name)
  execute function public.trg_product_renamed_maintenance();

revoke all on function public.trg_sync_maintenance_reminders() from public, anon, authenticated;
revoke all on function public.trg_product_renamed_maintenance() from public, anon, authenticated;
