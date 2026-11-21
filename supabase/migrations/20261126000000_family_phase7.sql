-- =============================================================================
-- ORVELIA — Phase 7: family workspaces and advanced analytics
--
-- Design
--   * A family belongs to one owner. A user belongs to at most one family.
--   * Families are an Ultra feature: a family is "active" only while its
--     owner's effective plan allows members (plan_limits.family_members > 0).
--     When the owner's plan lapses, nothing is deleted; sharing pauses.
--   * Private and shared data have separate authorization paths:
--       - Existing tables keep their owner-only RLS policies untouched, so
--         every existing query still returns only the caller's own rows.
--       - Shared data is read ONLY through the security-definer functions
--         below, which check membership, family status and the share itself.
--   * Sharing is read-only: members see a shared product with its warranties,
--     return deadlines, documents, receipt and reminders; only the owner edits.
--   * All writes to family tables go through functions (invariants: one family
--     per user, seat limits, role rules, invitation e-mail match). Tables
--     expose read-only policies for members.
--   * Invitation tokens are random (244 bits), shown once, stored as SHA-256.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Plan limits
-- -----------------------------------------------------------------------------
alter table public.plan_limits
  add column family_members integer not null default 0 check (family_members >= 0), -- seats incl. owner; 0 = no family
  add column advanced_analytics boolean not null default false;

update public.plan_limits set family_members = 0, advanced_analytics = false where plan = 'free';
update public.plan_limits set family_members = 0, advanced_analytics = true  where plan = 'plus';
update public.plan_limits set family_members = 5, advanced_analytics = true  where plan = 'ultra';

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create type public.family_role as enum ('owner', 'admin', 'member');

create table public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  owner_id   uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger families_set_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id   uuid not null unique references public.profiles (id) on delete cascade, -- one family per user
  role      public.family_role not null,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Exactly one owner row per family, and it is the families.owner_id.
create unique index family_members_one_owner on public.family_members (family_id) where role = 'owner';

create table public.family_invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  email       text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role        public.family_role not null check (role <> 'owner'),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create unique index family_invitations_one_pending
  on public.family_invitations (family_id, email)
  where accepted_at is null and revoked_at is null;
create index family_invitations_family_created_idx on public.family_invitations (family_id, created_at desc);

create table public.shared_resources (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  owner_id   uuid not null,
  product_id uuid not null,
  shared_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint shared_resources_product_fk foreign key (product_id, owner_id)
    references public.products (id, user_id) on delete cascade,
  constraint shared_resources_unique unique (family_id, product_id)
);

create index shared_resources_owner_idx on public.shared_resources (owner_id);

