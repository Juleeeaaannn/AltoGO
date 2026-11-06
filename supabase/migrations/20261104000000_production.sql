-- ============================================================================
-- AltoGO · Esquema de producción para Supabase
-- ----------------------------------------------------------------------------
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- Todo el acceso pasa por funciones RPC con SECURITY DEFINER. Las tablas
-- quedan sin permisos directos para anon/authenticated.
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^[0-9]{8,15}$'),
  shipping_mode text not null default 'fixed' check (shipping_mode in ('fixed', 'zones', 'whatsapp')),
  shipping_cost integer not null default 0 check (shipping_cost between 0 and 1000000),
  logo text not null default '' check (logo = '' or logo ~* '^https?://'),
  status text not null default 'activo' check (status in ('activo', 'oculto')),
  open boolean not null default true,
  tagline text not null default '' check (char_length(tagline) <= 160),
  visits bigint not null default 0,
  whatsapp_clicks bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (char_length(category) between 2 and 40),
  price integer not null check (price between 1 and 100000000),
  image text not null default '' check (image = '' or image ~* '^https?://'),
  stock_kind text not null default 'qty' check (stock_kind in ('qty', 'bool')),
  stock_qty integer check (stock_qty between 0 and 99999),
  stock_available boolean,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (stock_kind = 'qty' and stock_qty is not null and stock_available is null)
    or (stock_kind = 'bool' and stock_available is not null and stock_qty is null)
  )
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,23}$'),
  password_hash text not null,
  role text not null check (role in ('super', 'owner')),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null default '',
  active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  check ((role = 'super' and business_id is null) or (role = 'owner' and business_id is not null))
);

