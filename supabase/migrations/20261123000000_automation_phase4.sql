-- =============================================================================
-- ORVELIA — Phase 4: automation
--   * Warranty kind.
--   * Automatic reminders generated in the database whenever a warranty end
--     date, return deadline or document expiry is created or changed.
--   * Notification preferences and an in-app notification inbox.
--   * claim/complete functions for the scheduled delivery job (service role).
-- Reminders fire at 09:00 in the user's time zone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- warranties
-- -----------------------------------------------------------------------------
alter table public.warranties
  add column kind text not null default 'manufacturer'
    check (kind in ('manufacturer', 'store', 'extended', 'other'));

-- -----------------------------------------------------------------------------
-- reminders
-- -----------------------------------------------------------------------------
create type public.reminder_source as enum ('warranty', 'return', 'document', 'custom');

alter table public.reminders
  add column source public.reminder_source not null default 'custom',
  add column source_id uuid,
  add column lead_days integer check (lead_days between 0 and 365),
  add column recurrence text not null default 'none'
    check (recurrence in ('none', 'monthly', 'quarterly', 'semiannual', 'yearly')),
  add column claimed_at timestamptz,
  add column attempts integer not null default 0,
  add column last_error text check (char_length(last_error) <= 500),
  add constraint reminders_auto_has_source check (source = 'custom' or source_id is not null),
  add constraint reminders_recurrence_custom_only check (recurrence = 'none' or source = 'custom');

create index reminders_source_idx on public.reminders (source, source_id) where source <> 'custom';

-- Users create only custom reminders; automatic ones come from triggers.
drop policy "reminders: insert own" on public.reminders;
create policy "reminders: insert own custom" on public.reminders
  for insert to authenticated
  with check ((select auth.uid()) = user_id and source = 'custom' and status = 'scheduled');

-- Users may edit what they see, never the delivery bookkeeping.
revoke update on public.reminders from authenticated;
grant update (title, description, scheduled_at, status, notification_channels, recurrence, product_id)
  on public.reminders to authenticated;

-- -----------------------------------------------------------------------------
-- notification_preferences
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  email_enabled      boolean not null default true,
  warranty_lead_days integer[] not null default '{30,7}',
  return_lead_days   integer[] not null default '{3,1}',
  document_lead_days integer[] not null default '{30,7}',
  updated_at         timestamptz not null default now(),
  constraint notification_preferences_leads check (
    cardinality(warranty_lead_days) <= 5 and 0 <= all (warranty_lead_days) and 365 >= all (warranty_lead_days)
    and cardinality(return_lead_days) <= 5 and 0 <= all (return_lead_days) and 365 >= all (return_lead_days)
    and cardinality(document_lead_days) <= 5 and 0 <= all (document_lead_days) and 365 >= all (document_lead_days)
  )
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "notification_preferences: read own" on public.notification_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notification_preferences: insert own" on public.notification_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notification_preferences: update own" on public.notification_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- notifications (in-app inbox; written only by the delivery job)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reminder_id  uuid references public.reminders (id) on delete set null,
  title        text not null check (char_length(title) <= 200),
  body         text check (char_length(body) <= 2000),
  link         text check (link like '/app%' and char_length(link) <= 300),
  email_status text not null default 'not_requested'
    check (email_status in ('sent', 'skipped', 'failed', 'not_requested')),
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: read own" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications: update own" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- Automatic reminders
-- -----------------------------------------------------------------------------
create or replace function public.reminder_time(p_user uuid, p_date date, p_lead integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_date - p_lead)::timestamp + time '09:00')
         at time zone coalesce((select p.timezone from public.profiles p where p.id = p_user), 'America/Lima');
$$;

