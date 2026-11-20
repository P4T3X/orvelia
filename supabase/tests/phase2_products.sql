-- Phase 2 smoke test: product limit, search column, image path ownership, product_usage(). Run after rls_smoke.sql setup (needs auth.users rows).
\set ON_ERROR_STOP 0
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333','c@x.com'), ('44444444-4444-4444-4444-444444444444','d@x.com');
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
insert into public.products (name, brand, model, serial_number) select 'Cámara Nº'||g, 'Sony', 'A7 IV', 'SN'||g from generate_series(1,10) g;
select 'C has', count(*) from public.products;
\echo [expect FAIL: 11th product on free plan]
insert into public.products (name) values ('once');
select 'usage', * from public.product_usage();
select 'search camara (accent-insensitive)', count(*) from public.products where search_text like '%camara%';
select 'search sn3', name from public.products where search_text like '%sn3%';
\echo [expect FAIL: image path in another user folder]
update public.products set image_path='44444444-4444-4444-4444-444444444444/products/x.jpg' where name='Cámara Nº1';
update public.products set image_path='33333333-3333-3333-3333-333333333333/products/p1/a.jpg' where name='Cámara Nº1';
select 'image ok', image_path from public.products where name='Cámara Nº1';
\echo [expect FAIL: user cannot call trigger fn]
select public.enforce_product_limit();
reset role;
update public.subscriptions set plan='plus' where user_id='33333333-3333-3333-3333-333333333333';
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
insert into public.products (name) values ('once (plus)');
select 'plus usage', * from public.product_usage();
reset role;
update public.subscriptions set status='past_due' where user_id='33333333-3333-3333-3333-333333333333';
set role authenticated;
\echo [expect FAIL: past_due falls back to free]
insert into public.products (name) values ('doce');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
select 'D usage', * from public.product_usage();
insert into public.categories (user_id, name) values ('44444444-4444-4444-4444-444444444444','Bicicletas') returning name;
\echo [expect FAIL: use another user category]
