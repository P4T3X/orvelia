-- =============================================================================
-- ORVELIA — Phase 9: mobile app
--   * Expo push tokens per device (users manage their own).
--   * A push on/off switch next to the e-mail one.
-- =============================================================================

create table public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  token        text not null unique check (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,}\]$'),
  platform     text not null check (platform in ('ios', 'android')),
  device_name  text check (device_name is null or char_length(device_name) <= 80),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens: read own" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_tokens: delete own" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
-- Registration goes through register_push_token(): a token moves to whoever
-- signed in last on that device, which a plain insert policy can't express.

create or replace function public.register_push_token(p_token text, p_platform text, p_device_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if (select count(*) from public.push_tokens t where t.user_id = v_user and t.token <> p_token) >= 10 then
    -- Keep the 9 most recent devices.
    delete from public.push_tokens t
     where t.id in (select id from public.push_tokens where user_id = v_user order by last_seen_at desc offset 9);
  end if;
  insert into public.push_tokens (user_id, token, platform, device_name)
  values (v_user, p_token, p_platform, left(nullif(trim(coalesce(p_device_name, '')), ''), 80))
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        device_name = excluded.device_name, last_seen_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

alter table public.notification_preferences
  add column push_enabled boolean not null default true;