create table public.activity_logs (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid references public.families (id) on delete cascade,
  actor_id       uuid references public.profiles (id) on delete set null,
  action         text not null check (action in (
    'family_created', 'family_renamed', 'member_invited', 'invitation_revoked', 'member_joined',
    'member_removed', 'member_left', 'role_changed', 'product_shared', 'product_unshared')),
  target_user_id uuid references public.profiles (id) on delete set null,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index activity_logs_family_created_idx on public.activity_logs (family_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- -----------------------------------------------------------------------------
create or replace function public.family_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id from public.family_members m where m.user_id = p_user;
$$;

create or replace function public.family_role_of(p_user uuid, p_family uuid)
returns public.family_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.family_members m where m.user_id = p_user and m.family_id = p_family;
$$;

create or replace function public.family_seat_limit(p_family uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select l.family_members
    from public.families f
    cross join lateral public.current_plan_limits(f.owner_id) l
   where f.id = p_family;
$$;

create or replace function public.family_is_active(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.family_seat_limit(p_family) > 0, false);
$$;

create or replace function public.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(p.full_name, ''),
    split_part((select u.email from auth.users u where u.id = p_user), '@', 1),
    'Miembro')
    from public.profiles p where p.id = p_user;
$$;

create or replace function public.log_family_activity(
  p_family uuid, p_action text, p_target uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (family_id, actor_id, action, target_user_id, metadata)
  values (p_family, auth.uid(), p_action, p_target, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on function public.family_of(uuid) from public, anon, authenticated;
revoke all on function public.family_role_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.family_seat_limit(uuid) from public, anon, authenticated;
revoke all on function public.family_is_active(uuid) from public, anon, authenticated;
revoke all on function public.display_name(uuid) from public, anon, authenticated;
revoke all on function public.log_family_activity(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- A member who leaves (or is removed) stops sharing their products there.
create or replace function public.cleanup_member_shares()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shared_resources s where s.family_id = old.family_id and s.owner_id = old.user_id;
  return old;
end;
$$;

create trigger family_members_cleanup_shares
  after delete on public.family_members
  for each row execute function public.cleanup_member_shares();

-- -----------------------------------------------------------------------------
-- RLS: members can read their family; nobody writes directly.
-- -----------------------------------------------------------------------------
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invitations enable row level security;
alter table public.shared_resources enable row level security;
alter table public.activity_logs enable row level security;

-- Policy helper: the caller's own family only (no argument to probe others).
create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id from public.family_members m where m.user_id = auth.uid();
$$;

revoke all on function public.my_family_id() from public, anon;
grant execute on function public.my_family_id() to authenticated;

create policy "families: members read" on public.families
  for select to authenticated using (id = (select public.my_family_id()));
create policy "family_members: members read" on public.family_members
  for select to authenticated using (family_id = (select public.my_family_id()));
create policy "shared_resources: members read" on public.shared_resources
  for select to authenticated using (family_id = (select public.my_family_id()));
create policy "activity_logs: members read" on public.activity_logs
  for select to authenticated using (family_id = (select public.my_family_id()));
-- family_invitations: no policies (tokens are secrets); read through family_overview().


-- -----------------------------------------------------------------------------
-- Family lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, '')), 60);
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_name = '' then raise exception 'invalid_name' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 70));
  if public.family_of(v_user) is not null then raise exception 'already_in_family' using errcode = 'P0001'; end if;
  if (select l.family_members from public.current_plan_limits(v_user) l) = 0 then
    raise exception 'family_not_included' using errcode = 'P0001';
  end if;
  insert into public.families (name, owner_id) values (v_name, v_user) returning id into v_id;
  insert into public.family_members (family_id, user_id, role) values (v_id, v_user, 'owner');
  perform public.log_family_activity(v_id, 'family_created', null, jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

create or replace function public.rename_family(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := public.family_of(auth.uid());
  v_name text := left(trim(coalesce(p_name, '')), 60);
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  if public.family_role_of(auth.uid(), v_family) not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_name = '' then raise exception 'invalid_name' using errcode = '22023'; end if;
  update public.families set name = v_name where id = v_family;
  perform public.log_family_activity(v_family, 'family_renamed', null, jsonb_build_object('name', v_name));
end;
$$;

create or replace function public.delete_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := public.family_of(auth.uid());
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  if public.family_role_of(auth.uid(), v_family) <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.families where id = v_family; -- cascades members, invitations, shares, activity
end;
$$;

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
create or replace function public.create_family_invitation(p_email text, p_role public.family_role)
returns table (invitation_id uuid, token text, expires_at timestamptz, family_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := public.family_of(auth.uid());
  v_role public.family_role;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_limit integer;
  v_used integer;
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  v_role := public.family_role_of(v_user, v_family);
  if v_role not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role is null or p_role = 'owner' then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_role = 'admin' and v_role <> 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_family::text, 71));

  if not public.family_is_active(v_family) then raise exception 'family_inactive' using errcode = 'P0001'; end if;

  if exists (
    select 1 from public.family_members m join auth.users u on u.id = m.user_id
     where m.family_id = v_family and lower(u.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  if (select count(*) from public.family_invitations i
       where i.family_id = v_family and i.created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- A new invitation to the same address replaces the pending one.
  update public.family_invitations i set revoked_at = now()
   where i.family_id = v_family and i.email = v_email and i.accepted_at is null and i.revoked_at is null;

  v_limit := public.family_seat_limit(v_family);
  select (select count(*) from public.family_members m where m.family_id = v_family)
       + (select count(*) from public.family_invitations i
           where i.family_id = v_family and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
    into v_used;
  if v_used >= v_limit then
    raise exception 'family_full' using errcode = 'P0001', detail = format('limit=%s', v_limit);
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.family_invitations (family_id, email, role, token_hash, invited_by, expires_at)
  values (v_family, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_user, v_expires)
  returning id into v_id;

  perform public.log_family_activity(v_family, 'member_invited', null,
    jsonb_build_object('email', v_email, 'role', p_role));

  return query select v_id, v_token, v_expires, (select f.name from public.families f where f.id = v_family);
end;
$$;

create or replace function public.revoke_family_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := public.family_of(auth.uid());
  v_email text;
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  if public.family_role_of(auth.uid(), v_family) not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.family_invitations i set revoked_at = now()
   where i.id = p_invitation and i.family_id = v_family and i.accepted_at is null and i.revoked_at is null
  returning i.email into v_email;
  if v_email is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.log_family_activity(v_family, 'invitation_revoked', null, jsonb_build_object('email', v_email));
end;
$$;

-- What the invite page shows. Knowing the token is the authorization.
create or replace function public.invitation_preview(p_token text)
returns table (family_name text, inviter_name text, role public.family_role, email text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name,
         public.display_name(i.invited_by),
         i.role,
         i.email,
         case
           when i.accepted_at is not null then 'accepted'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at <= now() then 'expired'
           when not public.family_is_active(i.family_id) then 'family_inactive'
           else 'valid'
         end,
         i.expires_at
    from public.family_invitations i
    join public.families f on f.id = i.family_id
   where p_token ~ '^[0-9a-f]{64}$'
     and i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function public.accept_family_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.family_invitations;
  v_email text;
  v_count integer;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invitation_not_found' using errcode = 'P0002'; end if;

  select * into v_inv from public.family_invitations i
   where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
   for update;
  if not found then raise exception 'invitation_not_found' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_inv.family_id::text, 71));
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 70));

  if v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation_unavailable' using errcode = 'P0001';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user;
  if v_email is distinct from v_inv.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;
  if public.family_of(v_user) is not null then raise exception 'already_in_family' using errcode = 'P0001'; end if;
  if not public.family_is_active(v_inv.family_id) then raise exception 'family_inactive' using errcode = 'P0001'; end if;
  select count(*) into v_count from public.family_members m where m.family_id = v_inv.family_id;
  if v_count >= public.family_seat_limit(v_inv.family_id) then
    raise exception 'family_full' using errcode = 'P0001';
  end if;

  insert into public.family_members (family_id, user_id, role) values (v_inv.family_id, v_user, v_inv.role);
  update public.family_invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  perform public.log_family_activity(v_inv.family_id, 'member_joined', v_user, jsonb_build_object('role', v_inv.role));

  -- Let the person who invited know (in-app).
  if v_inv.invited_by is not null and exists (select 1 from public.family_members m
       where m.user_id = v_inv.invited_by and m.family_id = v_inv.family_id) then
    insert into public.notifications (user_id, title, body, link)
    values (v_inv.invited_by,
            left(public.display_name(v_user) || ' se unió a tu familia', 200),
            'Ya puede ver los productos que compartes en la familia.',
            '/app/family');
  end if;
  return v_inv.family_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Members
-- -----------------------------------------------------------------------------
create or replace function public.update_family_member_role(p_user uuid, p_role public.family_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := public.family_of(auth.uid());
  v_current public.family_role;
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  if public.family_role_of(auth.uid(), v_family) <> 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role is null or p_role = 'owner' then raise exception 'invalid_role' using errcode = '22023'; end if;
  v_current := public.family_role_of(p_user, v_family);
  if v_current is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_current = 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_current = p_role then return; end if;
  update public.family_members set role = p_role where family_id = v_family and user_id = p_user;
  perform public.log_family_activity(v_family, 'role_changed', p_user, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.remove_family_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := public.family_of(auth.uid());
  v_me public.family_role;
  v_target public.family_role;
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  v_me := public.family_role_of(auth.uid(), v_family);
  v_target := public.family_role_of(p_user, v_family);
  if v_target is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- Owner removes anyone but themself; admins remove members only.
  if v_target = 'owner' or p_user = auth.uid()
     or not (v_me = 'owner' or (v_me = 'admin' and v_target = 'member')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.family_members where family_id = v_family and user_id = p_user;
  perform public.log_family_activity(v_family, 'member_removed', p_user,
    jsonb_build_object('name', public.display_name(p_user)));
end;
$$;

create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := public.family_of(auth.uid());
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  if public.family_role_of(auth.uid(), v_family) = 'owner' then
    raise exception 'owner_cannot_leave' using errcode = 'P0001';
  end if;
  delete from public.family_members where family_id = v_family and user_id = auth.uid();
  perform public.log_family_activity(v_family, 'member_left', auth.uid(),
    jsonb_build_object('name', public.display_name(auth.uid())));
end;
$$;

-- -----------------------------------------------------------------------------
-- Sharing
-- -----------------------------------------------------------------------------
create or replace function public.share_product(p_product uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := public.family_of(auth.uid());
  v_name text;
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  if not public.family_is_active(v_family) then raise exception 'family_inactive' using errcode = 'P0001'; end if;
  select p.name into v_name from public.products p where p.id = p_product and p.user_id = v_user;
  if v_name is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.shared_resources (family_id, owner_id, product_id, shared_by)
  values (v_family, v_user, p_product, v_user)
  on conflict (family_id, product_id) do nothing;
  if found then
    perform public.log_family_activity(v_family, 'product_shared', null,
      jsonb_build_object('product_id', p_product, 'name', v_name));
  end if;
end;
$$;

create or replace function public.unshare_product(p_product uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := public.family_of(auth.uid());
  v_share public.shared_resources;
begin
  if v_family is null then raise exception 'not_in_family' using errcode = 'P0001'; end if;
  select * into v_share from public.shared_resources s where s.family_id = v_family and s.product_id = p_product;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_share.owner_id <> v_user and public.family_role_of(v_user, v_family) not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.shared_resources where id = v_share.id;
  perform public.log_family_activity(v_family, 'product_unshared', null,
    jsonb_build_object('product_id', p_product,
                       'name', (select p.name from public.products p where p.id = p_product)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reads for the UI
-- -----------------------------------------------------------------------------

-- Everything the family page needs, scoped to the caller's role.
create or replace function public.family_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := public.family_of(auth.uid());
  v_role public.family_role;
  v_f public.families;
begin
  if v_user is null then return null; end if;
  if v_family is null then
    return jsonb_build_object(
      'family', null,
      'can_create', (select l.family_members > 0 from public.current_plan_limits(v_user) l));
  end if;
  v_role := public.family_role_of(v_user, v_family);
  select * into v_f from public.families where id = v_family;
  return jsonb_build_object(
    'family', jsonb_build_object(
      'id', v_f.id, 'name', v_f.name, 'created_at', v_f.created_at,
      'owner_name', public.display_name(v_f.owner_id),
      'active', public.family_is_active(v_family),
      'seat_limit', public.family_seat_limit(v_family)),
    'my_role', v_role,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', m.user_id, 'name', public.display_name(m.user_id),
               'email', (select u.email from auth.users u where u.id = m.user_id),
               'role', m.role, 'joined_at', m.joined_at,
               'shared_count', (select count(*) from public.shared_resources s
                                 where s.family_id = v_family and s.owner_id = m.user_id),
               'is_me', m.user_id = v_user)
             order by (m.role = 'owner') desc, m.joined_at)
        from public.family_members m where m.family_id = v_family), '[]'::jsonb),
    'invitations', case when v_role in ('owner', 'admin') then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'email', i.email, 'role', i.role,
               'expires_at', i.expires_at, 'created_at', i.created_at,
               'invited_by', public.display_name(i.invited_by))
             order by i.created_at desc)
        from public.family_invitations i
       where i.family_id = v_family and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()),
      '[]'::jsonb) else '[]'::jsonb end,
    'activity', coalesce((
      select jsonb_agg(x.j order by x.created_at desc) from (
        select a.created_at, jsonb_build_object(
                 'action', a.action, 'created_at', a.created_at,
                 'actor', public.display_name(a.actor_id),
                 'target', public.display_name(a.target_user_id),
                 'metadata', a.metadata - 'email' || case when v_role in ('owner', 'admin')
                   then jsonb_build_object('email', a.metadata -> 'email') else '{}'::jsonb end) as j
          from public.activity_logs a where a.family_id = v_family
         order by a.created_at desc limit 30) x), '[]'::jsonb));
end;
$$;

-- Products shared in the caller's family (including the caller's own shares).
create or replace function public.family_shared_products()
returns table (
  product_id uuid, name text, brand text, model text, category text, status public.product_status,
  purchase_date date, owner_name text, is_mine boolean, shared_at timestamptz,
  warranty_end date, return_deadline date, has_image boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.brand, p.model, c.name, p.status, p.purchase_date,
         public.display_name(p.user_id), p.user_id = auth.uid(), s.created_at,
         (select max(w.end_date) from public.warranties w where w.product_id = p.id and w.user_id = p.user_id),
         (select min(r.deadline_date) from public.return_deadlines r
           where r.product_id = p.id and r.user_id = p.user_id and r.deadline_date >= current_date),
         p.image_path is not null
    from public.shared_resources s
    join public.products p on p.id = s.product_id and p.user_id = s.owner_id
    left join public.categories c on c.id = p.category_id
   where s.family_id = public.family_of(auth.uid())
     and public.family_is_active(s.family_id)
   order by s.created_at desc;
$$;

-- One shared product with its protection records (read-only view).
create or replace function public.family_shared_product(p_product uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'product', jsonb_build_object(
      'id', p.id, 'name', p.name, 'brand', p.brand, 'model', p.model, 'category', c.name,
      'description', p.description, 'status', p.status, 'purchase_date', p.purchase_date,
      'purchase_price', p.purchase_price, 'currency', p.currency, 'seller', p.seller,
      'serial_number', p.serial_number, 'has_image', p.image_path is not null),
    'owner_name', public.display_name(p.user_id),
    'is_mine', p.user_id = auth.uid(),
    'shared_at', s.created_at,
    'warranties', coalesce((select jsonb_agg(jsonb_build_object(
        'id', w.id, 'provider', w.provider, 'start_date', w.start_date, 'end_date', w.end_date,
        'coverage_description', w.coverage_description, 'verification_status', w.verification_status)
        order by w.end_date nulls last)
      from public.warranties w where w.product_id = p.id and w.user_id = p.user_id), '[]'::jsonb),
    'returns', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'deadline_date', r.deadline_date, 'policy_details', r.policy_details,
        'verification_status', r.verification_status) order by r.deadline_date)
      from public.return_deadlines r where r.product_id = p.id and r.user_id = p.user_id), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'document_type', d.document_type, 'mime_type', d.mime_type,
        'size_bytes', d.size_bytes, 'expires_on', d.expires_on, 'created_at', d.created_at)
        order by d.created_at desc)
      from public.documents d where d.product_id = p.id and d.user_id = p.user_id), '[]'::jsonb),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object(
        'id', rc.id, 'merchant', rc.merchant, 'purchase_date', rc.purchase_date,
        'total_amount', rc.total_amount, 'currency', rc.currency, 'has_file', rc.storage_path is not null)
        order by rc.created_at desc)
      from public.receipts rc where rc.id = p.receipt_id and rc.user_id = p.user_id
       and rc.processing_status = 'confirmed'), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'scheduled_at', m.scheduled_at, 'recurrence', m.recurrence)
        order by m.scheduled_at)
      from public.reminders m where m.product_id = p.id and m.user_id = p.user_id
       and m.status = 'scheduled'), '[]'::jsonb))
    from public.shared_resources s
    join public.products p on p.id = s.product_id and p.user_id = s.owner_id
    left join public.categories c on c.id = p.category_id
   where s.product_id = p_product
     and s.family_id = public.family_of(auth.uid())
     and public.family_is_active(s.family_id);
