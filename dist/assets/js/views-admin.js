/* ==========================================================================
   AltoGO · Paneles de administración
   --------------------------------------------------------------------------
   1) AdminView  → super administrador: visibilidad, eliminación y accesos.
   2) OwnerUI    → dueño: perfil de su tienda, categorías, productos y visitas.
   Ambos comparten helpers de formularios y modales.
   ========================================================================== */

const AnalyticsView = (() => {
  const loading = () => `
    <div class="rounded-2xl border border-ink/5 bg-white px-5 py-10 text-center">
      <p class="text-sm font-medium">Cargando ventas…</p>
      <p class="mt-1 text-[11px] text-moss">Estamos sumando los pedidos de los últimos movimientos.</p>
    </div>`;

  const error = (message) => `
    <div class="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center text-rose-800">
      <p class="text-sm font-semibold">No pudimos cargar las ventas</p>
      <p class="mt-1 text-[11px]">${Utils.esc(message || 'Intenta de nuevo.')}</p>
      <button type="button" data-action="analytics-refresh" class="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white">Reintentar</button>
    </div>`;

  const salesCards = (totals = {}) => `
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border border-ink/5 bg-white p-5">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Unidades vendidas</p>
        <p class="mt-2 font-display text-3xl font-semibold tabular">${Utils.num(totals.items || 0)}</p>
        <p class="mt-1 text-[11px] text-moss">Productos incluidos en pedidos</p>
      </div>
      <div class="rounded-2xl border border-ink/5 bg-white p-5">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Ventas de productos</p>
        <p class="mt-2 font-display text-3xl font-semibold tabular">${Utils.money(totals.revenue || 0)}</p>
        <p class="mt-1 text-[11px] text-moss">Sin contar el costo de envío</p>
      </div>
      <div class="rounded-2xl border border-ink/5 bg-white p-5">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Pedidos</p>
        <p class="mt-2 font-display text-3xl font-semibold tabular">${Utils.num(totals.orders || 0)}</p>
        <p class="mt-1 text-[11px] text-moss">Pedidos con al menos un producto</p>
      </div>
    </div>`;

  const productRanking = (data, { showBusiness = false, limit = 10 } = {}) => {
    const products = (data && Array.isArray(data.products) ? data.products : []).slice(0, limit);
    const max = products.length ? Math.max(...products.map((row) => Number(row.qty) || 0)) : 1;

    return `
      <section class="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div class="flex items-center justify-between gap-3 border-b border-ink/5 px-5 py-4">
          <div>
            <h2 class="font-display text-base font-semibold">Productos más vendidos</h2>
            <p class="mt-0.5 text-[11px] text-moss">Ordenados por unidades vendidas.</p>
          </div>
          <span class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-moss">${products.length} ${products.length === 1 ? 'producto' : 'productos'}</span>
        </div>
        ${products.length ? `<div class="divide-y divide-ink/5">${products.map((row, index) => {
          const qty = Number(row.qty) || 0;
          const width = Math.max(5, Math.round((qty / max) * 100));
          return `<div class="px-4 py-3 sm:px-5">
            <div class="flex items-center gap-3">
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full ${index === 0 ? 'bg-lime text-ink' : 'bg-[#F4F5F7] text-moss'} text-[11px] font-bold">${index + 1}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">${Utils.esc(row.name || 'Producto')}</p>
                <p class="text-[10px] text-moss">${showBusiness ? Utils.esc(row.businessName || '') : `Última venta: ${Utils.dateLabel(row.lastSoldAt)}`}</p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm font-semibold tabular">${Utils.num(qty)} ${qty === 1 ? 'unidad' : 'unidades'}</p>
                <p class="text-[10px] text-moss tabular">${Utils.money(row.revenue || 0)}</p>
              </div>
            </div>
            <div class="ml-10 mt-2 h-1.5 overflow-hidden rounded-full bg-[#F4F5F7]">
              <div class="h-full rounded-full bg-ink" style="width:${width}%"></div>
            </div>
          </div>`;
        }).join('')}</div>` : `<div class="px-4 py-10 text-center text-xs text-moss">Todavía no hay ventas registradas. Los pedidos enviados por WhatsApp aparecerán acá.</div>`}
      </section>`;
  };

  return { loading, error, salesCards, productRanking };
})();

