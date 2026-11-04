/* ==========================================================================
   AltoGO · Capa de datos
   --------------------------------------------------------------------------
   Con Supabase configurado, la app carga una foto de la base y las mutaciones
   pasan por RPC seguras. Sin configuración (desarrollo), usa localStorage con
   datos de demostración y la MISMA forma para no tocar las vistas.

   Reglas de negocio importantes:
   - status: 'activo' | 'oculto'
       activo → visible en el inicio (el dueño decide si está abierto o cerrado)
       oculto → NO se lista en el inicio; solo accesible por enlace directo
   - open: true | false  → el dueño abre o cierra el comercio para pedidos.
   - stock flexible: número exacto o booleano (true = disponible sin conteo).
   ========================================================================== */

const DB_KEY = ALTOGO.storage.key('db');
const SESSION_KEY = ALTOGO.storage.key('session');

/* --------------------------------------------------------------------------
   Semilla de demostración (se copia a localStorage la primera vez)
   -------------------------------------------------------------------------- */
const SEED_DATA = {
  version: 1,
  createdAt: '2026-01-20',

  // Analíticas globales de la plataforma AltoGO
  global: {
    visits: 1864,
    whatsappClicks: 214
  },

  users: [
    { id: 'usr_super', username: 'admin', password: 'altogo2026', role: 'super', name: 'Super Administrador', businessSlug: null },
    { id: 'usr_esquina', username: 'esquina', password: 'esquina123', role: 'owner', name: 'Almacén La Esquina', businessSlug: 'almacen-la-esquina' },
    { id: 'usr_donpedro', username: 'donpedro', password: 'donpedro123', role: 'owner', name: 'Don Pedro', businessSlug: 'don-pedro' },
    { id: 'usr_casa', username: 'casa', password: 'casa123', role: 'owner', name: 'Casa Verde', businessSlug: 'casa-verde' },
    { id: 'usr_roble', username: 'roble', password: 'roble123', role: 'owner', name: 'El Roble', businessSlug: 'el-roble' },
    { id: 'usr_deposito', username: 'deposito', password: 'deposito123', role: 'owner', name: 'Depósito Central', businessSlug: 'deposito-central' }
  ],

  businesses: [
    {
      id: 'biz_esquina', slug: 'almacen-la-esquina', name: 'Almacén La Esquina',
      whatsapp: '5215512345678', shippingCost: 25, logo: '', status: 'activo', open: true,
      tagline: 'Despensa, limpieza y productos para tu día.',
      visits: 482, whatsappClicks: 76, createdAt: '2026-02-04'
    },
    {
      id: 'biz_donpedro', slug: 'don-pedro', name: 'Don Pedro',
      whatsapp: '5215587654321', shippingCost: 35, logo: '', status: 'activo', open: true,
      tagline: 'Productos frescos y básicos para tu casa.',
      visits: 318, whatsappClicks: 54, createdAt: '2026-02-11'
    },
    {
      id: 'biz_vinos', slug: 'casa-verde', name: 'Casa Verde',
      whatsapp: '5215599887766', shippingCost: 40, logo: '', status: 'activo', open: true,
      tagline: 'Naturales, cuidado personal y hogar.',
      visits: 205, whatsappClicks: 31, createdAt: '2026-02-19'
    },
    {
      id: 'biz_roble', slug: 'el-roble', name: 'El Roble',
      whatsapp: '5215511223344', shippingCost: 20, logo: '', status: 'oculto', open: true,
      tagline: 'Accesorios y artículos para el hogar.',
      visits: 64, whatsappClicks: 9, createdAt: '2026-03-02'
    },
    {
      id: 'biz_deposito', slug: 'deposito-central', name: 'Depósito Central',
      whatsapp: '5215533445566', shippingCost: 30, logo: '', status: 'activo', open: false,
      tagline: 'Mayoreo de productos para eventos y negocios.',
      visits: 97, whatsappClicks: 14, createdAt: '2026-03-08'
    }
  ],

  products: [
    /* --- Almacén La Esquina --- */
    { id: 'p_esq_1', businessSlug: 'almacen-la-esquina', name: 'Arroz largo fino 1 kg', category: 'Almacén', price: 1450, image: '', stock: 24 },
    { id: 'p_esq_2', businessSlug: 'almacen-la-esquina', name: 'Fideos spaghetti 500 g', category: 'Almacén', price: 950, image: '', stock: 18 },
    { id: 'p_esq_3', businessSlug: 'almacen-la-esquina', name: 'Aceite de girasol 900 ml', category: 'Almacén', price: 2200, image: '', stock: 2 },
    { id: 'p_esq_4', businessSlug: 'almacen-la-esquina', name: 'Azúcar 1 kg', category: 'Almacén', price: 1300, image: '', stock: 6 },
    { id: 'p_esq_5', businessSlug: 'almacen-la-esquina', name: 'Yerba mate 1 kg', category: 'Almacén', price: 3800, image: '', stock: true },
    { id: 'p_esq_6', businessSlug: 'almacen-la-esquina', name: 'Café molido 500 g', category: 'Almacén', price: 4200, image: '', stock: 0 },
    { id: 'p_esq_7', businessSlug: 'almacen-la-esquina', name: 'Agua mineral 500 ml', category: 'Bebidas', price: 900, image: '', stock: true },
    { id: 'p_esq_8', businessSlug: 'almacen-la-esquina', name: 'Detergente 500 ml', category: 'Limpieza', price: 1800, image: '', stock: 3 },

    /* --- Don Pedro --- */
    { id: 'p_dp_1', businessSlug: 'don-pedro', name: 'Pan lactal 500 g', category: 'Almacén', price: 1800, image: '', stock: 6 },
    { id: 'p_dp_2', businessSlug: 'don-pedro', name: 'Leche entera 1 L', category: 'Lácteos', price: 1200, image: '', stock: true },
    { id: 'p_dp_3', businessSlug: 'don-pedro', name: 'Queso cremoso 500 g', category: 'Lácteos', price: 4500, image: '', stock: 4 },
    { id: 'p_dp_4', businessSlug: 'don-pedro', name: 'Huevos 6 unidades', category: 'Almacén', price: 1600, image: '', stock: 10 },
    { id: 'p_dp_5', businessSlug: 'don-pedro', name: 'Jugo de naranja 1 L', category: 'Bebidas', price: 1900, image: '', stock: true },
    { id: 'p_dp_6', businessSlug: 'don-pedro', name: 'Papas fritas 150 g', category: 'Snacks', price: 1500, image: '', stock: 5 },

    /* --- Casa Verde --- */
    { id: 'p_cas_1', businessSlug: 'casa-verde', name: 'Jabón líquido 500 ml', category: 'Limpieza', price: 2100, image: '', stock: 9 },
    { id: 'p_cas_2', businessSlug: 'casa-verde', name: 'Shampoo 400 ml', category: 'Cuidado personal', price: 3800, image: '', stock: true },
    { id: 'p_cas_3', businessSlug: 'casa-verde', name: 'Desodorante 150 ml', category: 'Cuidado personal', price: 2900, image: '', stock: 3 },
    { id: 'p_cas_4', businessSlug: 'casa-verde', name: 'Toallas de papel 2 unidades', category: 'Hogar', price: 1700, image: '', stock: 0 },
    { id: 'p_cas_5', businessSlug: 'casa-verde', name: 'Velas aromáticas', category: 'Hogar', price: 2500, image: '', stock: 6 },
    { id: 'p_cas_6', businessSlug: 'casa-verde', name: 'Mix de frutos secos 200 g', category: 'Snacks', price: 3200, image: '', stock: true },

    /* --- El Roble (oculta) --- */
    { id: 'p_rob_1', businessSlug: 'el-roble', name: 'Set de organizadores', category: 'Hogar', price: 5400, image: '', stock: 7 },
    { id: 'p_rob_2', businessSlug: 'el-roble', name: 'Mochila urbana', category: 'Accesorios', price: 9800, image: '', stock: false },
    { id: 'p_rob_3', businessSlug: 'el-roble', name: 'Lámpara LED', category: 'Accesorios', price: 6500, image: '', stock: 12 },
    { id: 'p_rob_4', businessSlug: 'el-roble', name: 'Botella térmica 1 L', category: 'Accesorios', price: 7200, image: '', stock: true },

    /* --- Depósito Central (cerrado) --- */
    { id: 'p_dep_1', businessSlug: 'deposito-central', name: 'Caja de vasos 12 unidades', category: 'Hogar', price: 4800, image: '', stock: 30 },
    { id: 'p_dep_2', businessSlug: 'deposito-central', name: 'Bolsas de papel 50 unidades', category: 'Otros', price: 3500, image: '', stock: 0 },
    { id: 'p_dep_3', businessSlug: 'deposito-central', name: 'Servilletas 100 unidades', category: 'Otros', price: 1800, image: '', stock: true },
    { id: 'p_dep_4', businessSlug: 'deposito-central', name: 'Cubiertos descartables 24 unidades', category: 'Otros', price: 2600, image: '', stock: 8 }
  ]
};

