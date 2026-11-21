-- Phase 7 smoke test: families (Ultra only), invitations (e-mail match, single use, seats),
-- roles, read-only sharing through functions (base tables stay owner-only), pause on downgrade,
-- analytics gating. Run on a fresh database with the migrations applied.
\set ON_ERROR_STOP 0
\set ana  '''aaaaaaaa-1111-4111-8111-111111111111'''
\set otro '''bbbbbbbb-2222-4222-8222-222222222222'''
\set carla '''cccccccc-3333-4333-8333-333333333333'''
\set dan  '''dddddddd-4444-4444-8444-444444444444'''
insert into auth.users (id, email, raw_user_meta_data) values
  (:ana, 'ana.torres@example.com', '{"full_name":"Ana Torres"}'),
  (:otro, 'otro@example.com', '{"full_name":"Otro Usuario"}'),
  (:carla, 'Carla@Example.com', '{"full_name":"Carla Ríos"}'),
  (:dan, 'dan@example.com', '{"full_name":"Dan"}')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', :ana, false) \g /dev/null
\echo [expect FAIL family_not_included: free plan]
select public.create_family('Familia Torres');
reset role;
update public.subscriptions set plan = 'ultra', status = 'active', current_period_end = now() + interval '30 days' where user_id = :ana;
set role authenticated;
select 'created', public.create_family('Familia Torres') is not null;
\echo [expect FAIL already_in_family]
select public.create_family('Otra');
\echo [expect FAIL invalid_role: owner]
select * from public.create_family_invitation('x@example.com', 'owner');
\echo [expect FAIL invalid_email]
select * from public.create_family_invitation('no-es-correo', 'member');
select token as tok_otro from public.create_family_invitation('OTRO@example.com', 'member') \gset
select token as tok_carla from public.create_family_invitation('carla@example.com', 'admin') \gset
select 'pending invitations', jsonb_array_length(public.family_overview() -> 'invitations');
\echo [expect 0: invitations table is not readable directly]
select count(*) from public.family_invitations;

reset role; set role anon;
select 'anon preview', family_name, inviter_name, role, status from public.invitation_preview(:'tok_otro');
select 'bad token preview rows', count(*) from public.invitation_preview('deadbeef');

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :dan, false) \g /dev/null
\echo [expect FAIL invitation_email_mismatch]
select public.accept_family_invitation(:'tok_otro');
\echo [expect FAIL not_in_family]
select * from public.create_family_invitation('z@example.com', 'member');

select set_config('request.jwt.claim.sub', :otro, false) \g /dev/null
select 'otro joins', public.accept_family_invitation(:'tok_otro') is not null;
\echo [expect FAIL invitation_unavailable: single use]
select public.accept_family_invitation(:'tok_otro');
select 'otro role', public.family_overview() ->> 'my_role', jsonb_array_length(public.family_overview() -> 'invitations') as sees_invites;
\echo [expect FAIL forbidden: member invites]
select * from public.create_family_invitation('z@example.com', 'member');
\echo [expect FAIL forbidden: member removes owner]
select public.remove_family_member(:ana);

select set_config('request.jwt.claim.sub', :carla, false) \g /dev/null
select 'carla joins (case-insensitive email)', public.accept_family_invitation(:'tok_carla') is not null;
\echo [expect FAIL forbidden: admin invites admin]
select * from public.create_family_invitation('z@example.com', 'admin');

-- Sharing
select set_config('request.jwt.claim.sub', :ana, false) \g /dev/null
insert into public.products (id, name, purchase_price, currency, purchase_date)
values ('e1000000-0000-4000-8000-000000000001', 'Televisor', 2500, 'PEN', current_date - 10);
insert into public.warranties (product_id, end_date) values ('e1000000-0000-4000-8000-000000000001', current_date + 20);
insert into public.documents (id, product_id, title, storage_path)
values ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Garantía TV', 'aaaaaaaa-1111-4111-8111-111111111111/documents/tv.pdf');
insert into public.products (id, name) values ('e1000000-0000-4000-8000-000000000002', 'Privado');
select public.share_product('e1000000-0000-4000-8000-000000000001');
select public.share_product('e1000000-0000-4000-8000-000000000001'); -- idempotent
\echo [expect FAIL not_found: share a product of another user]
select public.share_product('f0000000-0000-4000-8000-000000000009');

