-- Phase 4 smoke test: automatic reminders, preferences, claim/complete delivery API, notifications. Needs the two auth.users rows used below and a service_role role.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
insert into public.products (id, name) values ('e0000000-0000-4000-8000-000000000001','Laptop');
insert into public.warranties (id, product_id, end_date) values ('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001', current_date + 40);
select 'warranty reminders (expect 30,7)', string_agg(lead_days::text, ',' order by lead_days desc) from public.reminders where source='warranty';
select 'at 09:00 Lima', to_char(min(scheduled_at) at time zone 'America/Lima','HH24:MI') from public.reminders where source='warranty';
select 'title', title from public.reminders where source='warranty' and lead_days=7;
insert into public.return_deadlines (id, product_id, deadline_date) values ('e2000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001', current_date + 2);
select 'return reminders (expect 1 only; 3 is past)', string_agg(lead_days::text, ',') from public.reminders where source='return';
insert into public.documents (id, title, storage_path, expires_on) values ('e3000000-0000-4000-8000-000000000001','Póliza hogar','aaaaaaaa-1111-4111-8111-111111111111/documents/p/file.pdf', current_date + 20);
select 'document reminders (expect 7)', string_agg(lead_days::text, ',') from public.reminders where source='document';
update public.warranties set end_date = current_date + 100 where id='e1000000-0000-4000-8000-000000000001';
select 'after edit still 2 warranty reminders', count(*) from public.reminders where source='warranty';
update public.products set name='Laptop Pro' where id='e0000000-0000-4000-8000-000000000001';
select 'renamed title', title from public.reminders where source='warranty' and lead_days=7;
\echo [expect FAIL: user inserts automatic reminder]
insert into public.reminders (title, scheduled_at, source, source_id) values ('x', now()+interval '1 day','warranty','e1000000-0000-4000-8000-000000000001');
insert into public.reminders (id, title, scheduled_at, recurrence) values ('e4000000-0000-4000-8000-000000000001','Cambiar filtro de agua', now()+interval '1 day','quarterly');
\echo [expect FAIL: user edits delivery bookkeeping]
update public.reminders set attempts = 99;
insert into public.notification_preferences (user_id, warranty_lead_days, return_lead_days) values ('aaaaaaaa-1111-4111-8111-111111111111','{60,1}','{1,0}');
select 'resynced sources', public.resync_my_reminders();
select 'warranty leads after prefs (expect 60,1)', string_agg(lead_days::text, ',' order by lead_days desc) from public.reminders where source='warranty';
\echo [expect FAIL: invalid lead days]
update public.notification_preferences set warranty_lead_days='{400}';
\echo [expect FAIL: user claims reminders]
select * from public.claim_due_reminders(10);
delete from public.warranties where id='e1000000-0000-4000-8000-000000000001';
select 'warranty deleted -> reminders gone', count(*) from public.reminders where source='warranty';
reset role;
-- make two reminders due
update public.reminders set scheduled_at = now() - interval '1 minute' where source='return' or id='e4000000-0000-4000-8000-000000000001';
set role service_role;
select 'claimed', count(*), min(email) from public.claim_due_reminders(10);
select 'claim again (expect 0, already claimed)', count(*) from public.claim_due_reminders(10);
select public.complete_reminder(id, 'sent') from public.reminders where source='return' \g /dev/null
select public.complete_reminder('e4000000-0000-4000-8000-000000000001', 'failed', 'smtp 503', true) \g /dev/null
reset role;
select 'return sent', status, (sent_at is not null) from public.reminders where source='return';
select 'retry kept scheduled', status, attempts, claimed_at is null from public.reminders where id='e4000000-0000-4000-8000-000000000001';
set role service_role;
select count(*) from public.claim_due_reminders(10) \g /dev/null
select public.complete_reminder('e4000000-0000-4000-8000-000000000001', 'skipped') \g /dev/null
reset role;
select 'recurring next occurrence (expect future, ~3 months)', count(*), bool_and(scheduled_at > now() + interval '80 days') from public.reminders where title='Cambiar filtro de agua' and status='scheduled';
select 'notifications', count(*), string_agg(email_status, ',' order by email_status) from public.notifications;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
update public.notifications set read_at = now();
\echo [expect FAIL: user edits notification title]
update public.notifications set title = 'hack';
select 'A unread after mark', count(*) from public.notifications where read_at is null;
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
select 'B sees notifications (expect 0)', count(*) from public.notifications;
select 'B sees reminders (expect 0)', count(*) from public.reminders;
reset role;
