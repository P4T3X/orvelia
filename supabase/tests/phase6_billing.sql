-- Phase 6 smoke test: prices, effective plan (active / canceled until period end / past_due grace), billing tables are server-only, webhook idempotency.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
select 'prices', plan, price_monthly, currency from public.plan_limits order by price_monthly;
select 'overview free', effective_plan, status from public.billing_overview();
\echo [expect UPDATE 0: user cannot write own subscription]
update public.subscriptions set plan='ultra';
select 'still free', plan from public.subscriptions;
\echo [expect FAIL: user inserts checkout]
insert into public.billing_checkouts (user_id, plan, amount, currency) values ('aaaaaaaa-1111-4111-8111-111111111111','plus',1,'PEN');
\echo [expect 0: user cannot read billing_events]
select count(*) from public.billing_events;
reset role;
update public.subscriptions set plan='plus', status='active', current_period_end=now()+interval '20 days' where user_id='aaaaaaaa-1111-4111-8111-111111111111';
set role authenticated;
select 'active plus', effective_plan, (select max_products from public.product_usage()) as max_products from public.billing_overview();
reset role;
update public.subscriptions set status='canceled', cancel_at_period_end=true where user_id='aaaaaaaa-1111-4111-8111-111111111111';
set role authenticated;
select 'canceled but paid through -> still plus', effective_plan from public.billing_overview();
reset role;
update public.subscriptions set current_period_end=now()-interval '1 minute' where user_id='aaaaaaaa-1111-4111-8111-111111111111';
set role authenticated;
select 'period over -> free', effective_plan from public.billing_overview();
insert into public.products (name) select 'p'||g from generate_series(1,10) g;
\echo [expect FAIL: 11th product on effective free]
insert into public.products (name) values ('11');
reset role;
update public.subscriptions set status='past_due', current_period_end=now()+interval '3 days' where user_id='aaaaaaaa-1111-4111-8111-111111111111';
set role authenticated;
select 'past_due in grace -> plus, 11th ok', effective_plan from public.billing_overview();
insert into public.products (name) values ('11') returning 'inserted';
reset role;
insert into public.billing_events (provider, event_id, type) values ('mercadopago','evt-1','subscription_preapproval');
\echo [expect FAIL: duplicate webhook event]
insert into public.billing_events (provider, event_id, type) values ('mercadopago','evt-1','subscription_preapproval');
