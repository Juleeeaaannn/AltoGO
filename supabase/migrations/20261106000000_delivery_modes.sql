-- ============================================================================
-- AltoGO · Delivery configurable por comercio
-- ----------------------------------------------------------------------------
-- Ejecutar en Supabase → SQL Editor si la base ya existía antes de esta versión.
-- Agrega:
--   shipping_mode = 'fixed' | 'zones' | 'whatsapp'
--   shipping_zones (zonas con nombre y precio)
--   shipping_mode / shipping_zone en los pedidos
-- ============================================================================

begin;

alter table public.businesses
  add column if not exists shipping_mode text not null default 'fixed';

do $$ begin
  alter table public.businesses
    add constraint businesses_shipping_mode_check
    check (shipping_mode in ('fixed', 'zones', 'whatsapp'));
exception when duplicate_object then null;
end $$;

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  price integer not null check (price between 0 and 1000000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists shipping_mode text not null default 'fixed';
alter table public.orders
  add column if not exists shipping_zone text not null default '';

do $$ begin
  alter table public.orders
    add constraint orders_shipping_mode_check
    check (shipping_mode in ('fixed', 'zones', 'whatsapp'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.orders
    add constraint orders_shipping_zone_check
    check (char_length(shipping_zone) <= 60);
exception when duplicate_object then null;
end $$;

create index if not exists shipping_zones_business_idx
  on public.shipping_zones (business_id, sort_order);

alter table public.shipping_zones enable row level security;
revoke all on table public.shipping_zones from anon, authenticated;

create or replace function public.api_snapshot(p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_is_super boolean := false;
  v_owner_business uuid;
  v_businesses jsonb;
  v_products jsonb;
  v_users jsonb := '[]'::jsonb;
  v_global jsonb;
  v_user jsonb := 'null'::jsonb;
begin
  if p_token is not null and length(p_token) > 0 then
    v_staff := public._staff_for_token(p_token);
  end if;

  v_is_super := coalesce(v_staff.role = 'super', false);
  if v_staff.role = 'owner' then
    v_owner_business := v_staff.business_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'slug', b.slug,
    'name', b.name,
    'whatsapp', b.whatsapp,
    'shippingMode', b.shipping_mode,
    'shippingCost', b.shipping_cost,
    'shippingZones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id,
        'name', z.name,
        'price', z.price
      ) order by z.sort_order, z.created_at)
      from public.shipping_zones z
      where z.business_id = b.id
    ), '[]'::jsonb),
    'logo', b.logo,
    'status', b.status,
    'open', b.open,
    'tagline', b.tagline,
    'visits', b.visits,
    'whatsappClicks', b.whatsapp_clicks,
    'createdAt', to_char(b.created_at, 'YYYY-MM-DD')
  ) order by b.sort_order, b.created_at), '[]'::jsonb)
  into v_businesses
  from public.businesses b
  where b.status = 'activo' or v_is_super or b.id = v_owner_business;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'businessSlug', b.slug,
    'name', p.name,
    'category', p.category,
    'price', p.price,
    'image', p.image,
    'stock', case when p.stock_kind = 'bool'
      then to_jsonb(coalesce(p.stock_available, false))
      else to_jsonb(coalesce(p.stock_qty, 0))
    end
  ) order by p.sort_order, p.created_at), '[]'::jsonb)
  into v_products
  from public.products p
  join public.businesses b on b.id = p.business_id
  where b.status = 'activo' or v_is_super or b.id = v_owner_business;

  if v_is_super then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'username', s.username,
      'name', s.name,
      'role', s.role,
      'businessSlug', b.slug
    ) order by s.created_at), '[]'::jsonb)
    into v_users
    from public.staff s
    left join public.businesses b on b.id = s.business_id
    where s.active;
  end if;

  select jsonb_build_object('visits', visits, 'whatsappClicks', whatsapp_clicks)
  into v_global
  from public.platform_stats where id = 1;

  if v_staff.id is not null then
    select jsonb_build_object(
      'id', v_staff.id,
      'username', v_staff.username,
      'name', v_staff.name,
      'role', v_staff.role,
      'businessSlug', b.slug
    )
    into v_user
    from public.staff s
    left join public.businesses b on b.id = s.business_id
    where s.id = v_staff.id;
  end if;

  return jsonb_build_object(
    'businesses', v_businesses,
    'products', v_products,
    'users', v_users,
    'global', coalesce(v_global, jsonb_build_object('visits', 0, 'whatsappClicks', 0)),
    'user', v_user
  );
end;
$$;