/* --------------------------------------------------------------------------
   Store: pequeña capa de persistencia + operaciones de negocio
   -------------------------------------------------------------------------- */
const Store = (() => {
  let db = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const load = () => {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.businesses) && Array.isArray(parsed.products)) {
          // Asegura que existan todas las ramas esperadas (por si editas el JSON a mano).
          parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
          parsed.global = parsed.global || { visits: 0, whatsappClicks: 0 };
          // Migración: antes "inactivo" significaba cerrado. Ahora la apertura
          // es independiente de la visibilidad y la controla cada comercio.
          parsed.businesses.forEach((business) => {
            const wasInactive = business.status === 'inactivo';
            if (business.status === 'inactivo') business.status = 'activo';
            if (business.status !== 'oculto') business.status = 'activo';
            if (typeof business.open !== 'boolean') business.open = !wasInactive;
          });
          return parsed;
        }
      }
    } catch (error) {
      console.warn('[AltoGO] No se pudo leer localStorage, se usan datos de demostración.', error);
    }
    return clone(SEED_DATA);
  };

  const persist = () => {
    if (Backend.enabled) return;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (error) {
      console.warn('[AltoGO] No se pudo guardar en localStorage.', error);
    }
  };

  db = load();

  /* ---------- Supabase ---------- */

  const applySnapshot = (snapshot) => {
    const data = snapshot || {};
    db.businesses = Array.isArray(data.businesses) ? data.businesses : [];
    db.products = Array.isArray(data.products) ? data.products : [];
    db.users = Array.isArray(data.users) ? data.users : [];
    db.global = data.global || { visits: 0, whatsappClicks: 0 };
    return data;
  };

  const refresh = async () => {
    if (!Backend.enabled) return null;
    const snapshot = await Backend.snapshot();
    applySnapshot(snapshot);
    return snapshot;
  };

  /* ---------- Lectura ---------- */

  const businesses = () => db.businesses;

  // Negocios listados en el inicio (todo menos los ocultos).
  const listedBusinesses = () =>
    db.businesses.filter((business) => business.status !== 'oculto');

  const business = (slug) =>
    db.businesses.find((item) => item.slug === slug) || null;

  const products = (slug) =>
    db.products.filter((product) => product.businessSlug === slug);

  const product = (id) => db.products.find((item) => item.id === id) || null;

  const productCount = () => db.products.length;

  /* ---------- Stock flexible ---------- */

  /**
   * Interpreta el stock de un producto:
   * - true  → disponible sin conteo (infinito)
   * - false → agotado
   * - n     → n unidades exactas (0 = agotado)
   */
  const stock = (item) => {
    if (item.stock === true) {
      return { available: true, exact: false, qty: Infinity, label: 'Disponible' };
    }
    if (item.stock === false || item.stock === null || item.stock === undefined) {
      return { available: false, exact: false, qty: 0, label: 'Agotado' };
    }
    const qty = Math.max(0, Math.floor(Number(item.stock) || 0));
    if (qty <= 0) return { available: false, exact: true, qty: 0, label: 'Agotado' };
    return {
      available: true,
      exact: true,
      qty,
      label: qty === 1 ? 'Última unidad' : qty <= 3 ? `Últimas ${qty}` : `${qty} disponibles`
    };
  };

  /* ---------- Analíticas ---------- */

  // Visitas al inicio (sin slug) o al catálogo de un negocio.
  const trackVisit = (slug = null) => {
    if (Backend.enabled) {
      Backend.trackVisit(slug).catch((error) => console.warn('[AltoGO] Visita no registrada.', error));
      return;
    }
    if (!slug) {
      db.global.visits += 1;
    } else {
      const item = business(slug);
      if (!item) return;
      item.visits = Number(item.visits || 0) + 1;
    }
    persist();
  };

  // Clics en el botón de WhatsApp = pedidos enviados.
  const trackWhatsappClick = (slug) => {
    if (Backend.enabled) {
      Backend.trackWhatsapp(slug).catch((error) => console.warn('[AltoGO] Clic no registrado.', error));
      return;
    }
    db.global.whatsappClicks = Number(db.global.whatsappClicks || 0) + 1;
    const item = business(slug);
    if (item) item.whatsappClicks = Number(item.whatsappClicks || 0) + 1;
    persist();
  };

  /* ---------- Usuarios / sesión ---------- */

  const findUser = (username, password) => {
    const user = String(username || '').trim().toLowerCase();
    return db.users.find(
      (candidate) =>
        candidate.username.toLowerCase() === user && candidate.password === password
    ) || null;
  };

  const userForBusiness = (slug) =>
    db.users.find((user) => user.role === 'owner' && user.businessSlug === slug) || null;

  const usernameTaken = (username, exceptUserId = null) => {
    const normalized = String(username || '').trim().toLowerCase();
    return db.users.some(
      (user) => user.id !== exceptUserId && user.username.toLowerCase() === normalized
    );
  };

  const saveBusinessUser = ({ businessSlug, businessName, username, password, userId }) => {
    const existing = userId
      ? db.users.find((user) => user.id === userId)
      : userForBusiness(businessSlug);

    if (existing) {
      existing.username = username;
      existing.password = password;
      existing.name = businessName;
      existing.businessSlug = businessSlug;
      return existing;
    }

    const created = {
      id: Utils.uid('usr'),
      username,
      password,
      role: 'owner',
      name: businessName,
      businessSlug
    };
    db.users.push(created);
    return created;
  };

  /* ---------- Negocios (super admin) ---------- */

  const createBusiness = async (data) => {
    if (Backend.enabled) {
      await Backend.rpc('api_super_create_business', {
        p_name: data.name,
        p_slug: data.slug,
        p_whatsapp: data.whatsapp || '',
        p_shipping_cost: Number(data.shippingCost) || 0,
        p_logo: data.logo || '',
        p_status: data.status || 'activo',
        p_tagline: data.tagline || '',
        p_username: data.username,
        p_password: data.password
      });
      await refresh();
      return business(data.slug);
    }
    const created = {
      id: Utils.uid('biz'),
      slug: data.slug,
      name: data.name,
      whatsapp: data.whatsapp || '',
      shippingCost: Number(data.shippingCost) || 0,
      logo: data.logo || '',
      status: data.status || 'activo',
      open: true,
      tagline: data.tagline || '',
      visits: 0,
      whatsappClicks: 0,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    db.businesses.unshift(created);
    saveBusinessUser({
      businessSlug: created.slug,
      businessName: created.name,
      username: data.username,
      password: data.password
    });
    persist();
    return created;
  };

  const updateBusiness = async (id, data) => {
    if (Backend.enabled) {
      await Backend.rpc('api_super_update_business', {
        p_business_id: id,
        p_name: data.name,
        p_slug: data.slug,
        p_whatsapp: data.whatsapp,
        p_shipping_cost: Number(data.shippingCost) || 0,
        p_logo: data.logo || '',
        p_status: data.status,
        p_tagline: data.tagline || ''
      });
      await refresh();
      return db.businesses.find((item) => item.id === id) || null;
    }
    const target = db.businesses.find((item) => item.id === id);
    if (!target) return null;

    const previousSlug = target.slug;
    Object.assign(target, {
      name: data.name,
      slug: data.slug,
      whatsapp: data.whatsapp,
      shippingCost: Number(data.shippingCost) || 0,
      logo: data.logo || '',
      status: data.status,
      tagline: data.tagline || ''
    });

    // Si cambia el slug, los productos deben seguir a su negocio.
    if (previousSlug !== target.slug) {
      db.products.forEach((productItem) => {
        if (productItem.businessSlug === previousSlug) productItem.businessSlug = target.slug;
      });
    }

    saveBusinessUser({
      businessSlug: target.slug,
      businessName: target.name,
      username: data.username,
      password: data.password,
      userId: data.userId
    });
    persist();
    return target;
  };

  // Oculta / activa un comercio sin tocar el resto de sus datos.
  const setBusinessStatus = async (id, status) => {
    if (Backend.enabled) {
      await Backend.rpc('api_super_set_status', { p_business_id: id, p_status: status });
      await refresh();
      return db.businesses.find((item) => item.id === id) || null;
    }
    const target = db.businesses.find((item) => item.id === id);
    if (!target) return null;
    target.status = status;
    persist();
    return target;
  };

  // Perfil comercial editable por el dueño (no toca slug ni visibilidad).
  const updateBusinessProfile = async (slug, data) => {
    if (Backend.enabled) {
      await Backend.rpc('api_owner_save_business', {
        p_name: data.name,
        p_whatsapp: data.whatsapp,
        p_shipping_cost: Math.max(0, Number(data.shippingCost) || 0),
        p_logo: data.logo || '',
        p_open: Boolean(data.open),
        p_tagline: data.tagline || ''
      });
      await refresh();
      return business(slug);
    }
    const target = business(slug);
    if (!target) return null;
    target.name = data.name;
    target.tagline = data.tagline || '';
    target.whatsapp = data.whatsapp;
    target.shippingCost = Math.max(0, Number(data.shippingCost) || 0);
    target.logo = data.logo || '';
    if (typeof data.open === 'boolean') target.open = data.open;
    const owner = userForBusiness(slug);
    if (owner) owner.name = data.name;
    persist();
    return target;
  };

  // Renombra una categoría en todos los productos de un comercio.
  const renameCategory = async (slug, from, to) => {
    if (Backend.enabled) {
      const changed = await Backend.rpc('api_owner_rename_category', { p_from: from, p_to: to });
      await refresh();
      return Number(changed) || 0;
    }
    let changed = 0;
    db.products.forEach((productItem) => {
      if (productItem.businessSlug === slug && productItem.category === from) {
        productItem.category = to;
        changed += 1;
      }
    });
    if (changed) persist();
    return changed;
  };

  // Credenciales de acceso de un comercio (solo super admin).
  const updateAccess = async (businessSlug, data) => {
    if (Backend.enabled) {
      const target = business(businessSlug);
      if (!target) return null;
      await Backend.rpc('api_super_update_access', {
        p_business_id: target.id,
        p_username: data.username,
        p_password: data.password || ''
      });
      await refresh();
      return userForBusiness(businessSlug);
    }
    const owner = userForBusiness(businessSlug);
    if (!owner) return null;
    owner.username = data.username;
    owner.password = data.password;
    persist();
    return owner;
  };

  // Orden manual de comercios (afecta inicio y panel).
  const moveBusiness = async (id, direction) => {
    if (Backend.enabled) {
      await Backend.rpc('api_super_move_business', { p_business_id: id, p_direction: direction });
      await refresh();
      return true;
    }
    const index = db.businesses.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= db.businesses.length) return false;
    [db.businesses[index], db.businesses[target]] = [db.businesses[target], db.businesses[index]];
    persist();
    return true;
  };

  const deleteBusiness = async (id) => {
    if (Backend.enabled) {
      await Backend.rpc('api_super_delete_business', { p_business_id: id });
      await refresh();
      return true;
    }
    const target = db.businesses.find((item) => item.id === id);
    if (!target) return false;
    db.businesses = db.businesses.filter((item) => item.id !== id);
    db.products = db.products.filter((item) => item.businessSlug !== target.slug);
    db.users = db.users.filter(
      (user) => !(user.role === 'owner' && user.businessSlug === target.slug)
    );
    persist();
    return true;
  };

  /* ---------- Productos (dueño de tienda) ---------- */

  const createProduct = async (data) => {
    if (Backend.enabled) {
      const created = await Backend.rpc('api_owner_create_product', {
        p_name: data.name,
        p_category: data.category,
        p_price: Number(data.price) || 0,
        p_image: data.image || '',
        p_stock: data.stock
      });
      await refresh();
      return created;
    }
    const created = {
      id: Utils.uid('prod'),
      businessSlug: data.businessSlug,
      name: data.name,
      category: data.category,
      price: Number(data.price) || 0,
      image: data.image || '',
      stock: data.stock
    };
    db.products.push(created);
    persist();
    return created;
  };

  const updateProduct = async (id, data) => {
    if (Backend.enabled) {
      const updated = await Backend.rpc('api_owner_update_product', {
        p_product_id: id,
        p_name: data.name,
        p_category: data.category,
        p_price: Number(data.price) || 0,
        p_image: data.image || '',
        p_stock: data.stock
      });
      await refresh();
      return updated;
    }
    const target = db.products.find((item) => item.id === id);
    if (!target) return null;
    Object.assign(target, {
      name: data.name,
      category: data.category,
      price: Number(data.price) || 0,
      image: data.image || '',
      stock: data.stock
    });
    persist();
    return target;
  };

  const deleteProduct = async (id) => {
    if (Backend.enabled) {
      await Backend.rpc('api_owner_delete_product', { p_product_id: id });
      await refresh();
      return true;
    }
    const before = db.products.length;
    db.products = db.products.filter((item) => item.id !== id);
    persist();
    return db.products.length !== before;
  };

  // Orden manual de productos dentro de un comercio (vista "Todas").
  const moveProduct = async (id, direction) => {
    if (Backend.enabled) {
      await Backend.rpc('api_owner_move_product', { p_product_id: id, p_direction: direction });
      await refresh();
      return true;
    }
    const product = db.products.find((item) => item.id === id);
    if (!product) return false;

    const siblings = db.products.filter((item) => item.businessSlug === product.businessSlug);
    const position = siblings.findIndex((item) => item.id === id);
    const targetProduct = siblings[position + (direction === 'up' ? -1 : 1)];
    if (!targetProduct) return false;

    const index = db.products.findIndex((item) => item.id === id);
    const targetIndex = db.products.findIndex((item) => item.id === targetProduct.id);
    [db.products[index], db.products[targetIndex]] = [db.products[targetIndex], db.products[index]];
    persist();
    return true;
  };

  /* ---------- Utilidades de panel ---------- */

  const slugTaken = (slug, exceptId = null) =>
    db.businesses.some((item) => item.slug === slug && item.id !== exceptId);

  const stats = () => {
    const cats = new Set(db.products.map((productItem) => productItem.category));
    return {
      businesses: db.businesses.length,
      active: db.businesses.filter((b) => b.status === 'activo' && b.open).length,
      hidden: db.businesses.filter((b) => b.status === 'oculto').length,
      inactive: db.businesses.filter((b) => !b.open).length,
      products: db.products.length,
      categories: cats.size
    };
  };

  // Solo para depuración / reinicio manual desde consola.
  const reset = () => {
    if (Backend.enabled) throw new Error('Store.reset no está disponible con Supabase.');
    db = clone(SEED_DATA);
    persist();
  };

  return {
    get data() { return db; },
    refresh, applySnapshot,
    businesses, listedBusinesses, business, products, product, productCount,
    stock, trackVisit, trackWhatsappClick,
    findUser, userForBusiness, usernameTaken,
    createBusiness, updateBusiness, updateBusinessProfile, renameCategory, updateAccess,
    moveBusiness, deleteBusiness, setBusinessStatus, slugTaken,
    createProduct, updateProduct, deleteProduct,
    moveProduct,
    stats, reset
  };
})();
