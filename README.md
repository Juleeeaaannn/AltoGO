# AltoGO · catálogo multi-comercio

Catálogo de productos donde cada comercio administra su tienda y recibe pedidos por **WhatsApp**. Incluye panel de super administrador, cuentas por comercio, stock, pedidos persistidos y métricas.

**Stack de producción:** HTML + JavaScript vanilla, Vite, Tailwind CSS compilado, Supabase (PostgreSQL + RPC) y Vercel.

---

## 1. Requisitos

- Node.js 20 o superior.
- Una cuenta gratuita de [Supabase](https://supabase.com).
- Una cuenta de [Vercel](https://vercel.com) para publicar.

```bash
npm install
```

---

## 2. Configurar Supabase

### 2.1 Crear el proyecto

1. Creá un proyecto nuevo en Supabase.
2. Abrí **SQL Editor**.
3. Ejecutá completo el archivo:
   `supabase/migrations/20261104000000_production.sql`
4. Ejecutá también `supabase/migrations/20261106000000_delivery_modes.sql`.
5. Ejecutá `supabase/migrations/20261106010000_product_analytics.sql`.
6. Ejecutá `supabase/migrations/20261106020000_view_data.sql`.
7. Ejecutá `supabase/migrations/20261106030000_product_gallery_categories.sql`.

El primero crea las tablas, índices, sesiones, pedidos, funciones RPC y permisos. El segundo agrega los modos de delivery y las zonas. El tercero agrega el ranking de productos vendidos. El cuarto agrega la carga de datos por pantalla. El quinto agrega el orden propio de categorías y la galería de hasta 8 imágenes por producto.

Si tu proyecto ya existía antes de esta versión, ejecutá `20261106000000_delivery_modes.sql`, `20261106010000_product_analytics.sql`, `20261106020000_view_data.sql` y `20261106030000_product_gallery_categories.sql` en ese orden. No borran datos. Las dos últimas son obligatorias: sin ellas la aplicación no puede cargar todas las pantallas ni guardar imágenes. Si ya habías ejecutado la versión anterior de la última migración (la de enlaces), volvé a ejecutarla completa para reemplazar las funciones por las de galería.

### 2.2 Datos iniciales (opcional)

Para arrancar con comercios y productos de ejemplo:

1. Ejecutá `supabase/seed.sql` en el SQL Editor.
2. Ingresá con `admin` / `altogo2026`.
3. **Antes de abrir al público**, cambiá la contraseña del super admin:

```sql
update public.staff
set password_hash = extensions.crypt('TU_CLAVE_NUEVA', extensions.gen_salt('bf', 10))
where username = 'admin';
```

El seed también crea las cuentas de los comercios de ejemplo. Podés borrar esos comercios desde el panel o no ejecutar el seed y crear todo desde cero.

### 2.3 Variables de entorno

En **Project Settings → API** copiá:

- Project URL.
- Anon / publishable key (clave pública).

```bash
cp .env.example .env
```

Completá:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Estas dos variables son públicas y quedan incluidas en el frontend. **No agregues la `service_role`**: este proyecto no la necesita y nunca debe llegar al navegador.

### 2.4 Ejecutar en local

```bash
npm run dev
# http://127.0.0.1:5173
```

Si no hay `.env`, la app arranca en **modo demo local** con `localStorage`. Ese modo sirve para diseño, no para producción.

---

## 3. Publicar en Vercel

1. Subí el proyecto a GitHub.
2. Importalo en Vercel. El framework se detecta como **Vite** y `vercel.json` ya define build, salida, rewrites y cabeceras.
3. En **Settings → Environment Variables**, agregá para Production, Preview y Development:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Desplegá.

El comando de build es:

```bash
npm run build
```

La compilación **falla a propósito** si faltan las variables de Supabase, para no publicar una demo por error.

### Rutas

| Vista | URL |
|---|---|
| Inicio | `/` |
| Catálogo | `/negocio/almacen-la-esquina` |
| Acceso | `/ingreso` |
| Super admin | `/admin` |

El acceso no está enlazado desde el sitio público.
Los enlaces viejos con `#` o `?negocio=` se redirigen automáticamente a la URL limpia.

---

## 4. Delivery por comercio

Cada dueño elige una modalidad desde **Mi tienda**:

- **Precio fijo:** un único costo para todos los pedidos (0 = gratis).
- **Por zona:** el cliente elige su zona al confirmar y se suma el precio configurado.
- **Por WhatsApp:** el pedido se envía sin costo de envío y el comercio coordina el delivery en el chat.

El servidor vuelve a validar la zona y el precio al guardar el pedido. El pedido conserva el modo y la zona usados.

---

## 5. Analíticas de ventas

El **super admin** ve en su pestaña de analíticas el ranking global de productos, la columna “Más vendido” de cada comercio y los totales de unidades, ventas y pedidos.

Cada **dueño** ve en su modal de analíticas sus propios totales y el ranking de sus productos, además de sus visitas y su inventario. Los pedidos cancelados no se cuentan.

---

## 6. Carga de datos por pantalla

La aplicación no descarga todo el catálogo al entrar. Cada ruta pide solo lo que muestra mediante `api_view`:

- **Inicio:** comercios visibles y cantidad de productos, sin productos ni imágenes.
- **Catálogo:** un solo comercio y sus productos.
- **Panel:** comercios, cuentas y métricas, sin productos ni imágenes.
- **Sesión:** solo el usuario autenticado.

Al navegar se muestra una pantalla breve de carga. Si una respuesta falla, se muestra el error y un botón para reintentar. El panel de analíticas sigue usando su RPC separada.

---

## 7. Cómo funciona la seguridad

- **No hay acceso directo a las tablas.** `anon` y `authenticated` no tienen permisos sobre ellas; toda operación pasa por funciones RPC `SECURITY DEFINER`.
- **Contraseñas:** hash bcrypt con `pgcrypto`. Nunca se devuelven al cliente.
- **Sesiones:** token aleatorio de 32 bytes; en la base solo se guarda su hash SHA-256. Vence a los 30 días y se revoca al cerrar sesión o cambiar la contraseña.
- **Roles:** cada RPC verifica el token y el rol. Un dueño solo puede modificar su propio comercio y sus productos.
- **Pedidos:** se validan en el servidor el comercio abierto, los productos, precios y stock. El stock numérico se descuenta en una transacción y el pedido queda guardado antes de abrir WhatsApp.
- **Login:** límite de 5 intentos fallidos por cuenta, con bloqueo temporal de 15 minutos.
- **Frontend:** CSP, `X-Frame-Options`, `nosniff`, HSTS, política de referencia y permisos restringidos desde `vercel.json`. Tailwind y las fuentes se sirven desde el propio dominio; no se usa Tailwind CDN.
- **Validación doble:** el formulario valida para dar feedback y PostgreSQL vuelve a validar todos los datos.

La analítica es aproximada: las visitas y clics son eventos públicos y pueden inflarse. No se usan para facturación.

---

## 8. Funcionalidades

### Cliente
- Inicio con comercios visibles, abiertos/cerrados, envío y productos.
- Catálogo con búsqueda sin acentos, filtros por categoría y detalle de producto con carrusel manual de imágenes (sin reproducción automática).
- Carrito por comercio, stock flexible y checkout con nombre, observaciones y forma de pago obligatoria.
- Delivery fijo, por zona o coordinado por WhatsApp, según la configuración del comercio.
- Pedido guardado en Supabase y apertura de WhatsApp con el detalle y recordatorio de ubicación.

### Dueño de comercio
- Modo edición sobre su catálogo.
- Mi tienda: nombre, biografía, logo, WhatsApp, envío y estado abierto/cerrado.
- Delivery: precio fijo, zonas con precio, o costo coordinado por WhatsApp.
- Productos: crear, editar, eliminar, mover al principio, ordenar, hasta 8 imágenes por URL y stock por cantidad o disponible/agotado.
- Categorías renombrables y ordenables, y visitas de su comercio.
- Analíticas con unidades vendidas, ventas de productos, pedidos y ranking propio.

### Super administrador
- Crear comercios con su cuenta de acceso.
- Visibilidad, apertura, orden, edición de accesos y eliminación.
- Analíticas globales y por comercio.
- Ranking global de productos vendidos y producto más vendido por comercio.

---

## 9. Modelo de datos

```text
businesses   id, slug, name, whatsapp, shipping_mode ('fixed'|'zones'|'whatsapp'),
             shipping_cost, category_order, logo, status, open, tagline, visits,
             whatsapp_clicks, sort_order, created_at
shipping_zones  id, business_id, name, price, sort_order, created_at
products     id, business_id, name, category, price, image, images,
             stock_kind ('qty'|'bool'), stock_qty, stock_available, sort_order
staff        id, username, password_hash, role ('super'|'owner'),
             business_id, name, active, failed_attempts, locked_until
sessions     token_hash, staff_id, created_at, expires_at
orders       id, code, business_id, customer_name, notes, payment,
             subtotal, shipping, total, shipping_mode, shipping_zone,
             status, created_at
order_items  id, order_id, product_id, name, unit_price, qty
platform_stats  id=1, visits, whatsapp_clicks
```

La app carga solo los datos de la pantalla actual y refresca esa misma vista después de cada mutación. Los reads son síncronos en memoria; las escrituras son asíncronas y validadas por el servidor.

---

## 10. Estructura

```text
index.html
vite.config.js                 Build + inyección de configuración pública
tailwind.config.js             Tema visual
vercel.json                    Build, rewrites, caché y cabeceras
assets/css/app.css             Tailwind + estilos propios + fuentes locales
assets/js/backend.js           Cliente RPC de Supabase y token de sesión
assets/js/auth.js              Login/logout y restauración de sesión
assets/js/data.js              Snapshot, Store y mutaciones demo/remotas
assets/js/cart.js              Carrito, checkout y creación del pedido
assets/js/views-*.js           Vistas públicas y paneles
supabase/migrations/           Esquema y API RPC de producción
supabase/migrations/20261106000000_delivery_modes.sql  Upgrade de delivery
supabase/migrations/20261106010000_product_analytics.sql  Ranking de ventas
supabase/migrations/20261106020000_view_data.sql  Carga por pantalla
supabase/seed.sql              Datos demo opcionales
```

---

## 11. Límites actuales

- Las imágenes se cargan por URL; no hay subida de archivos a Supabase Storage.
- No hay pasarela de pago: el cobro se coordina por WhatsApp (efectivo o transferencia).
- No hay recuperación automática de contraseñas; el super admin las actualiza desde el panel.
- Los pedidos se marcan como `whatsapp`; no hay tablero de estados para el comercio.