create table if not exists public.sessions (
  token_hash text primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  price integer not null check (price between 0 and 1000000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  notes text not null default '',
  payment text not null check (payment in ('efectivo', 'transferencia')),
  subtotal integer not null default 0,
  shipping integer not null default 0,
  total integer not null default 0,
  shipping_mode text not null default 'fixed' check (shipping_mode in ('fixed', 'zones', 'whatsapp')),
  shipping_zone text not null default '' check (char_length(shipping_zone) <= 60),
  status text not null default 'whatsapp' check (status in ('whatsapp', 'confirmado', 'entregado', 'cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  unit_price integer not null,
  qty integer not null check (qty between 1 and 99)
);

create table if not exists public.platform_stats (
  id smallint primary key check (id = 1),
  visits bigint not null default 0,
  whatsapp_clicks bigint not null default 0
);

insert into public.platform_stats (id) values (1) on conflict (id) do nothing;

create index if not exists products_business_idx on public.products (business_id, sort_order);
create index if not exists staff_business_idx on public.staff (business_id);
create index if not exists sessions_staff_idx on public.sessions (staff_id);
create index if not exists sessions_expiry_idx on public.sessions (expires_at);
create index if not exists shipping_zones_business_idx on public.shipping_zones (business_id, sort_order);
create index if not exists orders_business_idx on public.orders (business_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Sin acceso directo: la API son las funciones de abajo.
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.staff enable row level security;
alter table public.sessions enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.platform_stats enable row level security;

revoke all on table public.businesses from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.staff from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.shipping_zones from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.platform_stats from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

create or replace function public._staff_for_token(p_token text)
returns public.staff
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select s.*
  from public.sessions se
  join public.staff s on s.id = se.staff_id
  where se.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and se.expires_at > now()
    and s.active
  limit 1
$$;

create or replace function public._require_staff(p_token text)
returns public.staff
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
begin
  v_staff := public._staff_for_token(p_token);
  if v_staff.id is null then
    raise exception 'Tu sesión expiró. Vuelve a ingresar.' using errcode = '28000';
  end if;
  return v_staff;
end;
$$;

create or replace function public._require_super(p_token text)
returns public.staff
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
begin
  v_staff := public._require_staff(p_token);
  if v_staff.role <> 'super' then
    raise exception 'No tienes permisos de super administrador.' using errcode = '42501';
  end if;
  return v_staff;
end;
$$;

create or replace function public._require_owner(p_token text)
returns public.staff
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
begin
  v_staff := public._require_staff(p_token);
  if v_staff.role <> 'owner' or v_staff.business_id is null then
    raise exception 'No tienes permisos de comercio.' using errcode = '42501';
  end if;
  return v_staff;
end;
$$;

revoke all on function public._staff_for_token(text) from public, anon, authenticated;
revoke all on function public._require_staff(text) from public, anon, authenticated;
revoke all on function public._require_super(text) from public, anon, authenticated;
revoke all on function public._require_owner(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Autenticación
-- ---------------------------------------------------------------------------

create or replace function public.api_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_token text;
  v_business_slug text;
begin
  select * into v_staff
  from public.staff
  where username = lower(trim(coalesce(p_username, '')))
    and active
  limit 1;

  if v_staff.id is null then
    perform pg_sleep(0.25);
    raise exception 'Usuario o contraseña incorrectos.' using errcode = '28000';
  end if;

  if v_staff.locked_until is not null and v_staff.locked_until > now() then
    raise exception 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' using errcode = '28000';
  end if;

  if v_staff.password_hash <> extensions.crypt(coalesce(p_password, ''), v_staff.password_hash) then
    update public.staff
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
    where id = v_staff.id;
    perform pg_sleep(0.25);
    raise exception 'Usuario o contraseña incorrectos.' using errcode = '28000';
  end if;

  update public.staff
  set failed_attempts = 0, locked_until = null
  where id = v_staff.id;

  delete from public.sessions where expires_at <= now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.sessions (token_hash, staff_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_staff.id, now() + interval '30 days');

  select slug into v_business_slug from public.businesses where id = v_staff.business_id;

  return jsonb_build_object(
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_staff.id,
      'username', v_staff.username,
      'name', v_staff.name,
      'role', v_staff.role,
      'businessSlug', v_business_slug
    )
  );
end;
$$;

create or replace function public.api_logout(p_token text)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  delete from public.sessions
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Lectura inicial
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Analítica pública
-- ---------------------------------------------------------------------------

create or replace function public.api_track_visit(p_slug text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    update public.platform_stats set visits = visits + 1 where id = 1;
  else
    update public.businesses
    set visits = visits + 1
    where slug = p_slug and status = 'activo';
  end if;
end;
$$;

create or replace function public.api_track_whatsapp(p_slug text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.platform_stats set whatsapp_clicks = whatsapp_clicks + 1 where id = 1;
  update public.businesses
  set whatsapp_clicks = whatsapp_clicks + 1
  where slug = p_slug and status = 'activo';
end;
$$;

-- ---------------------------------------------------------------------------
-- Dueño de comercio
-- ---------------------------------------------------------------------------

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

create or replace function public.api_owner_rename_category(p_token text, p_from text, p_to text)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_count integer;
begin
  v_staff := public._require_owner(p_token);
  if char_length(trim(coalesce(p_to, ''))) < 2 or char_length(trim(p_to)) > 40 then
    raise exception 'La categoría debe tener entre 2 y 40 caracteres.' using errcode = '22023';
  end if;
  if trim(p_from) = trim(p_to) then return 0; end if;

  update public.products
  set category = trim(p_to)
  where business_id = v_staff.business_id and category = p_from;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.api_owner_create_product(
  p_token text,
  p_name text,
  p_category text,
  p_price integer,
  p_image text,
  p_stock jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_id uuid;
  v_kind text;
  v_qty integer;
  v_available boolean;
  v_order integer;
begin
  v_staff := public._require_owner(p_token);

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'El nombre del producto es demasiado corto.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_category, ''))) < 2 then
    raise exception 'Indica una categoría válida.' using errcode = '22023';
  end if;
  if p_price is null or p_price < 1 or p_price > 100000000 then
    raise exception 'El precio no es válido.' using errcode = '22023';
  end if;
  if coalesce(p_image, '') <> '' and p_image !~* '^https?://' then
    raise exception 'La URL de la imagen no es válida.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_stock) = 'boolean' then
    v_kind := 'bool';
    v_available := (p_stock #>> '{}')::boolean;
  elsif jsonb_typeof(p_stock) = 'number' then
    v_kind := 'qty';
    v_qty := floor((p_stock #>> '{}')::numeric)::integer;
    if v_qty < 0 or v_qty > 99999 then
      raise exception 'El stock debe estar entre 0 y 99.999 unidades.' using errcode = '22023';
    end if;
  else
    raise exception 'El stock enviado no es válido.' using errcode = '22023';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_order
  from public.products where business_id = v_staff.business_id;

  insert into public.products (
    business_id, name, category, price, image, stock_kind, stock_qty, stock_available, sort_order
  ) values (
    v_staff.business_id, trim(p_name), trim(p_category), p_price, coalesce(trim(p_image), ''),
    v_kind, v_qty, v_available, v_order
  ) returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.api_owner_update_product(
  p_token text,
  p_product_id uuid,
  p_name text,
  p_category text,
  p_price integer,
  p_image text,
  p_stock jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_kind text;
  v_qty integer;
  v_available boolean;
begin
  v_staff := public._require_owner(p_token);

  if not exists (
    select 1 from public.products
    where id = p_product_id and business_id = v_staff.business_id
  ) then
    raise exception 'Producto no encontrado.' using errcode = 'P0002';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'El nombre del producto es demasiado corto.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_category, ''))) < 2 then
    raise exception 'Indica una categoría válida.' using errcode = '22023';
  end if;
  if p_price is null or p_price < 1 or p_price > 100000000 then
    raise exception 'El precio no es válido.' using errcode = '22023';
  end if;
  if coalesce(p_image, '') <> '' and p_image !~* '^https?://' then
    raise exception 'La URL de la imagen no es válida.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_stock) = 'boolean' then
    v_kind := 'bool';
    v_available := (p_stock #>> '{}')::boolean;
  elsif jsonb_typeof(p_stock) = 'number' then
    v_kind := 'qty';
    v_qty := floor((p_stock #>> '{}')::numeric)::integer;
    if v_qty < 0 or v_qty > 99999 then
      raise exception 'El stock debe estar entre 0 y 99.999 unidades.' using errcode = '22023';
    end if;
  else
    raise exception 'El stock enviado no es válido.' using errcode = '22023';
  end if;

  update public.products
  set name = trim(p_name),
      category = trim(p_category),
      price = p_price,
      image = coalesce(trim(p_image), ''),
      stock_kind = v_kind,
      stock_qty = v_qty,
      stock_available = v_available
  where id = p_product_id and business_id = v_staff.business_id;

  return jsonb_build_object('id', p_product_id);
end;
$$;

create or replace function public.api_owner_delete_product(p_token text, p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_count integer;
begin
  v_staff := public._require_owner(p_token);
  delete from public.products where id = p_product_id and business_id = v_staff.business_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Producto no encontrado.' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create or replace function public.api_owner_move_product(p_token text, p_product_id uuid, p_direction text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_product public.products;
  v_other public.products;
  v_order integer;
begin
  v_staff := public._require_owner(p_token);
  if p_direction not in ('up', 'down') then
    raise exception 'Dirección inválida.' using errcode = '22023';
  end if;

  select * into v_product from public.products
  where id = p_product_id and business_id = v_staff.business_id;
  if v_product.id is null then
    raise exception 'Producto no encontrado.' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select * into v_other from public.products
    where business_id = v_staff.business_id and id <> v_product.id
      and (sort_order < v_product.sort_order or (sort_order = v_product.sort_order and created_at < v_product.created_at))
    order by sort_order desc, created_at desc limit 1;
  else
    select * into v_other from public.products
    where business_id = v_staff.business_id and id <> v_product.id
      and (sort_order > v_product.sort_order or (sort_order = v_product.sort_order and created_at > v_product.created_at))
    order by sort_order asc, created_at asc limit 1;
  end if;

  if v_other.id is null then return false; end if;

  v_order := v_product.sort_order;
  update public.products set sort_order = v_other.sort_order where id = v_product.id;
  update public.products set sort_order = v_order where id = v_other.id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Super administrador
-- ---------------------------------------------------------------------------

create or replace function public.api_super_set_status(p_token text, p_business_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._require_super(p_token);
  if p_status not in ('activo', 'oculto') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  update public.businesses set status = p_status where id = p_business_id;
  return found;
end;
$$;

create or replace function public.api_super_move_business(p_token text, p_business_id uuid, p_direction text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_business public.businesses;
  v_other public.businesses;
  v_order integer;
begin
  perform public._require_super(p_token);
  if p_direction not in ('up', 'down') then
    raise exception 'Dirección inválida.' using errcode = '22023';
  end if;

  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then return false; end if;

  if p_direction = 'up' then
    select * into v_other from public.businesses
    where id <> v_business.id
      and (sort_order < v_business.sort_order or (sort_order = v_business.sort_order and created_at < v_business.created_at))
    order by sort_order desc, created_at desc limit 1;
  else
    select * into v_other from public.businesses
    where id <> v_business.id
      and (sort_order > v_business.sort_order or (sort_order = v_business.sort_order and created_at > v_business.created_at))
    order by sort_order asc, created_at asc limit 1;
  end if;

  if v_other.id is null then return false; end if;

  v_order := v_business.sort_order;
  update public.businesses set sort_order = v_other.sort_order where id = v_business.id;
  update public.businesses set sort_order = v_order where id = v_other.id;
  return true;
end;
$$;

create or replace function public.api_super_create_business(
  p_token text,
  p_name text,
  p_slug text,
  p_whatsapp text,
  p_shipping_cost integer,
  p_logo text,
  p_status text,
  p_tagline text,
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_business public.businesses;
  v_order integer;
  v_username text := lower(trim(coalesce(p_username, '')));
begin
  perform public._require_super(p_token);

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'El nombre del comercio es demasiado corto.' using errcode = '22023';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) > 60 then
    raise exception 'El slug de la URL no es válido.' using errcode = '22023';
  end if;
  if coalesce(p_whatsapp, '') !~ '^[0-9]{8,15}$' then
    raise exception 'El WhatsApp debe tener entre 8 y 15 dígitos.' using errcode = '22023';
  end if;
  if coalesce(p_logo, '') <> '' and p_logo !~* '^https?://' then
    raise exception 'La URL del logo no es válida.' using errcode = '22023';
  end if;
  if p_status not in ('activo', 'oculto') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,23}$' then
    raise exception 'El usuario debe tener entre 3 y 24 caracteres válidos.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres.' using errcode = '22023';
  end if;
  if exists (select 1 from public.staff where username = v_username) then
    raise exception 'Ese usuario ya existe.' using errcode = '23505';
  end if;
  if exists (select 1 from public.businesses where slug = p_slug) then
    raise exception 'Ese slug ya está en uso.' using errcode = '23505';
  end if;

  select coalesce(min(sort_order), 0) - 1 into v_order from public.businesses;

  insert into public.businesses (
    slug, name, whatsapp, shipping_cost, logo, status, open, tagline, sort_order
  ) values (
    p_slug, trim(p_name), p_whatsapp, coalesce(p_shipping_cost, 0),
    coalesce(trim(p_logo), ''), p_status, true, coalesce(trim(p_tagline), ''), v_order
  ) returning * into v_business;

  insert into public.staff (username, password_hash, role, business_id, name)
  values (
    v_username,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    'owner',
    v_business.id,
    v_business.name
  );

  return jsonb_build_object(
    'id', v_business.id,
    'slug', v_business.slug,
    'name', v_business.name,
    'username', v_username
  );
end;
$$;

create or replace function public.api_super_update_business(
  p_token text,
  p_business_id uuid,
  p_name text,
  p_slug text,
  p_whatsapp text,
  p_shipping_cost integer,
  p_logo text,
  p_status text,
  p_tagline text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  perform public._require_super(p_token);

  if coalesce(p_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) > 60 then
    raise exception 'El slug de la URL no es válido.' using errcode = '22023';
  end if;
  if coalesce(p_whatsapp, '') !~ '^[0-9]{8,15}$' then
    raise exception 'El WhatsApp debe tener entre 8 y 15 dígitos.' using errcode = '22023';
  end if;
  if p_status not in ('activo', 'oculto') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.businesses where slug = p_slug and id <> p_business_id) then
    raise exception 'Ese slug ya está en uso.' using errcode = '23505';
  end if;

  update public.businesses
  set name = trim(p_name),
      slug = p_slug,
      whatsapp = p_whatsapp,
      shipping_cost = coalesce(p_shipping_cost, 0),
      logo = coalesce(trim(p_logo), ''),
      status = p_status,
      tagline = coalesce(trim(p_tagline), '')
  where id = p_business_id;

  get diagnostics v_count = row_count;
  if v_count > 0 then
    update public.staff set name = trim(p_name)
    where business_id = p_business_id and role = 'owner';
  end if;
  return v_count > 0;
end;
$$;

create or replace function public.api_super_update_access(
  p_token text,
  p_business_id uuid,
  p_username text,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_owner public.staff;
begin
  perform public._require_super(p_token);

  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,23}$' then
    raise exception 'El usuario debe tener entre 3 y 24 caracteres válidos.' using errcode = '22023';
  end if;
  if p_password is not null and p_password <> '' and char_length(p_password) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres.' using errcode = '22023';
  end if;

  select * into v_owner from public.staff
  where business_id = p_business_id and role = 'owner' limit 1;

  if v_owner.id is null then
    raise exception 'Este comercio no tiene una cuenta asignada.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.staff where username = v_username and id <> v_owner.id) then
    raise exception 'Ese usuario ya existe.' using errcode = '23505';
  end if;

  update public.staff
  set username = v_username,
      password_hash = case
        when p_password is null or p_password = '' then password_hash
        else extensions.crypt(p_password, extensions.gen_salt('bf', 10))
      end
  where id = v_owner.id;

  -- Al cambiar la contraseña se cierran las sesiones anteriores.
  if p_password is not null and p_password <> '' then
    delete from public.sessions where staff_id = v_owner.id;
  end if;

  return true;
end;
$$;

create or replace function public.api_super_delete_business(p_token text, p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  perform public._require_super(p_token);
  delete from public.businesses where id = p_business_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Comercio no encontrado.' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedidos públicos
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke all on function public.api_login(text, text) from public;
revoke all on function public.api_logout(text) from public;
revoke all on function public.api_snapshot(text) from public;
revoke all on function public.api_track_visit(text) from public;
revoke all on function public.api_track_whatsapp(text) from public;
revoke all on function public.api_owner_save_business(text, text, text, text, integer, jsonb, text, boolean, text) from public;
revoke all on function public.api_owner_rename_category(text, text, text) from public;
revoke all on function public.api_owner_create_product(text, text, text, integer, text, jsonb) from public;
revoke all on function public.api_owner_update_product(text, uuid, text, text, integer, text, jsonb) from public;
revoke all on function public.api_owner_delete_product(text, uuid) from public;
revoke all on function public.api_owner_move_product(text, uuid, text) from public;
revoke all on function public.api_super_set_status(text, uuid, text) from public;
revoke all on function public.api_super_move_business(text, uuid, text) from public;
revoke all on function public.api_super_create_business(text, text, text, text, integer, text, text, text, text, text) from public;
revoke all on function public.api_super_update_business(text, uuid, text, text, text, integer, text, text, text) from public;
revoke all on function public.api_super_update_access(text, uuid, text, text) from public;
revoke all on function public.api_super_delete_business(text, uuid) from public;
revoke all on function public.api_create_order(text, text, text, text, jsonb, uuid) from public;

grant execute on function public.api_login(text, text) to anon, authenticated;
grant execute on function public.api_logout(text) to anon, authenticated;
grant execute on function public.api_snapshot(text) to anon, authenticated;
grant execute on function public.api_track_visit(text) to anon, authenticated;
grant execute on function public.api_track_whatsapp(text) to anon, authenticated;
grant execute on function public.api_owner_save_business(text, text, text, text, integer, jsonb, text, boolean, text) to anon, authenticated;
grant execute on function public.api_owner_rename_category(text, text, text) to anon, authenticated;
grant execute on function public.api_owner_create_product(text, text, text, integer, text, jsonb) to anon, authenticated;
grant execute on function public.api_owner_update_product(text, uuid, text, text, integer, text, jsonb) to anon, authenticated;
grant execute on function public.api_owner_delete_product(text, uuid) to anon, authenticated;
grant execute on function public.api_owner_move_product(text, uuid, text) to anon, authenticated;
grant execute on function public.api_super_set_status(text, uuid, text) to anon, authenticated;
grant execute on function public.api_super_move_business(text, uuid, text) to anon, authenticated;
grant execute on function public.api_super_create_business(text, text, text, text, integer, text, text, text, text, text) to anon, authenticated;
grant execute on function public.api_super_update_business(text, uuid, text, text, text, integer, text, text, text) to anon, authenticated;
grant execute on function public.api_super_update_access(text, uuid, text, text) to anon, authenticated;
grant execute on function public.api_super_delete_business(text, uuid) to anon, authenticated;
grant execute on function public.api_create_order(text, text, text, text, jsonb, uuid) to anon, authenticated;

commit;