drop function if exists public.api_owner_save_business(text, text, text, integer, text, boolean, text);

create or replace function public.api_owner_save_business(
  p_token text,
  p_name text,
  p_whatsapp text,
  p_shipping_mode text,
  p_shipping_cost integer,
  p_shipping_zones jsonb,
  p_logo text,
  p_open boolean,
  p_tagline text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_business public.businesses;
  v_zone record;
  v_zone_order integer := 0;
  v_zone_names text[] := '{}';
  v_zone_name text;
  v_zones jsonb;
begin
  v_staff := public._require_owner(p_token);

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'El nombre del comercio es demasiado corto.' using errcode = '22023';
  end if;
  if coalesce(p_whatsapp, '') !~ '^[0-9]{8,15}$' then
    raise exception 'El WhatsApp debe tener entre 8 y 15 dígitos.' using errcode = '22023';
  end if;
  if coalesce(p_shipping_mode, '') not in ('fixed', 'zones', 'whatsapp') then
    raise exception 'Elige una forma válida de cobrar el delivery.' using errcode = '22023';
  end if;
  if p_shipping_cost is null or p_shipping_cost < 0 or p_shipping_cost > 1000000 then
    raise exception 'El precio del delivery no es válido.' using errcode = '22023';
  end if;
  if p_shipping_zones is null or jsonb_typeof(p_shipping_zones) <> 'array' then
    p_shipping_zones := '[]'::jsonb;
  end if;
  if jsonb_array_length(p_shipping_zones) > 20 then
    raise exception 'Puedes configurar hasta 20 zonas de delivery.' using errcode = '22023';
  end if;
  if p_shipping_mode = 'zones' and jsonb_array_length(p_shipping_zones) = 0 then
    raise exception 'Agrega al menos una zona de delivery.' using errcode = '22023';
  end if;
  if coalesce(p_logo, '') <> '' and p_logo !~* '^https?://' then
    raise exception 'La URL del logo no es válida.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_tagline, '')) > 160 then
    raise exception 'La biografía es demasiado larga.' using errcode = '22023';
  end if;

  update public.businesses
  set name = trim(p_name),
      whatsapp = p_whatsapp,
      shipping_mode = p_shipping_mode,
      shipping_cost = p_shipping_cost,
      logo = coalesce(trim(p_logo), ''),
      open = coalesce(p_open, true),
      tagline = coalesce(trim(p_tagline), '')
  where id = v_staff.business_id
  returning * into v_business;

  update public.staff set name = v_business.name where id = v_staff.id;

  delete from public.shipping_zones where business_id = v_business.id;

  for v_zone in
    select * from jsonb_to_recordset(p_shipping_zones) as x(name text, price integer)
  loop
    v_zone_name := trim(coalesce(v_zone.name, ''));
    if char_length(v_zone_name) < 2 or char_length(v_zone_name) > 60 then
      raise exception 'El nombre de cada zona debe tener entre 2 y 60 caracteres.' using errcode = '22023';
    end if;
    if v_zone.price is null or v_zone.price < 0 or v_zone.price > 1000000 then
      raise exception 'El precio de la zona “%” no es válido.', v_zone_name using errcode = '22023';
    end if;
    if lower(v_zone_name) = any(v_zone_names) then
      raise exception 'La zona “%” está repetida.', v_zone_name using errcode = '22023';
    end if;
    v_zone_names := array_append(v_zone_names, lower(v_zone_name));

    insert into public.shipping_zones (business_id, name, price, sort_order)
    values (v_business.id, v_zone_name, v_zone.price, v_zone_order);
    v_zone_order := v_zone_order + 1;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', z.id,
    'name', z.name,
    'price', z.price
  ) order by z.sort_order, z.created_at), '[]'::jsonb)
  into v_zones
  from public.shipping_zones z
  where z.business_id = v_business.id;

  return jsonb_build_object(
    'id', v_business.id,
    'slug', v_business.slug,
    'name', v_business.name,
    'whatsapp', v_business.whatsapp,
    'shippingMode', v_business.shipping_mode,
    'shippingCost', v_business.shipping_cost,
    'shippingZones', v_zones,
    'logo', v_business.logo,
    'status', v_business.status,
    'open', v_business.open,
    'tagline', v_business.tagline
  );
end;
$$;
drop function if exists public.api_create_order(text, text, text, text, jsonb);

