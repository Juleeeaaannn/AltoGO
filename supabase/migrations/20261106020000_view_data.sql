-- ---------------------------------------------------------------------------
-- AltoGO · Carga de datos por pantalla
-- ---------------------------------------------------------------------------
-- api_view devuelve solamente lo que necesita la vista actual:
--   session   → usuario autenticado (sin catálogo)
--   home      → comercios visibles + cantidad de productos (sin productos)
--   business  → un comercio + sus productos
--   admin     → comercios, cuentas y métricas (sin productos ni imágenes)
--
-- El catálogo completo (api_snapshot) se conserva por compatibilidad, pero la
-- aplicación deja de usarlo al navegar.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.api_view(
  p_token text default null,
  p_view text default 'home',
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff public.staff;
  v_is_super boolean := false;
  v_owner_business uuid;
  v_view text := lower(trim(coalesce(p_view, 'home')));
  v_businesses jsonb := '[]'::jsonb;
  v_products jsonb := '[]'::jsonb;
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

  if v_view not in ('session', 'home', 'business', 'admin') then
    raise exception 'Vista no válida.' using errcode = '22023';
  end if;

  if v_view = 'admin' and not v_is_super then
    raise exception 'No tienes permisos de super administrador.' using errcode = '42501';
  end if;

  if v_view = 'home' then
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
      'productCount', (
        select count(*)::integer
        from public.products p
        where p.business_id = b.id
      ),
      'createdAt', to_char(b.created_at, 'YYYY-MM-DD')
    ) order by b.sort_order, b.created_at), '[]'::jsonb)
    into v_businesses
    from public.businesses b
    where b.status = 'activo';
  end if;

  if v_view = 'business' then
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
      'productCount', (
        select count(*)::integer
        from public.products p
        where p.business_id = b.id
      ),
      'createdAt', to_char(b.created_at, 'YYYY-MM-DD')
    ) order by b.sort_order, b.created_at), '[]'::jsonb)
    into v_businesses
    from public.businesses b
    where b.slug = nullif(trim(p_slug), '')
      and (
        b.status = 'activo'
        or v_is_super
        or b.id = v_owner_business
      );

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
    where b.slug = nullif(trim(p_slug), '')
      and (
        b.status = 'activo'
        or v_is_super
        or b.id = v_owner_business
      );
  end if;

  if v_view = 'admin' then
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
      'productCount', (
        select count(*)::integer
        from public.products p
        where p.business_id = b.id
      ),
      'createdAt', to_char(b.created_at, 'YYYY-MM-DD')
    ) order by b.sort_order, b.created_at), '[]'::jsonb)
    into v_businesses
    from public.businesses b;

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
    'view', v_view,
    'businesses', v_businesses,
    'products', v_products,
    'users', v_users,
    'global', coalesce(v_global, jsonb_build_object('visits', 0, 'whatsappClicks', 0)),
    'user', v_user
  );
end;
$$;

revoke all on function public.api_view(text, text, text) from public;
grant execute on function public.api_view(text, text, text) to anon, authenticated;

commit;
