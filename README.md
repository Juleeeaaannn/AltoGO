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

Ese archivo crea las tablas, índices, sesiones, pedidos, funciones RPC y permisos. No se debe ejecutar más de una vez sobre el mismo proyecto.

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


## 5. Funcionalidades

### Cliente
- Inicio con comercios visibles, abiertos/cerrados, envío y productos.
- Catálogo con búsqueda sin acentos, filtros por categoría y detalle de producto con imagen grande.
- Carrito por comercio, stock flexible y checkout con nombre, observaciones y forma de pago obligatoria.
- Pedido guardado en Supabase y apertura de WhatsApp con el detalle y recordatorio de ubicación.

### Dueño de comercio
- Modo edición sobre su catálogo.
- Mi tienda: nombre, biografía, logo, WhatsApp, envío y estado abierto/cerrado.
- Productos: crear, editar, eliminar, ordenar, imagen por URL y stock por cantidad o disponible/agotado.
- Categorías renombrables y visitas de su comercio.

### Super administrador
- Crear comercios con su cuenta de acceso.
- Visibilidad, apertura, orden, edición de accesos y eliminación.
- Analíticas globales y por comercio.

- Las imágenes se cargan por URL; no hay subida de archivos a Supabase Storage.
- No hay pasarela de pago: el cobro se coordina por WhatsApp (efectivo o transferencia).
- No hay recuperación automática de contraseñas; el super admin las actualiza desde el panel.
- Los pedidos se marcan como `whatsapp`; no hay tablero de estados para el comercio.
