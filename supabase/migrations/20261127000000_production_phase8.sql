-- =============================================================================
-- ORVELIA — Phase 8: production hardening
--   * Indexes for foreign keys that lacked one (cascades and joins).
--   * Trigger functions and internal helpers are not callable through the API.
--   * Beta feedback, with a per-user daily cap.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Foreign-key indexes (found by supabase/tests/security_audit.sql)
-- -----------------------------------------------------------------------------
create index if not exists warranties_source_document_idx on public.warranties (source_document_id) where source_document_id is not null;
create index if not exists return_deadlines_source_document_idx on public.return_deadlines (source_document_id) where source_document_id is not null;
create index if not exists reminders_product_idx on public.reminders (product_id) where product_id is not null;
create index if not exists notifications_reminder_idx on public.notifications (reminder_id) where reminder_id is not null;
create index if not exists activity_logs_actor_idx on public.activity_logs (actor_id) where actor_id is not null;
create index if not exists activity_logs_target_idx on public.activity_logs (target_user_id) where target_user_id is not null;
create index if not exists family_invitations_invited_by_idx on public.family_invitations (invited_by) where invited_by is not null;
create index if not exists family_invitations_accepted_by_idx on public.family_invitations (accepted_by) where accepted_by is not null;
create index if not exists shared_resources_shared_by_idx on public.shared_resources (shared_by) where shared_by is not null;

-- -----------------------------------------------------------------------------
-- Trigger functions run as triggers only; nobody calls them through the API.
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end;
$$;

-- product_usage() reads auth.uid(); it is for signed-in users only.
revoke all on function public.product_usage() from public, anon;
grant execute on function public.product_usage() to authenticated;

-- -----------------------------------------------------------------------------
-- Beta feedback
-- -----------------------------------------------------------------------------
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('idea', 'problem', 'other')),
  message    text not null check (char_length(message) between 5 and 2000),
  page       text check (page is null or (char_length(page) <= 200 and page like '/%')),
  created_at timestamptz not null default now()
);

create index feedback_user_created_idx on public.feedback (user_id, created_at desc);
create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "feedback: insert own" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "feedback: read own" on public.feedback
  for select to authenticated using (user_id = (select auth.uid()));
-- No update/delete: feedback is append-only for users. The team reads it with the service role.

create or replace function public.enforce_feedback_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 80));
  if (select count(*) from public.feedback f
       where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 10 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_feedback_rate() from public, anon, authenticated;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.enforce_feedback_rate();
