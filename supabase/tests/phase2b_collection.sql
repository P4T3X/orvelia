-- Stage 2 completion: product_overview respects RLS (security_invoker), summarizes warranties,
-- and product CRUD stays owner-only.
\set ON_ERROR_STOP 0
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',false) \g /dev/null
insert into public.products (id, name, brand, purchase_price, currency, purchase_date) values
  ('e1000000-0000-4000-8000-000000000001', 'Televisor', 'Samsung', 2500, 'PEN', current_date - 400),
  ('e1000000-0000-4000-8000-000000000002', 'Laptop', 'Lenovo', 4200, 'PEN', current_date - 30),
  ('e1000000-0000-4000-8000-000000000003', 'Silla', null, null, null, null);
insert into public.warranties (product_id, end_date) values
  ('e1000000-0000-4000-8000-000000000001', current_date - 35),
  ('e1000000-0000-4000-8000-000000000002', current_date + 10),
  ('e1000000-0000-4000-8000-000000000002', current_date + 335);
insert into public.return_deadlines (product_id, deadline_date) values ('e1000000-0000-4000-8000-000000000002', current_date + 3);
select 'overview', name, warranty_count, warranty_end - current_date as end_in, next_return_deadline - current_date as return_in
  from public.product_overview order by name;
select 'coverage active', count(*) from public.product_overview where warranty_end >= current_date;
select 'coverage expired', count(*) from public.product_overview where warranty_end < current_date;
select 'coverage none', count(*) from public.product_overview where warranty_count = 0;
select 'brand filter', count(*) from public.product_overview where brand ilike 'samsung';

select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',false) \g /dev/null
select 'other user sees overview rows', count(*) from public.product_overview;
\echo [expect UPDATE 0: cannot edit a product of another user]
update public.products set name = 'Robado' where id = 'e1000000-0000-4000-8000-000000000001';
\echo [expect DELETE 0: cannot delete a product of another user]
delete from public.products where id = 'e1000000-0000-4000-8000-000000000001';
\echo [expect FAIL: cannot create a product for another user]
insert into public.products (user_id, name) values ('aaaaaaaa-1111-4111-8111-111111111111', 'Intruso');
\echo [expect FAIL: cannot attach a warranty to a product of another user]
insert into public.warranties (product_id, end_date) values ('e1000000-0000-4000-8000-000000000001', current_date + 100);
reset role;
set role anon;
\echo [expect FAIL: anon cannot read the overview]
select count(*) from public.product_overview;
reset role;
select 'name unchanged', name from public.products where id = 'e1000000-0000-4000-8000-000000000001';