const AdminView = (() => {
  const state = { tab: 'comercios', analytics: null, analyticsLoading: false, analyticsError: '' };

  /* ---------- Clases reutilizadas en formularios ---------- */
  const inputCls = 'w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-moss/50 focus:border-ink focus:ring-2 focus:ring-ink/5';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-moss';
  const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700';
  const ghostBtn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F4F5F7]';
  const dangerBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700';

  const field = (label, control, extra = '') =>
    `<label class="block ${extra}"><span class="${labelCls} mb-1">${label}</span>${control}</label>`;

  /* Avatar pequeño para listas */
  const avatar = (business, size = 'h-10 w-10') => {
    if (business.logo) {
      return `<img src="${Utils.esc(business.logo)}" alt="" class="${size} shrink-0 rounded-xl object-cover ring-1 ring-ink/5" />`;
    }
    return `<span class="${size} grid shrink-0 place-items-center rounded-xl bg-ink font-display text-xs font-bold text-lime">${Utils.initials(business.name)}</span>`;
  };

  /* ------------------------------------------------------------------------
     Navegación
     ------------------------------------------------------------------------ */
  const TABS = [
    { id: 'comercios', label: 'Comercios', icon: 'store' },
    { id: 'accesos', label: 'Accesos', icon: 'users' },
    { id: 'analiticas', label: 'Analíticas', icon: 'chart' }
  ];

  const navItems = () => TABS.map((tab) => {
    const active = state.tab === tab.id;
    return `<button type="button" data-action="admin-tab" data-tab="${tab.id}"
      class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-ink text-white' : 'text-moss hover:bg-[#F4F5F7] hover:text-ink'}">
      ${Utils.icon(tab.icon, 'h-4 w-4 shrink-0')} ${tab.label}
    </button>`;
  }).join('');

  const statusOptions = (current) =>
    [['activo', 'Visible'], ['oculto', 'Oculto']]
      .map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`)
      .join('');

  const statusSelect = (business) => `
    <select data-change="business-status" data-id="${business.id}" aria-label="Estado de ${Utils.esc(business.name)}"
      class="rounded-lg border border-ink/10 bg-white px-2.5 py-1.5 text-xs font-medium outline-none transition focus:border-ink">
      ${statusOptions(business.status)}
    </select>`;

  const openBadge = (business) => {
    const meta = Utils.openMeta(business.open);
    return `<span class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}">${meta.label}</span>`;
  };

  const rowActions = (business, index = 0, total = 0) => `
    <div class="flex items-center justify-end gap-0.5">
      <button type="button" data-action="business-move" data-id="${business.id}" data-dir="up" ${index === 0 ? 'disabled' : ''}
        title="Subir" aria-label="Subir ${Utils.esc(business.name)}"
        class="grid h-8 w-8 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('up', 'h-4 w-4')}</button>
      <button type="button" data-action="business-move" data-id="${business.id}" data-dir="down" ${index >= total - 1 ? 'disabled' : ''}
        title="Bajar" aria-label="Bajar ${Utils.esc(business.name)}"
        class="grid h-8 w-8 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('down', 'h-4 w-4')}</button>
      <span class="mx-1 h-5 w-px bg-ink/5"></span>
      <a href="/negocio/${encodeURIComponent(business.slug)}" title="Ver catálogo" aria-label="Ver catálogo"
        class="grid h-8 w-8 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink">${Utils.icon('eye', 'h-4 w-4')}</a>
      <button type="button" data-action="delete-business" data-id="${business.id}" title="Eliminar" aria-label="Eliminar"
        class="grid h-8 w-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50">${Utils.icon('trash', 'h-4 w-4')}</button>
    </div>`;

  /* ------------------------------------------------------------------------
     Tab: Comercios
     ------------------------------------------------------------------------ */
  const comerciosTab = () => {
    const businesses = Store.businesses();

    if (!businesses.length) {
      return `<div class="rounded-2xl border border-dashed border-ink/10 bg-white p-12 text-center">
        <p class="font-display text-base font-semibold">Todavía no hay comercios</p>
        <p class="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-moss">Crea el primero y entrega su usuario y contraseña al dueño.</p>
        <button type="button" data-action="new-business" class="${primaryBtn} mt-4">${Utils.icon('plus', 'h-4 w-4')} Nuevo comercio</button>
      </div>`;
    }

    return `
      <div class="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <!-- Tabla (PC) -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-ink/5 text-left text-[10px] uppercase tracking-wider text-moss">
                <th class="px-5 py-3 font-semibold">Comercio</th>
                <th class="px-5 py-3 font-semibold">Visibilidad</th>
                <th class="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/5">
              ${businesses.map((business, index) => `
                <tr class="transition hover:bg-[#FAFBFC]">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      ${avatar(business)}
                      <div class="min-w-0">
                        <p class="truncate font-semibold">${Utils.esc(business.name)}</p>
                        <p class="truncate text-[11px] text-moss">/${Utils.esc(business.slug)}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2">${statusSelect(business)}${openBadge(business)}</div>
                  </td>
                  <td class="px-5 py-3">${rowActions(business, index, businesses.length)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- Tarjetas (móvil) -->
        <div class="divide-y divide-ink/5 md:hidden">
          ${businesses.map((business, index) => `
            <div class="flex items-center gap-3 p-4">
              ${avatar(business, 'h-10 w-10')}
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">${Utils.esc(business.name)}</p>
                <p class="truncate text-[11px] text-moss">/${Utils.esc(business.slug)}</p>
                <div class="mt-2 flex items-center gap-2">${statusSelect(business)}${openBadge(business)}</div>
              </div>
              ${rowActions(business, index, businesses.length)}
            </div>`).join('')}
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------------
     Tab: Accesos
     ------------------------------------------------------------------------ */
  const accesosTab = () => {
    const businesses = Store.businesses();

    return `
      <div class="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div class="border-b border-ink/5 px-5 py-4">
          <h2 class="font-display text-base font-semibold">Cuentas de comercio</h2>
          <p class="mt-0.5 text-xs text-moss">Cada dueño entra en <code class="rounded bg-[#F4F5F7] px-1">/ingreso</code> con estas credenciales.</p>
        </div>
        <div class="divide-y divide-ink/5">
          ${businesses.map((business) => {
            const owner = Store.userForBusiness(business.slug);
            return `<div class="flex flex-wrap items-center gap-3 px-5 py-3.5">
              ${avatar(business, 'h-9 w-9')}
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">${Utils.esc(business.name)}</p>
                <p class="truncate text-[11px] text-moss">${owner ? `@${Utils.esc(owner.username)}` : 'Sin cuenta asignada'}</p>
              </div>
              <button type="button" data-action="edit-access" data-id="${business.id}"
                class="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-[#F4F5F7]">
                ${Utils.icon('edit', 'h-3.5 w-3.5')} Editar acceso
              </button>
            </div>`;
          }).join('') || '<p class="px-5 py-10 text-center text-sm text-moss">Crea un comercio para generar su cuenta.</p>'}
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------------
     Layout del panel
     ------------------------------------------------------------------------ */
  const analiticasTab = () => {
    const global = Store.data.global;
    const businesses = Store.businesses();
    const analytics = state.analytics;
    const catalogVisits = businesses.reduce((sum, item) => sum + Number(item.visits || 0), 0);
    const totalVisits = Number(global.visits || 0) + catalogVisits;
    const conversion = Utils.pct(global.whatsappClicks, totalVisits);
    const sorted = [...businesses].sort((a, b) => Number(b.visits || 0) - Number(a.visits || 0));
    const topByBusiness = new Map();
    (analytics && Array.isArray(analytics.products) ? analytics.products : []).forEach((row) => {
      const current = topByBusiness.get(row.businessSlug);
      if (!current || Number(row.qty) > Number(current.qty)) topByBusiness.set(row.businessSlug, row);
    });

    const card = (label, value, sub) => `
      <div class="rounded-2xl border border-ink/5 bg-white p-5">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">${label}</p>
        <p class="mt-2 font-display text-3xl font-semibold tabular">${value}</p>
        <p class="mt-1 text-[11px] text-moss">${sub}</p>
      </div>`;

    return `
      <div class="grid gap-3 sm:grid-cols-3">
        ${card('Visitas a la página', Utils.num(global.visits), 'Aperturas del inicio de AltoGO')}
        ${card('Visitas a catálogos', Utils.num(catalogVisits), 'Suma de todos los comercios')}
        ${card('Clics a WhatsApp', Utils.num(global.whatsappClicks), `Conversión ${conversion}% del total`)}
      </div>

      <div class="mt-4">
        ${state.analyticsLoading
          ? AnalyticsView.loading()
          : state.analyticsError
            ? AnalyticsView.error(state.analyticsError)
            : analytics
              ? `${AnalyticsView.salesCards(analytics.totals)}<div class="mt-4">${AnalyticsView.productRanking(analytics, { showBusiness: true, limit: 10 })}</div>`
              : ''}
      </div>

      <div class="mt-4 overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div class="border-b border-ink/5 px-5 py-4">
          <h2 class="font-display text-base font-semibold">Por comercio</h2>
          <p class="mt-0.5 text-[11px] text-moss">Visitas a su catálogo y pedidos enviados a WhatsApp.</p>
        </div>

        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-ink/5 text-left text-[10px] uppercase tracking-wider text-moss">
                <th class="px-5 py-3 font-semibold">Comercio</th>
                <th class="px-5 py-3 font-semibold">Visitas</th>
                <th class="px-5 py-3 font-semibold">Clics WhatsApp</th>
                <th class="px-5 py-3 font-semibold">Conversión</th>
                <th class="px-5 py-3 font-semibold">Productos</th>
                <th class="px-5 py-3 font-semibold">Más vendido</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/5">
              ${sorted.map((business) => {
                const conv = Utils.pct(business.whatsappClicks, business.visits);
                const top = topByBusiness.get(business.slug);
                return `<tr class="transition hover:bg-[#FAFBFC]">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      ${avatar(business, 'h-8 w-8')}
                      <span class="font-medium">${Utils.esc(business.name)}</span>
                    </div>
                  </td>
                  <td class="px-5 py-3 tabular">${Utils.num(business.visits)}</td>
                  <td class="px-5 py-3 tabular">${Utils.num(business.whatsappClicks)}</td>
                  <td class="px-5 py-3 tabular">${conv}%</td>
                  <td class="px-5 py-3 tabular">${Store.productCountOf(business)}</td>
                  <td class="px-5 py-3">${top ? `<p class="max-w-[13rem] truncate text-xs font-medium">${Utils.esc(top.name)}</p><p class="text-[10px] text-moss tabular">${Utils.num(top.qty)} unidades</p>` : '<span class="text-xs text-moss">Sin ventas</span>'}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="6" class="px-5 py-8 text-center text-xs text-moss">Sin datos todavía.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="divide-y divide-ink/5 md:hidden">
          ${sorted.map((business) => `<div class="flex items-center gap-3 px-4 py-3">
            ${avatar(business, 'h-9 w-9')}
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">${Utils.esc(business.name)}</p>
              <p class="text-[10px] text-moss">${Utils.num(business.whatsappClicks)} clics · ${Utils.pct(business.whatsappClicks, business.visits)}%</p>
              <p class="truncate text-[10px] text-moss">${topByBusiness.get(business.slug) ? `Top: ${Utils.esc(topByBusiness.get(business.slug).name)}` : 'Sin ventas'}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold tabular">${Utils.num(business.visits)}</p>
              <p class="text-[9px] uppercase tracking-wide text-moss">visitas</p>
            </div>
          </div>`).join('') || '<p class="px-4 py-8 text-center text-xs text-moss">Sin datos todavía.</p>'}
        </div>
      </div>`;
  };

  const loadAdminAnalytics = async () => {
    if (state.analyticsLoading) return;
    state.analyticsLoading = true;
    state.analyticsError = '';
    if (state.tab === 'analiticas') App.render();
    try {
      state.analytics = await Store.loadProductAnalytics();
    } catch (error) {
      state.analyticsError = error.message || 'No se pudieron cargar las ventas.';
      state.analytics = null;
    } finally {
      state.analyticsLoading = false;
      if (state.tab === 'analiticas') App.render();
    }
  };

  /* ------------------------------------------------------------------------
     Layout del panel
     ------------------------------------------------------------------------ */
  const render = () => {
    document.title = `Panel · ${ALTOGO.brand.name}`;
    Cart.detach();

    const session = Auth.current();
    const meta = {
      comercios: { title: 'Comercios', subtitle: 'Controla qué negocios se ven, se ocultan o se eliminan.' },
      accesos: { title: 'Accesos', subtitle: 'Crea y actualiza el usuario de cada comercio.' },
      analiticas: { title: 'Analíticas', subtitle: 'Visitas, pedidos y productos más vendidos por comercio.' }
    }[state.tab];

    const content = state.tab === 'accesos'
      ? accesosTab()
      : state.tab === 'analiticas'
        ? analiticasTab()
        : comerciosTab();

    return `
      <div class="min-h-screen bg-[#F7F8FA] lg:flex">
        <!-- Menú lateral (PC) -->
        <aside class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-ink/5 bg-white px-4 py-6 lg:flex">
          <div>
            <a href="/admin" class="flex items-center gap-2.5 px-2">
              <span class="font-display text-2xl font-bold tracking-tight text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span>
              <div class="leading-tight">
                <p class="font-display text-lg font-bold">AltoGO</p>
                <p class="text-[10px] text-moss">Administración</p>
              </div>
            </a>
            <nav class="mt-8 space-y-1">${navItems()}</nav>
          </div>
          <div>
            <a href="/" class="mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-moss transition hover:bg-[#F4F5F7] hover:text-ink">
              ${Utils.icon('eye', 'h-4 w-4')} Ver sitio público
            </a>
            <div class="rounded-xl bg-[#F4F5F7] p-3">
              <p class="truncate text-sm font-semibold">${Utils.esc(session ? session.name : 'Administrador')}</p>
              <p class="truncate text-[11px] text-moss">@${Utils.esc(session ? session.username : 'admin')}</p>
            </div>
            <button type="button" data-action="logout" class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-moss transition hover:bg-[#F4F5F7] hover:text-ink">
              ${Utils.icon('logout', 'h-4 w-4')} Cerrar sesión
            </button>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <!-- Barra móvil -->
          <div class="sticky top-0 z-30 border-b border-ink/5 bg-white px-4 pb-3 pt-3 lg:hidden">
            <div class="flex items-center justify-between">
              <a href="/admin" class="flex items-center gap-2">
                <span class="font-display text-2xl font-bold tracking-tight text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span>
              </a>
              <div class="flex items-center gap-1">
                <a href="/" class="grid h-8 w-8 place-items-center rounded-lg text-moss" aria-label="Ver sitio público">${Utils.icon('eye', 'h-4 w-4')}</a>
                <button type="button" data-action="logout" class="grid h-8 w-8 place-items-center rounded-lg text-moss" aria-label="Cerrar sesión">${Utils.icon('logout', 'h-4 w-4')}</button>
              </div>
            </div>
            <div class="no-scrollbar mt-3 flex gap-1 overflow-x-auto">
              ${TABS.map((tab) => {
                const active = state.tab === tab.id;
                return `<button type="button" data-action="admin-tab" data-tab="${tab.id}"
                  class="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? 'bg-ink text-white' : 'text-moss hover:text-ink'}">${tab.label}</button>`;
              }).join('')}
            </div>
          </div>

          <main class="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-10 lg:py-10">
            <header class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Super administrador</p>
                <h1 class="mt-1 font-display text-2xl font-semibold sm:text-3xl">${meta.title}</h1>
                <p class="mt-1 text-xs text-moss sm:text-sm">${meta.subtitle}</p>
              </div>
              ${state.tab === 'comercios'
                ? `<button type="button" data-action="new-business" class="${primaryBtn}">${Utils.icon('plus', 'h-4 w-4')} Nuevo comercio</button>`
                : ''}
            </header>

            <div class="mt-5">${content}</div>
          </main>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------------
     Modales: crear comercio / credenciales / eliminar
     ------------------------------------------------------------------------ */
  let slugLocked = false;

  const openNewBusiness = () => {
    slugLocked = false;

    Utils.openModal({
      title: 'Nuevo comercio',
      subtitle: 'Crea la tienda y su cuenta de acceso. El dueño completará foto, biografía y envío.',
      size: 'lg',
      body: `
        <form data-form="business-create" class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2">
            ${field('Nombre comercial', `<input name="name" required maxlength="60" data-input="business-name" class="${inputCls}" placeholder="Tienda La Palma" />`, 'sm:col-span-2')}
            ${field('Slug de la URL', `<input name="slug" required data-input="business-slug" class="${inputCls}" placeholder="tienda-la-palma" />`)}
            ${field('Estado', `<select name="status" class="${inputCls}">${statusOptions('activo')}</select>`)}
            ${field('WhatsApp (opcional)', `<input name="whatsapp" inputmode="tel" class="${inputCls}" placeholder="5215512345678" />`, 'sm:col-span-2')}
          </div>

          <div class="rounded-2xl border border-ink/10 bg-[#F7F8FA] p-4">
            <p class="flex items-center gap-1.5 text-xs font-semibold">${Utils.icon('users', 'h-3.5 w-3.5')} Acceso del dueño</p>
            <p class="mt-1 text-[11px] leading-relaxed text-moss">Podrá iniciar sesión en <strong>/ingreso</strong> para administrar su tienda.</p>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              ${field('Usuario', `<input name="username" required autocapitalize="none" spellcheck="false" class="${inputCls}" placeholder="lapalma" />`)}
              ${field('Contraseña', `<input name="password" required minlength="8" autocomplete="new-password" class="${inputCls}" placeholder="mínimo 8 caracteres" />`)}
            </div>
          </div>

          <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${primaryBtn}">Crear comercio</button>
          </div>
        </form>`
    });
  };

  const openAccessModal = (businessId) => {
    const business = Store.businesses().find((item) => item.id === businessId);
    if (!business) return;
    const owner = Store.userForBusiness(business.slug);

    Utils.openModal({
      title: 'Acceso del comercio',
      subtitle: business.name,
      body: `
        <form data-form="access-save" class="space-y-4">
          <input type="hidden" name="slug" value="${Utils.esc(business.slug)}" />
          <div class="grid gap-3 sm:grid-cols-2">
            ${field('Usuario', `<input name="username" required autocapitalize="none" spellcheck="false" class="${inputCls}" value="${owner ? Utils.esc(owner.username) : ''}" />`)}
            ${field(Backend.enabled ? 'Nueva contraseña' : 'Contraseña', `<input name="password" ${Backend.enabled ? 'minlength="8"' : 'required minlength="8"'} autocomplete="new-password" class="${inputCls}" value="${!Backend.enabled && owner ? Utils.esc(owner.password) : ''}" placeholder="${Backend.enabled ? 'dejar vacío para mantener' : 'mínimo 8 caracteres'}" />`)}
          </div>
          <p class="text-[11px] leading-relaxed text-moss">Comparte estas credenciales con el dueño. Entra en <strong>/ingreso</strong>.</p>
          <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${primaryBtn}">Guardar acceso</button>
          </div>
        </form>`
    });
  };

  const openDeleteBusiness = (businessId) => {
    const business = Store.businesses().find((item) => item.id === businessId);
    if (!business) return;

    Utils.openModal({
      title: 'Eliminar comercio',
      subtitle: business.name,
      body: `
        <form data-form="business-delete" class="space-y-4">
          <input type="hidden" name="id" value="${business.id}" />
          <div class="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
            <span class="mt-0.5 shrink-0">${Utils.icon('alert', 'h-4 w-4')}</span>
            <div class="text-xs leading-relaxed">
              <p class="font-semibold">Esta acción no se puede deshacer.</p>
              <p class="mt-1">Se eliminarán <strong>${Store.productCountOf(business)} productos</strong> y su cuenta de acceso. Si solo quieres dejar de mostrarlo, cámbialo a <strong>Oculto</strong>.</p>
            </div>
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${dangerBtn}">${Utils.icon('trash', 'h-4 w-4')} Eliminar definitivamente</button>
          </div>
        </form>`
    });
  };

  /* ------------------------------------------------------------------------
     Eventos del panel
     ------------------------------------------------------------------------ */
  Events.onAction('admin-tab', (el, event) => {
    if (event) event.preventDefault();
    state.tab = ['accesos', 'analiticas'].includes(el.dataset.tab) ? el.dataset.tab : 'comercios';
    state.analytics = null;
    state.analyticsError = '';
    state.analyticsLoading = false;
    App.render();
    if (state.tab === 'analiticas') loadAdminAnalytics();
  });

  Events.onAction('analytics-refresh', () => {
    state.analytics = null;
    state.analyticsError = '';
    loadAdminAnalytics();
  });

  Events.onAction('new-business', () => openNewBusiness());
  Events.onAction('edit-access', (el) => openAccessModal(el.dataset.id));
  Events.onAction('delete-business', (el) => openDeleteBusiness(el.dataset.id));

  Events.onAction('business-move', async (el) => {
    await Store.moveBusiness(el.dataset.id, el.dataset.dir);
    App.render();
  });

  Events.onInput('business-name', (el) => {
    if (slugLocked) return;
    const slugInput = document.querySelector('[data-modal-body] input[name="slug"]');
    if (slugInput) slugInput.value = Utils.slugify(el.value);
  });

  Events.onInput('business-slug', (el) => {
    slugLocked = true;
    el.value = el.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  });

  Events.onChange('business-status', async (el) => {
    try {
      const business = await Store.setBusinessStatus(el.dataset.id, el.value);
      if (!business) return;
      const label = { activo: 'visible', oculto: 'oculto' }[el.value] || el.value;
      Utils.toast(`${business.name} ahora está ${label}.`);
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
      App.render();
    }
  });

  Events.onSubmit('business-create', async (form) => {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const slug = Utils.slugify(String(data.get('slug') || ''));
    const whatsapp = Utils.digits(data.get('whatsapp'));
    const username = String(data.get('username') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    if (!name) return Utils.toast('Escribe el nombre del comercio.', 'error');
    if (!slug) return Utils.toast('El slug de la URL no puede quedar vacío.', 'error');
    if (Store.slugTaken(slug)) return Utils.toast('Ese slug ya está en uso por otro comercio.', 'error');
    if (whatsapp && whatsapp.length < 8) return Utils.toast('El WhatsApp debe incluir el código de país.', 'error');
    if (username.length < 3) return Utils.toast('El usuario debe tener al menos 3 caracteres.', 'error');
    if (Store.usernameTaken(username)) return Utils.toast('Ese usuario ya existe, elige otro.', 'error');
    if (password.length < 8) return Utils.toast('La contraseña debe tener al menos 8 caracteres.', 'error');

    try {
      await Store.createBusiness({
        name, slug, whatsapp,
        status: String(data.get('status') || 'activo'),
        username, password
      });
      Utils.toast('Comercio creado con su cuenta de acceso.');
      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  Events.onSubmit('access-save', async (form) => {
    const data = new FormData(form);
    const slug = String(data.get('slug') || '');
    const username = String(data.get('username') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    const owner = Store.userForBusiness(slug);

    if (!owner) return Utils.toast('Este comercio no tiene una cuenta asignada.', 'error');
    if (username.length < 3) return Utils.toast('El usuario debe tener al menos 3 caracteres.', 'error');
    if (Store.usernameTaken(username, owner.id)) return Utils.toast('Ese usuario ya existe, elige otro.', 'error');
    if (password && password.length < 8) return Utils.toast('La contraseña debe tener al menos 8 caracteres.', 'error');
    if (!Backend.enabled && !password) return Utils.toast('Escribe una contraseña.', 'error');

    try {
      await Store.updateAccess(slug, { username, password });
      Utils.toast('Acceso actualizado.');
      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  Events.onSubmit('business-delete', async (form) => {
    const id = String(new FormData(form).get('id') || '');
    try {
      await Store.deleteBusiness(id);
      Utils.toast('Comercio eliminado.');
      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  return { state, render };
})();

/* ==========================================================================
   OwnerUI · Modo edición del dueño de tienda
   ========================================================================== */

const OwnerUI = (() => {
  let analyticsRequest = 0;
  const inputCls = 'w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-moss/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const zoneInputCls = 'rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-moss/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-moss';
  const ghostBtn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F4F5F7]';
  const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700';
  const dangerBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700';

  const field = (label, control, extra = '') =>
    `<label class="block ${extra}"><span class="${labelCls} mb-1">${label}</span>${control}</label>`;

  const isHttpUrl = (value) => !value || /^https?:\/\//i.test(value);

  const categoriesOf = (business) => Store.categoriesOf(business.slug);

  /* Barra de administración dentro del catálogo */
  const toolbar = (business) => `
    <section class="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">${Utils.icon('shield', 'h-4 w-4')}</span>
          <div>
            <p class="text-sm font-semibold">Modo edición</p>
            <p class="text-[11px] text-moss">${Utils.num(business.visits)} visitas a tu página</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="owner-settings" class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-50">
            ${Utils.icon('store', 'h-3.5 w-3.5')} Mi tienda
          </button>
          <button type="button" data-action="owner-categories" class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-50">
            ${Utils.icon('bag', 'h-3.5 w-3.5')} Categorías
          </button>
          <button type="button" data-action="owner-order" class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-50">
            ${Utils.icon('menu', 'h-3.5 w-3.5')} Orden
          </button>
          <button type="button" data-action="owner-analytics" class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-50">
            ${Utils.icon('chart', 'h-3.5 w-3.5')} Analíticas
          </button>
          <button type="button" data-action="new-product" class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700">
            ${Utils.icon('plus', 'h-3.5 w-3.5')} Nuevo producto
          </button>
        </div>
      </div>
    </section>`;

  /* ---------- Perfil de la tienda ---------- */
  const zoneRow = (zone = {}) => `
    <div data-zone-row class="flex items-center gap-2">
      <input name="zoneName" value="${Utils.esc(zone.name || '')}" placeholder="Ej. Centro" maxlength="60"
        class="${zoneInputCls} min-w-0 flex-1" aria-label="Nombre de la zona" />
      <input name="zonePrice" type="number" min="0" step="1" value="${zone.price ?? ''}" placeholder="Precio"
        class="${zoneInputCls} w-24 shrink-0 text-right" aria-label="Precio de la zona" />
      <button type="button" data-action="zone-remove" aria-label="Quitar zona"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50">
        ${Utils.icon('trash', 'h-4 w-4')}
      </button>
    </div>`;

  const openSettings = () => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;
    const business = Store.business(session.businessSlug);
    if (!business) return;
    const mode = business.shippingMode || 'fixed';
    const zones = Array.isArray(business.shippingZones) ? business.shippingZones : [];

    Utils.openModal({
      title: 'Mi tienda',
      subtitle: 'Estos datos se muestran en tu catálogo público.',
      size: 'lg',
      body: `
        <form data-form="store-save" class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2">
            ${field('Nombre', `<input name="name" required maxlength="60" class="${inputCls}" value="${Utils.esc(business.name)}" />`)}
            ${field('WhatsApp (con código de país)', `<input name="whatsapp" required inputmode="tel" class="${inputCls}" value="${Utils.esc(business.whatsapp)}" placeholder="5215512345678" />`)}
            ${field('Foto / logo (URL)', `<input name="logo" class="${inputCls}" value="${Utils.esc(business.logo)}" placeholder="https://…" />`)}
            ${field('Estado del comercio', `<select name="open" class="${inputCls}">
              <option value="open" ${business.open ? 'selected' : ''}>Abierto — recibe pedidos</option>
              <option value="closed" ${business.open ? '' : 'selected'}>Cerrado — no recibe pedidos</option>
            </select>`)}
            ${field('Biografía', `<textarea name="tagline" rows="3" maxlength="160" class="${inputCls} resize-none" placeholder="Productos frescos y básicos para tu casa.">${Utils.esc(business.tagline)}</textarea>`, 'sm:col-span-2')}
          </div>

          <section class="rounded-2xl border border-ink/10 bg-cream/50 p-4">
            <label class="block">
              <span class="${labelCls} mb-1">Delivery</span>
              <select name="shippingMode" data-change="shipping-mode" class="${inputCls}">
                <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Precio fijo para todos</option>
                <option value="zones" ${mode === 'zones' ? 'selected' : ''}>Precio según la zona</option>
                <option value="whatsapp" ${mode === 'whatsapp' ? 'selected' : ''}>Se cobra por WhatsApp</option>
              </select>
            </label>

            <div id="shipping-fixed-wrap" class="mt-3 ${mode === 'fixed' ? '' : 'hidden'}">
              ${field('Precio del delivery (ARS)', `<input name="shippingCost" type="number" min="0" step="1" class="${inputCls}" value="${business.shippingCost}" />`)}
              <p class="mt-1 text-[11px] text-moss">Usa 0 para ofrecer envío gratis.</p>
            </div>

            <div id="shipping-zones-wrap" class="mt-3 ${mode === 'zones' ? '' : 'hidden'}">
              <p class="mb-2 text-[11px] leading-relaxed text-moss">El cliente elige una zona al confirmar y el sistema suma ese precio al total.</p>
              <div id="zone-rows" class="space-y-2">${zones.map(zoneRow).join('')}</div>
              <button type="button" data-action="zone-add" class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[#F4F5F7]">
                ${Utils.icon('plus', 'h-3.5 w-3.5')} Agregar zona
              </button>
            </div>

            <div id="shipping-whatsapp-wrap" class="mt-3 ${mode === 'whatsapp' ? '' : 'hidden'}">
              <div class="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-900">
                <span class="mt-0.5 shrink-0">${Utils.icon('whatsapp', 'h-4 w-4')}</span>
                <p class="text-[11px] leading-relaxed">El pedido se envía sin costo de envío. El comercio acuerda el delivery con el cliente por WhatsApp según su ubicación.</p>
              </div>
            </div>
          </section>

          <p class="text-[11px] leading-relaxed text-moss">La foto es opcional: si la dejas vacía se usan tus iniciales. Si cierras el comercio, los clientes podrán ver el catálogo pero no enviar pedidos.</p>
          <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${primaryBtn}">Guardar cambios</button>
          </div>
        </form>`
    });
  };

  /* ---------- Categorías de la tienda ---------- */
  const openCategories = () => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;
    const business = Store.business(session.businessSlug);
    if (!business) return;

    const categories = categoriesOf(business);
    const products = Store.products(business.slug);

    const body = categories.length
      ? `<form data-form="categories-save" class="space-y-4">
          <p class="text-xs leading-relaxed text-moss">Renombra cada categoría y usa las flechas para elegir el orden en que aparecen en tu catálogo.</p>
          <div class="space-y-2">
            ${categories.map((category, index) => {
              const count = products.filter((p) => p.category === category).length;
              return `<div data-category-row class="flex items-center gap-2">
                <input name="cat::${Utils.esc(category)}" value="${Utils.esc(category)}" required maxlength="40"
                  class="${inputCls} min-w-0 flex-1" aria-label="Nombre de la categoría ${Utils.esc(category)}" />
                <span class="hidden w-16 shrink-0 text-right text-[11px] text-moss sm:block">${count} ${count === 1 ? 'producto' : 'productos'}</span>
                <div class="flex shrink-0 items-center">
                  <button type="button" data-action="category-move" data-dir="up" ${index === 0 ? 'disabled' : ''}
                    aria-label="Subir ${Utils.esc(category)}" title="Subir"
                    class="grid h-8 w-8 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('up', 'h-4 w-4')}</button>
                  <button type="button" data-action="category-move" data-dir="down" ${index === categories.length - 1 ? 'disabled' : ''}
                    aria-label="Bajar ${Utils.esc(category)}" title="Bajar"
                    class="grid h-8 w-8 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('down', 'h-4 w-4')}</button>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${primaryBtn}">Guardar categorías</button>
          </div>
        </form>`
      : `<p class="text-sm leading-relaxed text-moss">Aún no tienes categorías. Agrega un producto y define su categoría para empezar.</p>
         <button type="button" data-action="new-product" class="${primaryBtn} mt-4">${Utils.icon('plus', 'h-4 w-4')} Nuevo producto</button>`;

    Utils.openModal({ title: 'Categorías', subtitle: business.name, body });
  };

  /* ---------- Orden de los productos ---------- */
  const openOrder = () => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;
    const business = Store.business(session.businessSlug);
    if (!business) return;

    const products = Store.products(business.slug);

    const body = products.length
      ? `<p class="text-xs leading-relaxed text-moss">El orden se aplica a tu catálogo en la vista <strong>Todas</strong>. Usa las flechas o el botón superior para mover cada producto.</p>
        <div class="mt-3 divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/5">
          ${products.map((product, index) => `
            <div class="flex items-center gap-1.5 px-3 py-2.5 sm:gap-2">
              <span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#F4F5F7] text-[10px] font-semibold text-moss">${index + 1}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">${Utils.esc(product.name)}</p>
                <p class="text-[10px] text-moss">${Utils.esc(product.category)}</p>
              </div>
              <button type="button" data-action="product-move" data-id="${product.id}" data-dir="top" ${index === 0 ? 'disabled' : ''}
                aria-label="Mover ${Utils.esc(product.name)} al principio" title="Mover al principio"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('top', 'h-4 w-4')}</button>
              <button type="button" data-action="product-move" data-id="${product.id}" data-dir="up" ${index === 0 ? 'disabled' : ''}
                aria-label="Subir ${Utils.esc(product.name)}" title="Subir"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('up', 'h-4 w-4')}</button>
              <button type="button" data-action="product-move" data-id="${product.id}" data-dir="down" ${index >= products.length - 1 ? 'disabled' : ''}
                aria-label="Bajar ${Utils.esc(product.name)}" title="Bajar"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-moss transition hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent">${Utils.icon('down', 'h-4 w-4')}</button>
            </div>`).join('')}
        </div>
        <button type="button" data-action="modal-close" class="mt-4 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Listo</button>`
      : `<p class="text-sm leading-relaxed text-moss">Todavía no tienes productos para ordenar.</p>
         <button type="button" data-action="new-product" class="${primaryBtn} mt-4">${Utils.icon('plus', 'h-4 w-4')} Nuevo producto</button>`;

    Utils.openModal({ title: 'Orden del catálogo', subtitle: business.name, body });
  };

  /* ---------- Analíticas: visitas y productos ---------- */
  const openAnalytics = async () => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;
    const business = Store.business(session.businessSlug);
    if (!business) return;
    const request = ++analyticsRequest;

    const products = Store.products(business.slug);

    Utils.openModal({
      title: 'Analíticas',
      subtitle: business.name,
      size: 'lg',
      body: `<div data-owner-analytics-loading class="rounded-2xl border border-ink/5 bg-white px-5 py-10 text-center">
        <p class="text-sm font-medium">Cargando ventas…</p>
        <p class="mt-1 text-[11px] text-moss">Estamos sumando los pedidos de tu comercio.</p>
      </div>`
    });

    let data = null;
    let error = '';
    try {
      data = await Store.loadProductAnalytics(business.slug);
    } catch (loadError) {
      error = loadError.message || 'No se pudieron cargar las ventas.';
    }
    if (request !== analyticsRequest) return;

    const bodyRoot = document.querySelector('[data-owner-analytics-loading]');
    if (!bodyRoot) return;
    const modalBody = bodyRoot.closest('[data-modal-body]');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="rounded-2xl border border-ink/5 bg-[#F7F8FA] p-5">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Visitas a tu página</p>
          <p class="mt-1 font-display text-4xl font-semibold tabular">${Utils.num(business.visits)}</p>
          <p class="mt-1 text-[11px] text-moss">Se cuenta cada apertura pública de tu catálogo.</p>
        </div>

        <div class="mt-4">
          ${error
            ? `<div class="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center text-rose-800">
                <p class="text-sm font-semibold">No pudimos cargar las ventas</p>
                <p class="mt-1 text-[11px]">${Utils.esc(error)}</p>
                <button type="button" data-action="owner-analytics" class="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white">Reintentar</button>
              </div>`
            : `${AnalyticsView.salesCards(data.totals)}
               <div class="mt-4">${AnalyticsView.productRanking(data, { limit: 10 })}</div>`}
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-display text-base font-semibold">Tus productos</h3>
            <span class="text-[11px] text-moss">${products.length} ${products.length === 1 ? 'producto' : 'productos'}</span>
          </div>
          <div class="mt-2 divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/5">
            ${products.length ? products.map((product) => {
              const stock = Store.stock(product);
              return `<div class="flex items-center gap-3 px-3 py-2.5">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">${Utils.esc(product.name)}</p>
                  <p class="text-[10px] text-moss">${Utils.esc(product.category)}</p>
                </div>
                <span class="text-xs font-semibold tabular">${Utils.money(product.price)}</span>
                <span class="w-20 shrink-0 text-right text-[10px] font-medium ${stock.available ? 'text-emerald-700' : 'text-rose-600'}">${stock.label}</span>
              </div>`;
            }).join('') : '<p class="px-3 py-6 text-center text-xs text-moss">Todavía no publicas productos.</p>'}
          </div>
        </div>

        <button type="button" data-action="modal-close" class="mt-4 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Entendido</button>`;
  };

  /* ---------- Modal de producto (crear / editar) ---------- */
  const productImageRow = (url = '', index = 0) => `
    <div data-product-image-row class="flex items-center gap-2">
      <input name="imageUrl" value="${Utils.esc(url)}" maxlength="1000" placeholder="https://…"
        class="${zoneInputCls} min-w-0 flex-1" aria-label="Imagen ${index + 1} del producto" />
      <button type="button" data-action="product-image-remove" aria-label="Quitar imagen"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50">
        ${Utils.icon('trash', 'h-4 w-4')}
      </button>
    </div>`;

  const openProduct = (productId = null) => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;

    const product = productId ? Store.product(productId) : null;
    // Seguridad básica: un dueño solo edita productos de su propio comercio.
    if (product && product.businessSlug !== session.businessSlug) return;
    if (productId && !product) return;

    const business = Store.business(session.businessSlug);
    const mode = product ? (typeof product.stock === 'number' ? 'qty' : 'bool') : 'qty';
    const qty = product && typeof product.stock === 'number' ? product.stock : 0;
    const available = product ? (product.stock === true || (typeof product.stock === 'number' && product.stock > 0)) : true;
    const categories = Array.from(new Set([
      ...Object.keys(ALTOGO.categories),
      ...(business ? categoriesOf(business) : [])
    ]));
    const images = product && Array.isArray(product.images) ? product.images : [];
    const imageRows = images.length ? images : [''];

    const body = `
      <form data-form="product-save" class="space-y-4">
        <input type="hidden" name="id" value="${product ? product.id : ''}" />
        <div class="grid gap-3 sm:grid-cols-2">
          ${field('Nombre del producto', `<input name="name" required maxlength="80" class="${inputCls}" value="${product ? Utils.esc(product.name) : ''}" placeholder="Arroz largo fino 1 kg" />`, 'sm:col-span-2')}
          ${field('Precio (ARS)', `<input name="price" type="number" min="1" step="1" required class="${inputCls}" value="${product ? product.price : ''}" placeholder="75" />`)}
          ${field('Categoría', `<input name="category" required list="categorias-sugeridas" class="${inputCls}" value="${product ? Utils.esc(product.category) : ''}" placeholder="Almacén" />
            <datalist id="categorias-sugeridas">${categories.map((category) => `<option value="${Utils.esc(category)}"></option>`).join('')}</datalist>`)}
        </div>

        <section class="rounded-2xl border border-ink/10 bg-[#F7F8FA] p-3.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-moss">Imágenes del producto</p>
              <p class="mt-0.5 text-[11px] leading-relaxed text-moss">Hasta 8 imágenes. La primera se usa como portada y todas se muestran en un carrusel manual.</p>
            </div>
            <button type="button" data-action="product-image-add" class="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[#F4F5F7]">
              ${Utils.icon('plus', 'h-3.5 w-3.5')} Agregar imagen
            </button>
          </div>
          <div id="product-image-rows" class="mt-2.5 space-y-2">${imageRows.map((image, index) => productImageRow(image, index)).join('')}</div>
        </section>

        <p class="rounded-xl bg-[#F7F8FA] px-3 py-2.5 text-[11px] leading-relaxed text-moss">
          <strong class="text-ink">Medida recomendada: 1200 × 900 px (4:3).</strong>
          JPG, PNG o WebP, con el producto centrado y un margen libre alrededor. La imagen se muestra completa, sin recortes.
        </p>

        <fieldset class="rounded-2xl border border-ink/10 bg-[#F7F8FA] p-3">
          <legend class="px-1 text-[11px] font-semibold uppercase tracking-wide text-moss">Control de stock</legend>
          <div class="mt-1 grid gap-2 sm:grid-cols-2">
            <label class="flex cursor-pointer items-start gap-2 rounded-xl border border-ink/10 bg-white p-3 has-[:checked]:border-blue-400 has-[:checked]:ring-1 has-[:checked]:ring-blue-200">
              <input type="radio" name="stockMode" value="qty" data-change="product-stock-mode" class="mt-0.5 accent-[#2563EB]" ${mode === 'qty' ? 'checked' : ''} />
              <span>
                <span class="block text-xs font-semibold">Cantidad exacta</span>
                <span class="text-[10px] leading-snug text-moss">Muestra “Últimas X” y bloquea al agotarse.</span>
              </span>
            </label>
            <label class="flex cursor-pointer items-start gap-2 rounded-xl border border-ink/10 bg-white p-3 has-[:checked]:border-blue-400 has-[:checked]:ring-1 has-[:checked]:ring-blue-200">
              <input type="radio" name="stockMode" value="bool" data-change="product-stock-mode" class="mt-0.5 accent-[#2563EB]" ${mode === 'bool' ? 'checked' : ''} />
              <span>
                <span class="block text-xs font-semibold">Disponible / Agotado</span>
                <span class="text-[10px] leading-snug text-moss">Sin conteo, ideal para servicios o productos sin stock fijo.</span>
              </span>
            </label>
          </div>

          <div id="stock-qty-wrap" class="mt-3 ${mode === 'qty' ? '' : 'hidden'}">
            ${field('Unidades disponibles', `<input name="qty" type="number" min="0" step="1" class="${inputCls}" value="${qty}" />`)}
          </div>
          <div id="stock-bool-wrap" class="mt-3 ${mode === 'bool' ? '' : 'hidden'}">
            <label class="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm">
              <input type="checkbox" name="available" class="h-4 w-4 accent-[#2563EB]" ${available ? 'checked' : ''} />
              Disponible para venta
            </label>
          </div>
        </fieldset>

        <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          ${product
            ? `<button type="button" data-action="delete-product" data-id="${product.id}" class="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">${Utils.icon('trash', 'h-4 w-4')} Eliminar</button>`
            : '<span></span>'}
          <div class="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${primaryBtn}">${product ? 'Guardar producto' : 'Publicar producto'}</button>
          </div>
        </div>
      </form>`;

    Utils.openModal({
      title: product ? 'Editar producto' : 'Nuevo producto',
      subtitle: product ? product.category : 'Se publicará en tu catálogo al instante.',
      body,
      size: 'lg'
    });
  };

  const openDeleteProduct = (productId) => {
    const session = Auth.current();
    const product = Store.product(productId);
    if (!session || session.role !== 'owner' || !product || product.businessSlug !== session.businessSlug) return;

    Utils.openModal({
      title: 'Eliminar producto',
      subtitle: product.name,
      body: `
        <form data-form="product-delete" class="space-y-4">
          <input type="hidden" name="id" value="${product.id}" />
          <p class="text-sm leading-relaxed text-moss">Se quitará del catálogo público y del carrito de los clientes. Esta acción no se puede deshacer.</p>
          <div class="flex flex-col-reverse gap-2 border-t border-ink/5 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="modal-close" class="${ghostBtn}">Cancelar</button>
            <button type="submit" class="${dangerBtn}">Eliminar producto</button>
          </div>
        </form>`
    });
  };

  /* ---------- Eventos del dueño ---------- */
  Events.onAction('new-product', () => openProduct());
  Events.onAction('edit-product', (el) => openProduct(el.dataset.id));
  Events.onAction('owner-settings', () => openSettings());
  Events.onAction('owner-categories', () => openCategories());
  Events.onAction('owner-order', () => openOrder());
  Events.onAction('owner-analytics', () => openAnalytics());
  Events.onAction('delete-product', (el) => openDeleteProduct(el.dataset.id));

  Events.onAction('product-image-add', () => {
    const rows = document.getElementById('product-image-rows');
    if (!rows) return;
    const count = rows.querySelectorAll('[data-product-image-row]').length;
    if (count >= 8) {
      return Utils.toast('Puedes agregar hasta 8 imágenes por producto.', 'warning');
    }
    rows.insertAdjacentHTML('beforeend', productImageRow('', count));
    const added = rows.querySelector('[data-product-image-row]:last-child input[name="imageUrl"]');
    if (added) added.focus();
  });

  Events.onAction('product-image-remove', (el) => {
    const row = el.closest('[data-product-image-row]');
    if (row) row.remove();
  });

  Events.onAction('category-move', (el) => {
    const row = el.closest('[data-category-row]');
    const container = row ? row.parentElement : null;
    if (!row || !container) return;

    if (el.dataset.dir === 'up' && row.previousElementSibling) {
      container.insertBefore(row, row.previousElementSibling);
    } else if (el.dataset.dir === 'down' && row.nextElementSibling) {
      container.insertBefore(row.nextElementSibling, row);
    }

    const rows = Array.from(container.querySelectorAll('[data-category-row]'));
    rows.forEach((item, index) => {
      const up = item.querySelector('[data-action="category-move"][data-dir="up"]');
      const down = item.querySelector('[data-action="category-move"][data-dir="down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === rows.length - 1;
    });
  });

  Events.onAction('product-move', async (el) => {
    try {
      await Store.moveProduct(el.dataset.id, el.dataset.dir);
      App.render();
      openOrder();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  Events.onChange('product-stock-mode', (el) => {
    const qtyWrap = document.getElementById('stock-qty-wrap');
    const boolWrap = document.getElementById('stock-bool-wrap');
    if (qtyWrap) qtyWrap.classList.toggle('hidden', el.value !== 'qty');
    if (boolWrap) boolWrap.classList.toggle('hidden', el.value !== 'bool');
  });

  Events.onChange('shipping-mode', (el) => {
    const fixed = document.getElementById('shipping-fixed-wrap');
    const zones = document.getElementById('shipping-zones-wrap');
    const whatsapp = document.getElementById('shipping-whatsapp-wrap');
    if (fixed) fixed.classList.toggle('hidden', el.value !== 'fixed');
    if (zones) zones.classList.toggle('hidden', el.value !== 'zones');
    if (whatsapp) whatsapp.classList.toggle('hidden', el.value !== 'whatsapp');
  });

  Events.onAction('zone-add', () => {
    const rows = document.getElementById('zone-rows');
    if (!rows) return;
    rows.insertAdjacentHTML('beforeend', zoneRow());
    const added = rows.querySelector('[data-zone-row]:last-child input[name="zoneName"]');
    if (added) added.focus();
  });

  Events.onAction('zone-remove', (el) => {
    const row = el.closest('[data-zone-row]');
    if (row) row.remove();
  });

  Events.onSubmit('store-save', async (form) => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const whatsapp = Utils.digits(data.get('whatsapp'));
    const shippingMode = String(data.get('shippingMode') || 'fixed');
    const shippingCost = Number(data.get('shippingCost'));
    const zoneNames = data.getAll('zoneName');
    const zonePrices = data.getAll('zonePrice');
    const logo = String(data.get('logo') || '').trim();
    const tagline = String(data.get('tagline') || '').trim();
    const open = String(data.get('open') || 'open') === 'open';

    if (!name) return Utils.toast('Tu tienda necesita un nombre.', 'error');
    if (whatsapp.length < 8) return Utils.toast('Captura un WhatsApp válido con código de país.', 'error');
    if (!['fixed', 'zones', 'whatsapp'].includes(shippingMode)) return Utils.toast('Elige una forma válida de cobrar el delivery.', 'error');
    if (!Number.isFinite(shippingCost) || shippingCost < 0) return Utils.toast('El precio del delivery no es válido.', 'error');
    if (!isHttpUrl(logo)) return Utils.toast('La URL de la foto debe empezar con http:// o https://', 'error');

    const shippingZones = [];
    const seenZones = [];
    for (let index = 0; index < zoneNames.length; index += 1) {
      const zoneName = String(zoneNames[index] || '').trim();
      const rawPrice = String(zonePrices[index] ?? '').trim();
      if (!zoneName && !rawPrice) continue;
      const price = Number(rawPrice);
      if (zoneName.length < 2) return Utils.toast('Cada zona necesita un nombre de al menos 2 caracteres.', 'error');
      if (!Number.isFinite(price) || price < 0) return Utils.toast(`El precio de la zona “${zoneName}” no es válido.`, 'error');
      const normalized = Utils.normalize(zoneName);
      if (seenZones.includes(normalized)) return Utils.toast(`La zona “${zoneName}” está repetida.`, 'error');
      seenZones.push(normalized);
      shippingZones.push({ name: zoneName, price: Math.floor(price) });
    }
    if (shippingMode === 'zones' && shippingZones.length === 0) {
      return Utils.toast('Agrega al menos una zona de delivery.', 'error');
    }

    try {
      await Store.updateBusinessProfile(session.businessSlug, {
        name, whatsapp, shippingMode, shippingCost, shippingZones, logo, tagline, open
      });
      Utils.toast('Datos de la tienda actualizados.');
      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  Events.onSubmit('categories-save', async (form) => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;
    const business = Store.business(session.businessSlug);
    if (!business) return;

    const data = new FormData(form);
    const renames = [];
    const targets = [];
    const normalizedTargets = [];
    const previousOrder = categoriesOf(business);

    for (const [key, value] of data.entries()) {
      if (!key.startsWith('cat::')) continue;
      const from = key.slice(5);
      const to = String(value).trim();
      if (!to) return Utils.toast('Las categorías no pueden quedar vacías.', 'error');
      const normalized = Utils.normalize(to);
      if (normalizedTargets.includes(normalized)) return Utils.toast(`La categoría “${to}” está repetida.`, 'error');
      normalizedTargets.push(normalized);
      targets.push(to);
      if (from !== to) renames.push([from, to]);
    }

    if (!targets.length) return Utils.toast('No hay categorías para guardar.', 'error');
    const changedOrder = targets.some((category, index) => category !== previousOrder[index]);

    try {
      for (const [from, to] of renames) {
        await Store.renameCategory(business.slug, from, to);
      }
      await Store.saveCategoryOrder(business.slug, targets);
      if (renames.length) Storefront.CatalogState.category = 'Todas';
      Utils.toast(renames.length || changedOrder ? 'Categorías actualizadas.' : 'No hubo cambios.');
      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  Events.onSubmit('product-save', async (form) => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;

    const data = new FormData(form);
    const id = String(data.get('id') || '');
    const name = String(data.get('name') || '').trim();
    const category = String(data.get('category') || '').trim();
    const price = Number(data.get('price'));
    const mode = String(data.get('stockMode') || 'qty');
    const images = [];
    const seenImages = new Set();

    if (!name) return Utils.toast('El producto necesita un nombre.', 'error');
    if (!Number.isFinite(price) || price <= 0) return Utils.toast('Indica un precio mayor a cero.', 'error');
    if (!category) return Utils.toast('Indica una categoría.', 'error');

    for (const rawImage of data.getAll('imageUrl')) {
      const image = String(rawImage || '').trim();
      if (!image) continue;
      if (!isHttpUrl(image)) return Utils.toast('Cada imagen debe empezar con http:// o https://', 'error');
      if (image.length > 1000) return Utils.toast('Una de las imágenes tiene una URL demasiado larga.', 'error');
      if (seenImages.has(image)) return Utils.toast('No repitas la misma imagen en un producto.', 'error');
      seenImages.add(image);
      images.push(image);
    }
    if (images.length > 8) return Utils.toast('Puedes agregar hasta 8 imágenes por producto.', 'error');

    const stock = mode === 'bool'
      ? data.get('available') === 'on'
      : Math.max(0, Math.floor(Number(data.get('qty')) || 0));

    const payload = { name, category, price, image: images[0] || '', images, stock };

    try {
      if (id) {
        const existing = Store.product(id);
        if (!existing || existing.businessSlug !== session.businessSlug) {
          return Utils.toast('No puedes editar productos de otro comercio.', 'error');
        }
        await Store.updateProduct(id, payload);
        Utils.toast('Producto actualizado.');
      } else {
        await Store.createProduct({ businessSlug: session.businessSlug, ...payload });
        Utils.toast('Producto publicado en tu catálogo.');
      }

      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  Events.onSubmit('product-delete', async (form) => {
    const session = Auth.current();
    if (!session || session.role !== 'owner') return;

    const id = String(new FormData(form).get('id') || '');
    const product = Store.product(id);
    if (!product || product.businessSlug !== session.businessSlug) {
      return Utils.toast('No puedes eliminar productos de otro comercio.', 'error');
    }

    try {
      await Store.deleteProduct(id);
      Utils.toast('Producto eliminado.');
      Utils.closeModal();
      App.render();
    } catch (error) {
      Utils.toast(error.message, 'error');
    }
  });

  return { toolbar, openProduct, openSettings, openCategories, openOrder, openAnalytics };
})();

/* Cerrar sesión (compartido por panel y modo edición) */
Events.onAction('logout', async () => {
  await Auth.logout();
  Utils.closeModal();
  Utils.toast('Sesión cerrada.');
  App.go('');
});
