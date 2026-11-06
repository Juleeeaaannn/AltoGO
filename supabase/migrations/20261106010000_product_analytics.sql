-- ============================================================================
-- AltoGO · Ranking de productos vendidos
-- ----------------------------------------------------------------------------
-- Ejecutar después de la migración de delivery. Devuelve las ventas agrupadas
-- por producto. El super admin ve todos los comercios; un dueño solo el suyo.
-- ============================================================================

begin;

create or replace function public.api_product_analytics(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_products jsonb := '[]'::jsonb;
  v_businesses jsonb := '[]'::jsonb;
  v_totals jsonb;
begin
  v_staff := public._require_staff(p_token);

  select jsonb_build_object(
    'orders', count(distinct o.id)::integer,
    'items', coalesce(sum(oi.qty), 0)::integer,
    'revenue', coalesce(sum(oi.qty * oi.unit_price), 0)::integer
  )
  into v_totals
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status <> 'cancelado'
    and (v_staff.role = 'super' or o.business_id = v_staff.business_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'productId', x.product_id,
    'name', x.name,
    'businessSlug', x.business_slug,
    'businessName', x.business_name,
    'qty', x.qty,
    'revenue', x.revenue,
    'orders', x.orders,
    'lastSoldAt', x.last_sold_at
  ) order by x.qty desc, x.revenue desc), '[]'::jsonb)
  into v_products
  from (
    select
      (array_agg(oi.product_id))[1] as product_id,
      coalesce(p.name, max(oi.name)) as name,
      b.slug as business_slug,
      b.name as business_name,
      sum(oi.qty)::integer as qty,
      sum(oi.qty * oi.unit_price)::integer as revenue,
      count(distinct o.id)::integer as orders,
      max(o.created_at) as last_sold_at
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.businesses b on b.id = o.business_id
    left join public.products p on p.id = oi.product_id
    where o.status <> 'cancelado'
      and (v_staff.role = 'super' or o.business_id = v_staff.business_id)
    group by coalesce(oi.product_id::text, 'name:' || lower(oi.name)), p.name, b.id, b.slug, b.name
    order by sum(oi.qty) desc, sum(oi.qty * oi.unit_price) desc
    limit 200
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', x.slug,
    'name', x.name,
    'qty', x.qty,
    'revenue', x.revenue,
    'orders', x.orders
  ) order by x.qty desc, x.revenue desc), '[]'::jsonb)
  into v_businesses
  from (
    select b.id, b.slug, b.name,
      sum(oi.qty)::integer as qty,
      sum(oi.qty * oi.unit_price)::integer as revenue,
      count(distinct o.id)::integer as orders
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.businesses b on b.id = o.business_id
    where o.status <> 'cancelado'
      and (v_staff.role = 'super' or o.business_id = v_staff.business_id)
    group by b.id, b.slug, b.name
  ) x;

  return jsonb_build_object(
    'totals', coalesce(v_totals, jsonb_build_object('orders', 0, 'items', 0, 'revenue', 0)),
    'products', v_products,
    'businesses', v_businesses
  );
end;
$$;

revoke all on function public.api_product_analytics(text) from public;
grant execute on function public.api_product_analytics(text) to anon, authenticated;

commit;