$$;

-- Storage path of a shared file, only if the caller may read it. The server
-- then signs it with the service role (storage policies stay owner-only).
create or replace function public.shared_file_path(p_kind text, p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'document' then (
      select d.storage_path from public.documents d
        join public.shared_resources s on s.product_id = d.product_id and s.owner_id = d.user_id
       where d.id = p_id and s.family_id = public.family_of(auth.uid()) and public.family_is_active(s.family_id))
    when 'receipt' then (
      select r.storage_path from public.receipts r
        join public.products p on p.receipt_id = r.id and p.user_id = r.user_id
        join public.shared_resources s on s.product_id = p.id and s.owner_id = p.user_id
       where r.id = p_id and r.processing_status = 'confirmed'
         and s.family_id = public.family_of(auth.uid()) and public.family_is_active(s.family_id))
    when 'product-image' then (
      select p.image_path from public.products p
        join public.shared_resources s on s.product_id = p.id and s.owner_id = p.user_id
       where p.id = p_id and s.family_id = public.family_of(auth.uid()) and public.family_is_active(s.family_id))
  end;
$$;

-- Dates from other members' shared products, for the caller's calendar.
create or replace function public.family_shared_events(p_from date, p_to date)
returns table (event_date date, kind text, title text, product_id uuid, product_name text, owner_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with shared as (
    select p.id, p.name, p.user_id
      from public.shared_resources s
      join public.products p on p.id = s.product_id and p.user_id = s.owner_id
     where s.family_id = public.family_of(auth.uid())
       and public.family_is_active(s.family_id)
       and p.user_id <> auth.uid()
  )
  select w.end_date, 'warranty', 'Fin de garantía', sh.id, sh.name, public.display_name(sh.user_id)
    from shared sh join public.warranties w on w.product_id = sh.id and w.user_id = sh.user_id
   where w.end_date between p_from and p_to
  union all
  select r.deadline_date, 'return', 'Último día de devolución', sh.id, sh.name, public.display_name(sh.user_id)
    from shared sh join public.return_deadlines r on r.product_id = sh.id and r.user_id = sh.user_id
   where r.deadline_date between p_from and p_to
  union all
  select (m.scheduled_at at time zone coalesce((select pr.timezone from public.profiles pr where pr.id = sh.user_id), 'America/Lima'))::date,
         'reminder', m.title, sh.id, sh.name, public.display_name(sh.user_id)
    from shared sh join public.reminders m on m.product_id = sh.id and m.user_id = sh.user_id
   where m.status = 'scheduled' and m.source = 'custom'
     and (m.scheduled_at at time zone coalesce((select pr.timezone from public.profiles pr where pr.id = sh.user_id), 'America/Lima'))::date
         between p_from and p_to
  order by 1, 5;
$$;

-- -----------------------------------------------------------------------------
-- Advanced analytics (Plus and Ultra). Only the caller's own records.
-- -----------------------------------------------------------------------------
create or replace function public.analytics_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_currency text;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not (select l.advanced_analytics from public.current_plan_limits(v_user) l) then
    raise exception 'analytics_not_included' using errcode = 'P0001';
  end if;
  select coalesce(p.timezone, 'America/Lima'), coalesce(p.preferred_currency, 'PEN')
    into v_tz, v_currency from public.profiles p where p.id = v_user;
  v_today := (now() at time zone coalesce(v_tz, 'America/Lima'))::date;

  return jsonb_build_object(
    'currency', coalesce(v_currency, 'PEN'),
    'today', v_today,
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object('currency', t.currency, 'total', t.total, 'count', t.n) order by t.total desc)
        from (select p.currency, sum(p.purchase_price) as total, count(*) as n
                from public.products p
               where p.user_id = v_user and p.purchase_price is not null and p.status = 'active'
               group by p.currency) t), '[]'::jsonb),
    'by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'), 'currency', m.currency,
                                          'total', m.total, 'count', m.n) order by m.month)
        from (select date_trunc('month', p.purchase_date)::date as month, p.currency,
                     sum(p.purchase_price) as total, count(*) as n
                from public.products p
               where p.user_id = v_user and p.purchase_price is not null
                 and p.purchase_date > (date_trunc('month', v_today) - interval '12 months')::date
                 and p.purchase_date <= v_today
               group by 1, 2) m), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', k.category, 'count', k.n, 'total', k.total) order by k.n desc, k.total desc nulls last)
        from (select coalesce(c.name, 'Sin categoría') category, count(*) n,
                     sum(p.purchase_price) filter (where p.currency = v_currency) total
                from public.products p left join public.categories c on c.id = p.category_id
               where p.user_id = v_user and p.status = 'active'
               group by 1) k), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_object_agg(s.status, s.n)
        from (select p.status, count(*) n from public.products p where p.user_id = v_user group by 1) s), '{}'::jsonb),
    'coverage', (
      select jsonb_build_object(
        'active_products', count(*),
        'with_active_warranty', count(*) filter (where exists (
          select 1 from public.warranties w where w.product_id = p.id and w.user_id = v_user and w.end_date >= v_today)),
        'with_expired_warranty_only', count(*) filter (where exists (
            select 1 from public.warranties w where w.product_id = p.id and w.user_id = v_user)
          and not exists (
            select 1 from public.warranties w where w.product_id = p.id and w.user_id = v_user
               and (w.end_date >= v_today or w.end_date is null))),
        'with_receipt', count(*) filter (where exists (
          select 1 from public.receipts r where r.id = p.receipt_id and r.user_id = v_user and r.processing_status = 'confirmed')),
        'with_documents', count(*) filter (where exists (
          select 1 from public.documents d where d.product_id = p.id and d.user_id = v_user)))
        from public.products p where p.user_id = v_user and p.status = 'active'),
    'upcoming', jsonb_build_object(
      'warranties_90', (select count(*) from public.warranties w join public.products p on p.id = w.product_id and p.user_id = w.user_id
                         where w.user_id = v_user and p.status = 'active' and w.end_date between v_today and v_today + 90),
      'returns_30', (select count(*) from public.return_deadlines r join public.products p on p.id = r.product_id and p.user_id = r.user_id
                      where r.user_id = v_user and p.status = 'active' and r.deadline_date between v_today and v_today + 30),
      'documents_90', (select count(*) from public.documents d
                        where d.user_id = v_user and d.expires_on between v_today and v_today + 90)),
    'documents_by_type', coalesce((
      select jsonb_object_agg(d.document_type, d.n)
        from (select d.document_type, count(*) n from public.documents d where d.user_id = v_user group by 1) d), '{}'::jsonb),
    'oldest_active', (
      select jsonb_build_object('name', p.name, 'purchase_date', p.purchase_date)
        from public.products p
       where p.user_id = v_user and p.status = 'active' and p.purchase_date is not null
       order by p.purchase_date limit 1));
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: client-callable functions
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'create_family(text)', 'rename_family(text)', 'delete_family()',
    'create_family_invitation(text, public.family_role)', 'revoke_family_invitation(uuid)',
    'accept_family_invitation(text)', 'update_family_member_role(uuid, public.family_role)',
    'remove_family_member(uuid)', 'leave_family()', 'share_product(uuid)', 'unshare_product(uuid)',
    'family_overview()', 'family_shared_products()', 'family_shared_product(uuid)',
    'shared_file_path(text, uuid)', 'family_shared_events(date, date)', 'analytics_overview()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- The invite page can be opened before signing in.
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
