-- ============================================================================
-- AltoGO · Datos iniciales de demostración (OPCIONAL)
-- ----------------------------------------------------------------------------
-- Ejecutar DESPUÉS de la migración. Antes de abrir al público:
--   1. Cambia la contraseña del super admin.
--   2. Elimina o reemplaza los comercios y productos de ejemplo.
--
-- Cambiar una contraseña:
--   update public.staff
--   set password_hash = extensions.crypt('NUEVA_CLAVE_SEGURA', extensions.gen_salt('bf', 10))
--   where username = 'admin';
-- ============================================================================

insert into public.platform_stats (id, visits, whatsapp_clicks)
values (1, 1864, 214)
on conflict (id) do update
set visits = excluded.visits, whatsapp_clicks = excluded.whatsapp_clicks;

insert into public.businesses (id, slug, name, whatsapp, shipping_cost, logo, status, open, tagline, visits, whatsapp_clicks, sort_order, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'almacen-la-esquina', 'Almacén La Esquina', '5491123456789', 25, '', 'activo', true, 'Despensa, limpieza y productos para tu día.', 482, 76, 0, now() - interval '20 days'),
  ('22222222-2222-4222-8222-222222222222', 'don-pedro', 'Don Pedro', '5491134567890', 35, '', 'activo', true, 'Productos frescos y básicos para tu casa.', 318, 54, 1, now() - interval '18 days'),
  ('33333333-3333-4333-8333-333333333333', 'casa-verde', 'Casa Verde', '5491145678901', 40, '', 'activo', true, 'Naturales, cuidado personal y hogar.', 205, 31, 2, now() - interval '16 days'),
  ('44444444-4444-4444-8444-444444444444', 'el-roble', 'El Roble', '5491156789012', 20, '', 'oculto', true, 'Accesorios y artículos para el hogar.', 64, 9, 3, now() - interval '14 days'),
  ('55555555-5555-4555-8555-555555555555', 'deposito-central', 'Depósito Central', '5491167890123', 30, '', 'activo', false, 'Mayoreo de productos para eventos y negocios.', 97, 14, 4, now() - interval '12 days')
on conflict (slug) do nothing;

insert into public.staff (id, username, password_hash, role, business_id, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin', extensions.crypt('altogo2026', extensions.gen_salt('bf', 10)), 'super', null, 'Super Administrador'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'esquina', extensions.crypt('esquina123', extensions.gen_salt('bf', 10)), 'owner', '11111111-1111-4111-8111-111111111111', 'Almacén La Esquina'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'donpedro', extensions.crypt('donpedro123', extensions.gen_salt('bf', 10)), 'owner', '22222222-2222-4222-8222-222222222222', 'Don Pedro'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'casa', extensions.crypt('casa123', extensions.gen_salt('bf', 10)), 'owner', '33333333-3333-4333-8333-333333333333', 'Casa Verde'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'roble', extensions.crypt('roble123', extensions.gen_salt('bf', 10)), 'owner', '44444444-4444-4444-8444-444444444444', 'El Roble'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'deposito', extensions.crypt('deposito123', extensions.gen_salt('bf', 10)), 'owner', '55555555-5555-4555-8555-555555555555', 'Depósito Central')
on conflict (username) do nothing;

insert into public.products (id, business_id, name, category, price, image, stock_kind, stock_qty, stock_available, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Arroz largo fino 1 kg', 'Almacén', 1450, '', 'qty', 24, null, 1),
  ('10000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Fideos spaghetti 500 g', 'Almacén', 950, '', 'qty', 18, null, 2),
  ('10000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Aceite de girasol 900 ml', 'Almacén', 2200, '', 'qty', 2, null, 3),
  ('10000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Azúcar 1 kg', 'Almacén', 1300, '', 'qty', 6, null, 4),
  ('10000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Yerba mate 1 kg', 'Almacén', 3800, '', 'bool', null, true, 5),
  ('10000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Café molido 500 g', 'Almacén', 4200, '', 'qty', 0, null, 6),
  ('10000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Agua mineral 500 ml', 'Bebidas', 900, '', 'bool', null, true, 7),
  ('10000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Detergente 500 ml', 'Limpieza', 1800, '', 'qty', 3, null, 8),
  ('20000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Pan lactal 500 g', 'Almacén', 1800, '', 'qty', 6, null, 1),
  ('20000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Leche entera 1 L', 'Lácteos', 1200, '', 'bool', null, true, 2),
  ('20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Queso cremoso 500 g', 'Lácteos', 4500, '', 'qty', 4, null, 3),
  ('20000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'Huevos 6 unidades', 'Almacén', 1600, '', 'qty', 10, null, 4),
  ('20000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'Jugo de naranja 1 L', 'Bebidas', 1900, '', 'bool', null, true, 5),
  ('20000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'Papas fritas 150 g', 'Snacks', 1500, '', 'qty', 5, null, 6),
  ('30000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'Jabón líquido 500 ml', 'Limpieza', 2100, '', 'qty', 9, null, 1),
  ('30000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'Shampoo 400 ml', 'Cuidado personal', 3800, '', 'bool', null, true, 2),
  ('30000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'Desodorante 150 ml', 'Cuidado personal', 2900, '', 'qty', 3, null, 3),
  ('30000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333', 'Toallas de papel 2 unidades', 'Hogar', 1700, '', 'qty', 0, null, 4),
  ('30000000-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333333', 'Velas aromáticas', 'Hogar', 2500, '', 'qty', 6, null, 5),
  ('30000000-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333333', 'Mix de frutos secos 200 g', 'Snacks', 3200, '', 'bool', null, true, 6),
  ('40000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'Set de organizadores', 'Hogar', 5400, '', 'qty', 7, null, 1),
  ('40000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'Mochila urbana', 'Accesorios', 9800, '', 'bool', null, false, 2),
  ('40000000-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', 'Lámpara LED', 'Accesorios', 6500, '', 'qty', 12, null, 3),
  ('40000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'Botella térmica 1 L', 'Accesorios', 7200, '', 'bool', null, true, 4),
  ('50000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'Caja de vasos 12 unidades', 'Hogar', 4800, '', 'qty', 30, null, 1),
  ('50000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'Bolsas de papel 50 unidades', 'Otros', 3500, '', 'qty', 0, null, 2),
  ('50000000-0000-4000-8000-000000000003', '55555555-5555-4555-8555-555555555555', 'Servilletas 100 unidades', 'Otros', 1800, '', 'bool', null, true, 3),
  ('50000000-0000-4000-8000-000000000004', '55555555-5555-4555-8555-555555555555', 'Cubiertos descartables 24 unidades', 'Otros', 2600, '', 'qty', 8, null, 4)
on conflict (id) do nothing;