create or replace function public.lead_phrase(p_lead integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_lead when 0 then 'hoy' when 1 then 'mañana' else format('en %s días', p_lead) end;
$$;

create or replace function public.sync_auto_reminders(p_source public.reminder_source, p_source_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_product uuid;
  v_date date;
  v_label text;
  v_leads integer[];
  v_email boolean;
  v_lead integer;
  v_at timestamptz;
  v_title text;
begin
  -- Pending automatic reminders for this source are always rebuilt from scratch.
  delete from public.reminders
   where source = p_source and source_id = p_source_id and status = 'scheduled';

  if p_source = 'warranty' then
    select w.user_id, w.product_id, w.end_date, p.name
      into v_user, v_product, v_date, v_label
      from public.warranties w join public.products p on p.id = w.product_id
     where w.id = p_source_id;
  elsif p_source = 'return' then
    select r.user_id, r.product_id, r.deadline_date, p.name
      into v_user, v_product, v_date, v_label
      from public.return_deadlines r join public.products p on p.id = r.product_id
     where r.id = p_source_id;
  elsif p_source = 'document' then
    select d.user_id, d.product_id, d.expires_on, d.title
      into v_user, v_product, v_date, v_label
      from public.documents d
     where d.id = p_source_id;
  else
    return;
  end if;

  if v_user is null or v_date is null then
    return;
  end if;

  select
    case p_source when 'warranty' then np.warranty_lead_days
                  when 'return' then np.return_lead_days
                  else np.document_lead_days end,
    np.email_enabled
    into v_leads, v_email
    from public.notification_preferences np
   where np.user_id = v_user;

  if not found then
    v_leads := case p_source when 'return' then '{3,1}'::integer[] else '{30,7}'::integer[] end;
    v_email := true;
  end if;

  foreach v_lead in array coalesce(v_leads, '{}')
  loop
    v_at := public.reminder_time(v_user, v_date, v_lead);
    continue when v_at <= now();

    v_title := case p_source
      when 'warranty' then format('La garantía de %s vence %s', v_label, public.lead_phrase(v_lead))
      when 'return' then format('El plazo para devolver %s vence %s', v_label, public.lead_phrase(v_lead))
      else format('%s vence %s', v_label, public.lead_phrase(v_lead))
    end;

    insert into public.reminders
      (user_id, product_id, title, scheduled_at, status, notification_channels, source, source_id, lead_days)
    values
      (v_user, v_product, left(v_title, 160), v_at, 'scheduled',
       case when v_email then array['email', 'in_app'] else array['in_app'] end,
       p_source, p_source_id, v_lead);
  end loop;
end;
$$;

revoke all on function public.sync_auto_reminders(public.reminder_source, uuid) from public, anon, authenticated;

create or replace function public.trg_sync_auto_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.reminder_source := tg_argv[0]::public.reminder_source;
begin
  if tg_op = 'DELETE' then
    delete from public.reminders where source = v_source and source_id = old.id and status = 'scheduled';
    return old;
  end if;
  perform public.sync_auto_reminders(v_source, new.id);
  return new;
end;
$$;

create trigger warranties_sync_reminders
  after insert or update of end_date, product_id or delete on public.warranties
  for each row execute function public.trg_sync_auto_reminders('warranty');

create trigger return_deadlines_sync_reminders
  after insert or update of deadline_date, product_id or delete on public.return_deadlines
  for each row execute function public.trg_sync_auto_reminders('return');

create trigger documents_sync_reminders
  after insert or update of expires_on, title or delete on public.documents
  for each row execute function public.trg_sync_auto_reminders('document');

-- Product renamed → reminder titles follow.
create or replace function public.trg_product_renamed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.warranties where product_id = new.id loop
    perform public.sync_auto_reminders('warranty', r.id);
  end loop;
  for r in select id from public.return_deadlines where product_id = new.id loop
    perform public.sync_auto_reminders('return', r.id);
  end loop;
  return new;
end;
$$;

create trigger products_rename_sync_reminders
  after update of name on public.products
  for each row when (old.name is distinct from new.name)
  execute function public.trg_product_renamed();

-- Rebuild every automatic reminder of the caller (after changing preferences or time zone).
create or replace function public.resync_my_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  r record;
  n integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  for r in
    select 'warranty'::public.reminder_source as s, id from public.warranties where user_id = v_user
    union all select 'return', id from public.return_deadlines where user_id = v_user
    union all select 'document', id from public.documents where user_id = v_user and expires_on is not null
  loop
    perform public.sync_auto_reminders(r.s, r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.resync_my_reminders() from public, anon;
grant execute on function public.resync_my_reminders() to authenticated;

-- -----------------------------------------------------------------------------
-- Delivery job API (service role only)
-- -----------------------------------------------------------------------------
-- Atomically claim due reminders. A claim older than 10 minutes is considered
-- abandoned (crashed job) and can be claimed again.
create or replace function public.claim_due_reminders(p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  title text,
  description text,
  product_id uuid,
  source public.reminder_source,
  channels text[],
  email_enabled boolean,
  attempts integer,
  scheduled_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select r.id
      from public.reminders r
     where r.status = 'scheduled'
       and r.scheduled_at <= now()
       and (r.claimed_at is null or r.claimed_at < now() - interval '10 minutes')
     order by r.scheduled_at
     limit least(greatest(p_limit, 1), 500)
     for update skip locked
  ), claimed as (
    update public.reminders r
       set claimed_at = now()
      from due
     where r.id = due.id
    returning r.*
  )
  select c.id, c.user_id, u.email::text, p.full_name, c.title, c.description, c.product_id, c.source,
         c.notification_channels, coalesce(np.email_enabled, true), c.attempts, c.scheduled_at
    from claimed c
    join auth.users u on u.id = c.user_id
    left join public.profiles p on p.id = c.user_id
    left join public.notification_preferences np on np.user_id = c.user_id;
$$;

-- Record the outcome of one reminder. On a transient email failure the job
-- calls this with p_retry = true (up to 3 attempts); otherwise the reminder is
-- marked sent, an in-app notification is created, and a recurring reminder
-- schedules its next occurrence.
create or replace function public.complete_reminder(
  p_id uuid,
  p_email_status text,
  p_error text default null,
  p_retry boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reminders;
  v_next timestamptz;
  v_link text;
begin
  select * into r from public.reminders where id = p_id for update;
  if not found or r.status <> 'scheduled' then
    return;
  end if;

  if p_retry and r.attempts < 2 then
    update public.reminders
       set attempts = attempts + 1, claimed_at = null, last_error = left(p_error, 500)
     where id = p_id;
    return;
  end if;

  update public.reminders
     set status = 'sent', sent_at = now(), claimed_at = null,
         attempts = attempts + 1, last_error = left(p_error, 500)
   where id = p_id;

  v_link := case
    when r.product_id is not null then '/app/products/' || r.product_id
    when r.source = 'document' then '/app/documents'
    else '/app/calendar'
  end;

  insert into public.notifications (user_id, reminder_id, title, body, link, email_status)
  values (r.user_id, r.id, r.title, r.description, v_link, coalesce(p_email_status, 'not_requested'));

  if r.recurrence <> 'none' then
    v_next := r.scheduled_at + case r.recurrence
      when 'monthly' then interval '1 month'
      when 'quarterly' then interval '3 months'
      when 'semiannual' then interval '6 months'
      else interval '1 year' end;
    while v_next <= now() loop
      v_next := v_next + case r.recurrence
        when 'monthly' then interval '1 month'
        when 'quarterly' then interval '3 months'
        when 'semiannual' then interval '6 months'
        else interval '1 year' end;
    end loop;
    insert into public.reminders
      (user_id, product_id, title, description, scheduled_at, status, notification_channels, source, recurrence)
    values
      (r.user_id, r.product_id, r.title, r.description, v_next, 'scheduled', r.notification_channels, 'custom', r.recurrence);
  end if;
end;
$$;

revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated;
revoke all on function public.complete_reminder(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;
grant execute on function public.complete_reminder(uuid, text, text, boolean) to service_role;
