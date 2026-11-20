-- Phase 5 smoke test: assistant quota (plan, monthly, per-minute) and usage isolation. Needs the two auth.users rows used below.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
select 'free usage', * from public.assistant_usage();
\echo [expect FAIL: ai_not_included on free]
select public.reserve_assistant_query('fixture');
reset role;
update public.subscriptions set plan='plus' where user_id='aaaaaaaa-1111-4111-8111-111111111111';
update public.plan_limits set ai_queries_per_month = 12 where plan='plus';
set role authenticated;
select 'plus usage', * from public.assistant_usage();
select count(public.reserve_assistant_query('fixture')) from generate_series(1,10);
\echo [expect FAIL: rate_limited (11th in a minute)]
select public.reserve_assistant_query('fixture');
reset role;
update public.ai_usage set created_at = now() - interval '2 minutes';
set role authenticated;
select public.finish_usage(id, true) from public.ai_usage where status='reserved' \g /dev/null
select 'after 10 ok', * from public.assistant_usage();
select 'r11', public.reserve_assistant_query('fixture') is not null;
select public.finish_usage(id, false) from public.ai_usage where status='reserved' \g /dev/null
select 'failed does not count', used from public.assistant_usage();
select 'r11b', public.reserve_assistant_query('fixture') is not null;
select 'r12', public.reserve_assistant_query('fixture') is not null;
\echo [expect FAIL: ai_limit_reached at 12]
select public.reserve_assistant_query('fixture');
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
\echo [expect 0 rows changed: B finishes A usage]
select public.finish_usage((select id from public.ai_usage where status='reserved' limit 1), false);
select 'B sees usage rows (expect 0)', count(*) from public.ai_usage;
\echo [expect FAIL: internal fn]
select public.usage_this_month('aaaaaaaa-1111-4111-8111-111111111111','assistant');
reset role;
select 'A reserved still', count(*) from public.ai_usage where status='reserved';
