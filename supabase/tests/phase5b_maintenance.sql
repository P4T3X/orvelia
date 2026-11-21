-- Stage 5 smoke test: maintenance plans, completion, reminders and ownership. Needs the two auth.users rows used below.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
insert into public.products (id, name) values ('d0000000-0000-4000-8000-000000000051','Aire acondicionado');
insert into public.maintenance_plans (id, product_id, title, interval_count, interval_unit, next_due_date, lead_days)
values ('e0000000-0000-4000-8000-000000000051','d0000000-0000-4000-8000-000000000051','Limpieza de filtros',6,'months',current_date + 20, 7);
select 'reminders created (7 days before + day of)', count(*) from public.reminders where source='maintenance' and source_id='e0000000-0000-4000-8000-000000000051' and status='scheduled';
select 'reminder title', title from public.reminders where source='maintenance' and lead_days=0;
\echo [expect FAIL: interval out of range]
insert into public.maintenance_plans (product_id, title, interval_count, interval_unit, next_due_date) values ('d0000000-0000-4000-8000-000000000051','x',0,'months',current_date);
\echo [expect FAIL: unknown unit]
insert into public.maintenance_plans (product_id, title, interval_count, interval_unit, next_due_date) values ('d0000000-0000-4000-8000-000000000051','x',1,'hours',current_date);
select 'complete today', public.complete_maintenance('e0000000-0000-4000-8000-000000000051', current_date, 120, 'PEN', 'Técnico Juan', 'Todo ok') is not null;
select 'next due = today + 6 months', next_due_date = (current_date + interval '6 months')::date, last_done_date = current_date from public.maintenance_plans where id='e0000000-0000-4000-8000-000000000051';
select 'log stored', title, cost, currency, provider from public.maintenance_logs where plan_id='e0000000-0000-4000-8000-000000000051';
select 'reminders moved to new date', count(*) from public.reminders where source='maintenance' and status='scheduled' and scheduled_at::date >= (current_date + interval '6 months' - interval '8 days')::date;
select 'older visit logged', public.complete_maintenance('e0000000-0000-4000-8000-000000000051', current_date - 100) is not null;
select 'older visit does not pull schedule back', next_due_date = (current_date + interval '6 months')::date, last_done_date = current_date from public.maintenance_plans where id='e0000000-0000-4000-8000-000000000051';
select 'cost without currency dropped', count(*) from public.maintenance_logs where cost is null and currency is null;
\echo [expect FAIL: performed in the future]
select public.complete_maintenance('e0000000-0000-4000-8000-000000000051', current_date + 5);
\echo [expect FAIL: cost without currency]
insert into public.maintenance_logs (product_id, title, performed_on, cost) values ('d0000000-0000-4000-8000-000000000051','x',current_date,10);
update public.maintenance_plans set active = false where id='e0000000-0000-4000-8000-000000000051';
select 'paused plan has no pending reminders', count(*) from public.reminders where source='maintenance' and status='scheduled';
update public.maintenance_plans set active = true where id='e0000000-0000-4000-8000-000000000051';
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
select 'B sees no plans', count(*) from public.maintenance_plans;
select 'B sees no logs', count(*) from public.maintenance_logs;
\echo [expect FAIL: B completes A plan]
select public.complete_maintenance('e0000000-0000-4000-8000-000000000051', current_date);
\echo [expect FAIL: B creates plan on A product (FK)]
insert into public.maintenance_plans (product_id, title, interval_count, interval_unit, next_due_date) values ('d0000000-0000-4000-8000-000000000051','x',1,'months',current_date);
update public.maintenance_plans set title='hack' where id='e0000000-0000-4000-8000-000000000051';
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
select 'title untouched by B', title from public.maintenance_plans where id='e0000000-0000-4000-8000-000000000051';
delete from public.products where id='d0000000-0000-4000-8000-000000000051';
select 'cascade: plans, logs, reminders gone', (select count(*) from public.maintenance_plans), (select count(*) from public.maintenance_logs), (select count(*) from public.reminders where source='maintenance' and status='scheduled');
reset role;
set role anon;
\echo [expect FAIL: anon reads plans]
select count(*) from public.maintenance_plans;
reset role;
