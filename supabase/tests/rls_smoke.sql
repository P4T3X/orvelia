-- RLS smoke test. Run against a local DB with the migration applied (e.g. supabase start).
-- Simulates two users and checks isolation, ownership FKs, read-only billing tables and storage paths.
-- Run as a superuser: psql "$DB_URL" -f supabase/tests/rls_smoke.sql
\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','a@x.com','{"full_name":"Ana"}'),
 ('22222222-2222-2222-2222-222222222222','b@x.com','{}');
select id, full_name, preferred_currency, timezone from public.profiles order by id;
select user_id, plan, status from public.subscriptions order by user_id;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into public.products (id, name, purchase_price, currency) values ('aaaaaaaa-0000-0000-0000-000000000001','MacBook Pro', 9999.90, 'PEN');
\echo [expect FAIL: price without currency]
insert into public.products (name, purchase_price) values ('no currency', 10);
insert into public.warranties (product_id, end_date) values ('aaaaaaaa-0000-0000-0000-000000000001','2028-01-01');
select 'A sees products', count(*) from public.products;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select 'B sees products (expect 0)', count(*) from public.products;
select 'B sees warranties (expect 0)', count(*) from public.warranties;
\echo [expect FAIL: B attaches receipt to A product]
insert into public.receipts (product_id, merchant) values ('aaaaaaaa-0000-0000-0000-000000000001','Hack');
\echo [expect FAIL: B inserts product as A]
insert into public.products (user_id, name) values ('11111111-1111-1111-1111-111111111111','spoof');
\echo [expect UPDATE 0]
update public.products set name='pwned' where id='aaaaaaaa-0000-0000-0000-000000000001';
\echo [expect UPDATE 0: subscriptions]
update public.subscriptions set plan='ultra';
select 'B sub', plan from public.subscriptions;
\echo [expect FAIL: ai_usage insert]
insert into public.ai_usage (user_id, operation, provider, status) values ('22222222-2222-2222-2222-222222222222','ocr','x','succeeded');
select 'B categories (system)', count(*) from public.categories;
insert into storage.objects (bucket_id, name) values ('user-files','22222222-2222-2222-2222-222222222222/receipts/r.pdf');
\echo [expect FAIL: upload into A folder]
insert into storage.objects (bucket_id, name) values ('user-files','11111111-1111-1111-1111-111111111111/receipts/evil.pdf');
select 'B objects', count(*) from storage.objects;
reset role;
select set_config('request.jwt.claim.sub','',false);
set role anon;
select 'anon products (expect 0)', count(*) from public.products;
select 'anon plan_limits (expect 3)', count(*) from public.plan_limits;
reset role;
insert into public.receipts (user_id, product_id, merchant) values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Apple');
delete from public.products where id='aaaaaaaa-0000-0000-0000-000000000001';
select 'receipt after product delete', user_id, product_id from public.receipts;
select 'warranties after delete (expect 0)', count(*) from public.warranties;
delete from auth.users where id='11111111-1111-1111-1111-111111111111';
select 'profiles left (expect 1)', count(*) from public.profiles;
select 'receipts left (expect 0)', count(*) from public.receipts;