create or replace function public.api_create_order(
  p_business_slug text,
  p_customer_name text,
  p_notes text,
  p_payment text,
  p_items jsonb,
  p_shipping_zone uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_business public.businesses;
  v_product public.products;
  v_item record;
  v_order_id uuid;
  v_code text;
  v_subtotal integer := 0;
  v_shipping integer;
  v_total integer;
  v_count integer := 0;
  v_zone public.shipping_zones;
  v_zone_name text := '';
begin
  select * into v_business
  from public.businesses
  where slug = p_business_slug and status = 'activo'
  for update;

  if v_business.id is null then
    raise exception 'El comercio no está disponible.' using errcode = 'P0002';
  end if;
  if not v_business.open then
    raise exception 'Este comercio está cerrado en este momento.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_customer_name, ''))) = 0 then
    raise exception 'Escribe tu nombre para continuar.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_customer_name, ''))) > 80 then
    raise exception 'El nombre es demasiado largo.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'Las observaciones son demasiado largas.' using errcode = '22023';
  end if;
  if p_payment not in ('efectivo', 'transferencia') then
    raise exception 'Elige una forma de pago válida.' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'El pedido tiene demasiados productos.' using errcode = '22023';
  end if;

  if v_business.shipping_mode = 'zones' then
    if p_shipping_zone is null then
      raise exception 'Elige tu zona de entrega.' using errcode = '22023';
    end if;
    select * into v_zone
    from public.shipping_zones
    where id = p_shipping_zone and business_id = v_business.id;
    if v_zone.id is null then
      raise exception 'La zona de entrega elegida ya no está disponible.' using errcode = 'P0002';
    end if;
    v_shipping := v_zone.price;
    v_zone_name := v_zone.name;
  elsif v_business.shipping_mode = 'whatsapp' then
    v_shipping := 0;
  else
    v_shipping := v_business.shipping_cost;
  end if;

  v_code := 'AG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    code, business_id, customer_name, notes, payment, subtotal, shipping, total,
    shipping_mode, shipping_zone
  ) values (
    v_code, v_business.id, trim(p_customer_name), trim(coalesce(p_notes, '')),
    p_payment, 0, v_shipping, v_shipping,
    v_business.shipping_mode, v_zone_name
  ) returning id into v_order_id;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x("productId" uuid, qty integer)
  loop
    if v_item.qty is null or v_item.qty < 1 or v_item.qty > 99 then
      raise exception 'Cantidad inválida en el pedido.' using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where id = v_item."productId" and business_id = v_business.id
    for update;

    if v_product.id is null then
      raise exception 'Un producto del pedido ya no está disponible.' using errcode = 'P0002';
    end if;
    if v_product.stock_kind = 'bool' and not coalesce(v_product.stock_available, false) then
      raise exception 'El producto “%” está agotado.', v_product.name using errcode = '22023';
    end if;
    if v_product.stock_kind = 'qty' and v_item.qty > coalesce(v_product.stock_qty, 0) then
      raise exception 'No hay stock suficiente de “%”.', v_product.name using errcode = '22023';
    end if;

    if exists (
      select 1 from public.order_items
      where order_id = v_order_id and product_id = v_product.id
    ) then
      raise exception 'Hay productos repetidos en el pedido.' using errcode = '22023';
    end if;

    insert into public.order_items (order_id, product_id, name, unit_price, qty)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_item.qty);

    if v_product.stock_kind = 'qty' then
      update public.products
      set stock_qty = stock_qty - v_item.qty
      where id = v_product.id;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_item.qty);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'El pedido está vacío.' using errcode = '22023';
  end if;

  v_total := v_subtotal + v_shipping;

  update public.orders
  set subtotal = v_subtotal, total = v_total
  where id = v_order_id;

  update public.platform_stats set whatsapp_clicks = whatsapp_clicks + 1 where id = 1;
  update public.businesses set whatsapp_clicks = whatsapp_clicks + 1 where id = v_business.id;

  return jsonb_build_object(
    'orderCode', v_code,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'shippingMode', v_business.shipping_mode,
    'shippingZone', v_zone_name,
    'total', v_total
  );
end;
$$;


revoke all on function public.api_snapshot(text) from public;
revoke all on function public.api_owner_save_business(text, text, text, text, integer, jsonb, text, boolean, text) from public;
revoke all on function public.api_create_order(text, text, text, text, jsonb, uuid) from public;

grant execute on function public.api_snapshot(text) to anon, authenticated;
grant execute on function public.api_owner_save_business(text, text, text, text, integer, jsonb, text, boolean, text) to anon, authenticated;
grant execute on function public.api_create_order(text, text, text, text, jsonb, uuid) to anon, authenticated;

commit;