select set_config('request.jwt.claim.sub', :otro, false) \g /dev/null
select 'otro sees shared', name, owner_name, is_mine, warranty_end = current_date + 20 as warranty from public.family_shared_products();
select 'otro direct products (RLS unchanged)', count(*) from public.products;
select 'otro direct warranties', count(*) from public.warranties;
select 'otro shared detail', public.family_shared_product('e1000000-0000-4000-8000-000000000001') -> 'product' ->> 'name',
       jsonb_array_length(public.family_shared_product('e1000000-0000-4000-8000-000000000001') -> 'documents') as docs;
select 'otro private product detail is null', public.family_shared_product('e1000000-0000-4000-8000-000000000002') is null;
select 'otro file path', public.shared_file_path('document', 'e2000000-0000-4000-8000-000000000001');
select 'otro calendar events', count(*) from public.family_shared_events(current_date, current_date + 60);
insert into public.products (id, name) values ('e1000000-0000-4000-8000-000000000003', 'Bicicleta de Otro');
select public.share_product('e1000000-0000-4000-8000-000000000003');
\echo [expect FAIL forbidden: member unshares a product of another member]
select public.unshare_product('e1000000-0000-4000-8000-000000000001');
\echo [expect FAIL: direct insert into shared_resources is blocked by RLS]
insert into public.shared_resources (family_id, owner_id, product_id)
select family_id, 'bbbbbbbb-2222-4222-8222-222222222222', 'e1000000-0000-4000-8000-000000000003' from public.family_members limit 1;

select set_config('request.jwt.claim.sub', :dan, false) \g /dev/null
select 'outsider shared list', count(*) from public.family_shared_products();
select 'outsider file path is null', public.shared_file_path('document', 'e2000000-0000-4000-8000-000000000001') is null;
select 'outsider family rows', (select count(*) from public.families), (select count(*) from public.family_members), (select count(*) from public.activity_logs);

-- Seats
reset role; update public.plan_limits set family_members = 3 where plan = 'ultra'; set role authenticated;
select set_config('request.jwt.claim.sub', :ana, false) \g /dev/null
\echo [expect FAIL family_full: 3 of 3 seats]
select * from public.create_family_invitation('dan@example.com', 'member');
reset role; update public.plan_limits set family_members = 5 where plan = 'ultra'; set role authenticated;

-- Roles
select public.update_family_member_role(:carla, 'member');
\echo [expect FAIL forbidden: owner role cannot be given]
select public.update_family_member_role(:carla, 'owner');
select 'roles', string_agg(m ->> 'role', ',' order by m ->> 'role') from jsonb_array_elements(public.family_overview() -> 'members') m;

-- Owner downgrade pauses sharing (nothing deleted)
reset role;
update public.subscriptions set status = 'canceled', current_period_end = now() - interval '1 minute' where user_id = :ana;
set role authenticated;
select set_config('request.jwt.claim.sub', :otro, false) \g /dev/null
select 'paused: shared list', count(*), (public.family_overview() -> 'family' ->> 'active') as active from public.family_shared_products();
select set_config('request.jwt.claim.sub', :ana, false) \g /dev/null
\echo [expect FAIL family_inactive]
select * from public.create_family_invitation('dan@example.com', 'member');
reset role;
update public.subscriptions set status = 'active', current_period_end = now() + interval '30 days' where user_id = :ana;
select 'shares kept', count(*) from public.shared_resources;
set role authenticated;

-- Leaving removes the leaver's shares
select set_config('request.jwt.claim.sub', :otro, false) \g /dev/null
select public.leave_family();
select 'after leaving: family rows', (select count(*) from public.families), (select count(*) from public.family_shared_products());
select set_config('request.jwt.claim.sub', :ana, false) \g /dev/null
select 'shared after otro left', count(*) from public.family_shared_products();
\echo [expect FAIL owner_cannot_leave]
select public.leave_family();
select 'activity', string_agg(a ->> 'action', ',' order by a ->> 'created_at') from jsonb_array_elements(public.family_overview() -> 'activity') a;

-- Analytics
select 'ana analytics', (public.analytics_overview() -> 'coverage' ->> 'active_products'), (public.analytics_overview() -> 'totals' -> 0 ->> 'total');
select set_config('request.jwt.claim.sub', :otro, false) \g /dev/null
\echo [expect FAIL analytics_not_included: free]
select public.analytics_overview();

-- Delete family
select set_config('request.jwt.claim.sub', :ana, false) \g /dev/null
select public.delete_family();
reset role;
select 'after delete', (select count(*) from public.families), (select count(*) from public.family_members),
       (select count(*) from public.shared_resources), (select count(*) from public.family_invitations),
       (select count(*) from public.products where id::text like 'e1%');
