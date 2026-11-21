-- =============================================================================
-- ORVELIA — Stage 2 (My Collection) completion
--   * product_overview: one row per product with its category name and warranty
--     summary, so the collection can show coverage on each card, filter by it and
--     sort by it in a single query.
--   * The view runs with the caller's privileges (security_invoker), so the
--     products/warranties/categories RLS policies apply unchanged.
--   * Index for the brand filter.
-- =============================================================================

create or replace view public.product_overview
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.name,
  p.brand,
  p.model,
  p.status,
  p.category_id,
  c.name                     as category_name,
  p.purchase_date,
  p.purchase_price,
  p.currency,
  p.seller,
  p.image_path,
  p.search_text,
  p.created_at,
  p.updated_at,
  w.warranty_count,
  w.warranty_end,            -- latest end date among the product's warranties (null if none has one)
  r.next_return_deadline     -- earliest return deadline from today on
from public.products p
left join public.categories c on c.id = p.category_id
left join lateral (
  select count(*)::int as warranty_count, max(x.end_date) as warranty_end
    from public.warranties x
   where x.product_id = p.id and x.user_id = p.user_id
) w on true
left join lateral (
  select min(d.deadline_date) as next_return_deadline
    from public.return_deadlines d
   where d.product_id = p.id and d.user_id = p.user_id and d.deadline_date >= current_date
) r on true;

comment on view public.product_overview is
  'Collection rows with category and warranty summary. security_invoker: RLS of the base tables applies.';

-- Clients read it like any table; RLS on products decides which rows exist.
revoke all on public.product_overview from anon;
grant select on public.product_overview to authenticated;

-- Brand filter (case-insensitive equality on the owner's products).
create index if not exists products_user_brand_idx on public.products (user_id, lower(brand)) where brand is not null;
