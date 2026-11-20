-- Phase 3 smoke test: scan quota (reserve/finish), receipt/document path ownership, products.receipt_id. Needs the two auth.users rows used below.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
insert into public.receipts (id, storage_path, mime_type, size_bytes) values
 ('c0000000-0000-4000-8000-000000000001','aaaaaaaa-1111-4111-8111-111111111111/receipts/c1/original.jpg','image/jpeg',1000);
\echo [expect FAIL: receipt path outside own folder]
insert into public.receipts (storage_path) values ('bbbbbbbb-2222-4222-8222-222222222222/receipts/x.jpg');
\echo [expect FAIL: confirmed without confirmed_at]
update public.receipts set processing_status='confirmed' where id='c0000000-0000-4000-8000-000000000001';
select 'usage before', * from public.scan_usage();
select 'r1', public.reserve_scan('c0000000-0000-4000-8000-000000000001','fixture') is not null;
select 'r2', public.reserve_scan('c0000000-0000-4000-8000-000000000001','fixture') is not null;
select 'r3', public.reserve_scan('c0000000-0000-4000-8000-000000000001','fixture') is not null;
\echo [expect FAIL: 4th scan on free plan]
select public.reserve_scan('c0000000-0000-4000-8000-000000000001','fixture');
select public.finish_scan((select id from public.ai_usage order by created_at limit 1), false);
select 'after one failed', * from public.scan_usage();
select 'r4 allowed after failure', public.reserve_scan('c0000000-0000-4000-8000-000000000001','fixture') is not null;
\echo [expect FAIL: direct insert into ai_usage]
insert into public.ai_usage (user_id, operation, provider, status) values ('aaaaaaaa-1111-4111-8111-111111111111','extraction','x','failed');
\echo [expect FAIL: call internal fn]
select public.scans_used_this_month('aaaaaaaa-1111-4111-8111-111111111111');
insert into public.products (id, name, receipt_id) values ('d0000000-0000-4000-8000-000000000001','Prod con boleta','c0000000-0000-4000-8000-000000000001');
select 'product linked', receipt_id is not null from public.products where id='d0000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
\echo [expect FAIL: B reserves on A receipt]
select public.reserve_scan('c0000000-0000-4000-8000-000000000001','fixture');
\echo [expect FAIL: B links product to A receipt (FK)]
insert into public.products (name, receipt_id) values ('robo','c0000000-0000-4000-8000-000000000001');
\echo [expect 0 rows: B finishes A usage]
select public.finish_scan((select id from public.ai_usage limit 1), true);
select 'B usage', * from public.scan_usage();
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
delete from public.receipts where id='c0000000-0000-4000-8000-000000000001';
select 'product survives receipt delete', receipt_id is null from public.products where id='d0000000-0000-4000-8000-000000000001';
\echo [expect FAIL: document path outside folder]
insert into public.documents (title, storage_path) values ('x','aaaaaaaa-1111-4111-8111-111111111111/receipts/x.pdf');
reset role;
delete from public.products; delete from public.ai_usage; delete from public.receipts; delete from public.documents;
