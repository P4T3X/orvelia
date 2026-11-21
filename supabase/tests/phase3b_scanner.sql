-- Stage 3 smoke test: per-receipt attempt tracking and the failed-reading cap. Needs the two auth.users rows used below.
\set ON_ERROR_STOP 0
-- Give A a plan with plenty of scans so the quota is not what stops us.
update public.subscriptions set plan = 'ultra' where user_id = 'aaaaaaaa-1111-4111-8111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
insert into public.receipts (id, storage_path, mime_type, size_bytes) values
 ('c0000000-0000-4000-8000-000000000003','aaaaaaaa-1111-4111-8111-111111111111/receipts/c3/original.jpg','image/jpeg',1000);
select 'retries left at start', public.scan_retries_left('c0000000-0000-4000-8000-000000000003');
select public.finish_scan(public.reserve_scan('c0000000-0000-4000-8000-000000000003','gateway:x'), false);
select public.finish_scan(public.reserve_scan('c0000000-0000-4000-8000-000000000003','gateway:x'), false);
select 'retries left after 2 failures', public.scan_retries_left('c0000000-0000-4000-8000-000000000003');
select public.finish_scan(public.reserve_scan('c0000000-0000-4000-8000-000000000003','gateway:x'), false);
select 'attempts recorded', processing_attempts, last_attempt_at is not null from public.receipts where id='c0000000-0000-4000-8000-000000000003';
\echo [expect FAIL: 4th reading after 3 failures (retry_limit_reached)]
select public.reserve_scan('c0000000-0000-4000-8000-000000000003','gateway:x');
select 'retries left after cap', public.scan_retries_left('c0000000-0000-4000-8000-000000000003');
select 'failed readings do not use the quota', used from public.scan_usage();
\echo [expect FAIL: unknown error code]
update public.receipts set processing_error_code = 'made_up' where id='c0000000-0000-4000-8000-000000000003';
-- Resetting the counter column does not lift the cap (it is based on ai_usage, which users cannot write).
update public.receipts set processing_attempts = 0 where id='c0000000-0000-4000-8000-000000000003';
\echo [expect FAIL: cap still enforced after counter reset]
select public.reserve_scan('c0000000-0000-4000-8000-000000000003','gateway:x');
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
select 'B sees A retries as full (no rows of B)', public.scan_retries_left('c0000000-0000-4000-8000-000000000003');
reset role;
delete from public.ai_usage; delete from public.receipts;
update public.subscriptions set plan = 'free' where user_id = 'aaaaaaaa-1111-4111-8111-111111111111';
