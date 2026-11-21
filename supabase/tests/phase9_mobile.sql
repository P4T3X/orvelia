-- Phase 9 smoke test: push tokens are per user, registered only through the function,
-- move to whoever signs in last on a device, and are capped per account.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
select public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ios', 'iPhone de Ana');
select public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ios', 'iPhone de Ana'); -- idempotent
select 'ana tokens', count(*) from public.push_tokens;
\echo [expect FAIL: malformed token]
select public.register_push_token('not-a-token', 'ios', null);
\echo [expect FAIL: unknown platform]
select public.register_push_token('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', 'windows', null);
\echo [expect FAIL: direct insert is not allowed]
insert into public.push_tokens (user_id, token, platform) values ('aaaaaaaa-1111-4111-8111-111111111111', 'ExponentPushToken[cccccccccccccccccccccc]', 'ios');
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
select 'otro sees', count(*) from public.push_tokens;
\echo [expect DELETE 0: cannot delete a token of another user]
delete from public.push_tokens;
-- Same phone, new account: the token moves to Otro.
select public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ios', 'iPhone compartido');
select 'otro now owns it', count(*) from public.push_tokens;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
select 'ana after move', count(*) from public.push_tokens;
select public.register_push_token('ExponentPushToken[device' || lpad(g::text, 14, '0') || ']', 'android', null) from generate_series(1, 12) g \g /dev/null
select 'ana capped at 10', count(*) from public.push_tokens;
select 'push on by default', coalesce((select push_enabled from public.notification_preferences), true);
reset role;
\echo [expect FAIL: anon cannot register]
set role anon;
select public.register_push_token('ExponentPushToken[dddddddddddddddddddddd]', 'ios', null);
