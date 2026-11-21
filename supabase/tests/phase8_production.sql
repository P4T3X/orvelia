-- Phase 8 smoke test: feedback is insert/read-own with a daily cap; trigger functions are not callable.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
insert into public.feedback (user_id, kind, message, page) values ('aaaaaaaa-1111-4111-8111-111111111111','problem','No carga el calendario','/app/calendar') returning 'inserted';
\echo [expect FAIL: feedback as another user]
insert into public.feedback (user_id, kind, message) values ('bbbbbbbb-2222-4222-8222-222222222222','idea','Suplantación');
\echo [expect FAIL: page must be an app path]
insert into public.feedback (user_id, kind, message, page) values ('aaaaaaaa-1111-4111-8111-111111111111','idea','Hola mundo','https://evil.example');
insert into public.feedback (user_id, kind, message) select 'aaaaaaaa-1111-4111-8111-111111111111','idea','Idea número '||g from generate_series(1,9) g;
\echo [expect FAIL: 11th feedback in a day]
insert into public.feedback (user_id, kind, message) values ('aaaaaaaa-1111-4111-8111-111111111111','idea','Una más');
\echo [expect UPDATE 0: feedback is append-only]
update public.feedback set message = 'editado';
select 'own feedback', count(*) from public.feedback;
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
select 'other user sees', count(*) from public.feedback;
\echo [expect FAIL: trigger function not callable]
select public.enforce_feedback_rate();
\echo [expect FAIL: handle_new_user not callable]
select public.handle_new_user();
