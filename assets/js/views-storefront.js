/* ==========================================================================
   AltoGO · Vistas públicas
   - Home: listado de comercios visibles.
   - Catálogo: encabezado del negocio, buscador, filtros y grid de productos.
   - El modo "dueño" reutiliza el catálogo (con acentos ámbar) para editar.
   ========================================================================== */

const Storefront = (() => {
  /* Filtros activos del catálogo (se conservan al repintar por edición) */
  const CatalogState = { slug: null, query: '', category: 'Todas' };

  const LOGO_TONES = [
    ['#132019', '#2F5E3F'],
    ['#1F2937', '#0F766E'],
    ['#3B1E16', '#92400E'],
    ['#1E1B4B', '#4338CA'],
    ['#3F1D38', '#9D174D']
  ];

  const hashTone = (text) => {
    let hash = 0;
    for (let i = 0; i < String(text).length; i += 1) {
      hash = (hash * 31 + String(text).charCodeAt(i)) % 997;
    }
    return LOGO_TONES[hash % LOGO_TONES.length];
  };

  /* Avatar del comercio: imagen si existe, si no iniciales sobre degradado. */
  const logoMark = (business, size = 'h-14 w-14', textSize = 'text-lg') => {
    if (business.logo) {
      return `<img src="${Utils.esc(business.logo)}" alt="Logo de ${Utils.esc(business.name)}"
        class="${size} shrink-0 rounded-2xl object-cover ring-1 ring-black/5" loading="lazy" />`;
    }
    const [from, to] = hashTone(business.name);
    return `<span class="${size} grid shrink-0 place-items-center rounded-2xl font-display font-bold text-white shadow-inner"
      style="background-image: linear-gradient(145deg, ${from}, ${to});">${Utils.initials(business.name)}</span>`;
  };

  const productMedia = (product, emojiCls = 'text-4xl sm:text-5xl') => {
    if (product.image) {
      return `<img src="${Utils.esc(product.image)}" alt="${Utils.esc(product.name)}"
        class="h-full w-full object-contain p-1.5" loading="lazy" />`;
    }
    return `<div class="art h-full w-full" style="${Utils.artStyle(product.category)}">
      <span class="art-emoji ${emojiCls}">${Utils.artEmoji(product.category)}</span>
    </div>`;
  };

  /* ------------------------------------------------------------------------
     HOME
     ------------------------------------------------------------------------ */
  const home = () => {
    document.title = `${ALTOGO.brand.name} · ${ALTOGO.brand.tagline}`;
    Cart.detach();

    const businesses = Store.listedBusinesses();

    const card = (business) => {
      const productCount = Store.productCountOf(business);
      const status = Utils.openMeta(business.open);
      const isOpen = business.open;
      return `
        <a href="/negocio/${encodeURIComponent(business.slug)}"
          class="group flex min-w-0 items-center gap-3 rounded-2xl border border-ink/5 bg-white p-3.5 transition duration-200 hover:border-ink/15 hover:shadow-[0_16px_35px_-26px_rgba(11,21,17,.5)] sm:gap-4 sm:p-4">
          ${logoMark(business, 'h-12 w-12 sm:h-14 sm:w-14', 'text-sm sm:text-base')}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate font-display text-[15px] font-semibold leading-tight sm:text-base">${Utils.esc(business.name)}</h3>
              ${isOpen ? '' : `<span class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${status.cls}">${status.label}</span>`}
            </div>
            <p class="mt-0.5 truncate text-[11px] text-moss sm:text-xs">${Utils.esc(business.tagline || 'Productos a domicilio')}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-moss sm:text-[11px]">
              <span>${productCount} ${productCount === 1 ? 'producto' : 'productos'}</span>
              <span class="h-1 w-1 rounded-full bg-ink/15"></span>
              <span>${Store.deliveryLabel(business)}</span>
              ${isOpen ? '<span class="hidden items-center gap-1 sm:inline-flex"><span class="h-1 w-1 rounded-full bg-emerald-500"></span> Abierto</span>' : ''}
            </div>
          </div>
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F4F5F7] text-ink transition group-hover:bg-lime">
            ${Utils.icon('forward', 'h-3.5 w-3.5')}
          </span>
        </a>`;
    };

    return `
      <div class="min-h-screen bg-white">
        <!-- Header público (sin accesos administrativos) -->
        <header class="sticky top-0 z-40 border-b border-ink/5 bg-white/90 backdrop-blur-xl">
          <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <a href="/" class="flex items-center gap-2.5">
              
              <span class="font-display text-2xl font-bold tracking-tight text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span>

            </a>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[11px] font-medium text-moss">
              ${Utils.icon('whatsapp', 'h-3.5 w-3.5 text-[#1FA855]')}
              <span class="hidden sm:inline">¿Quieres sumar tu negocio?</span> 
              <a href="https://wa.me/5492646238873" target="_blank" rel="noopener noreferrer" class="font-semibold text-ink underline underline-offset-2">Escribinos</a>
          </div>
        </header>

        <main class="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
          <!-- Hero compacto -->
          <section class="relative overflow-hidden rounded-2xl bg-[#00197D] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div class="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-lime/15 blur-3xl"></div>
            <div class="relative max-w-2xl">
              <h1 class="font-display text-3xl font-semibold leading-tight sm:text-5xl">
                Tus productos favoritos, a un <span class="text-lime">WhatsApp</span>.
              </h1>
              <p class="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
                Elige un comercio, arma tu pedido y envía tu ubicación por WhatsApp.
              </p>
              <div class="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
                <span class="rounded-full bg-white/10 px-3 py-1.5">Envío local</span>
              </div>
            </div>
          </section>

          <!-- Comercios -->
          <section id="comercios" class="mt-8 scroll-mt-24">
            <div class="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 class="font-display text-2xl font-semibold">Comercios disponibles</h2>
                <p class="mt-1 text-xs text-moss">Toca un comercio para ver su catálogo completo.</p>
              </div>
              <span class="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-moss ring-1 ring-ink/5">${businesses.length} en total</span>
            </div>
            <div class="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              ${businesses.map(card).join('')}
            </div>
          </section>
        </main>

        ${publicFooter()}
      </div>`;
  };

  const publicFooter = () => `
    <footer class="border-t border-ink/5 bg-white">
      <div class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-[11px] text-moss sm:flex-row sm:items-center sm:px-6">
        <p><span class="font-display text-sm font-semibold text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span> · ${ALTOGO.brand.tagline}</p>
        <p>Pedidos y entregas coordinados por WhatsApp con cada comercio.</p>
      </div>
    </footer>`;

  /* ------------------------------------------------------------------------
     CATÁLOGO
     ------------------------------------------------------------------------ */
  const productCard = (product, ownerMode) => {
    const stock = Store.stock(product);
    const inCart = Cart.qtyOf(product.id);
    const stockBadge = stock.available
      ? (stock.exact && stock.qty <= 3
        ? 'bg-amber-400/95 text-amber-950'
        : 'bg-white/90 text-emerald-800')
      : 'bg-rose-600/95 text-white';

    const cardAttrs = ownerMode
      ? `data-action="edit-product" data-id="${product.id}" tabindex="0" role="button" aria-label="Editar ${Utils.esc(product.name)}"`
      : `data-action="product-view" data-id="${product.id}" tabindex="0" role="button" aria-label="Ver ${Utils.esc(product.name)}"`;

    return `
      <article ${cardAttrs}
        class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-[0_1px_0_rgba(11,21,17,.03)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card ${ownerMode ? 'ring-1 ring-blue-300/80 hover:ring-2 hover:ring-blue-400' : ''}">
        <div class="relative aspect-[4/3] overflow-hidden bg-white">
          ${productMedia(product)}
          <span class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${stockBadge}">${stock.label}</span>
          ${ownerMode ? `<span class="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow-md">${Utils.icon('edit', 'h-4 w-4')}</span>` : ''}
        </div>
        <div class="flex flex-1 flex-col p-3.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-moss/70">${Utils.esc(product.category)}</span>
          <h3 class="mt-1 line-clamp-2 text-sm font-semibold leading-snug">${Utils.esc(product.name)}</h3>
          <div class="mt-auto flex items-end justify-between gap-2 pt-3">
            <span class="font-display text-lg font-semibold tabular">${Utils.money(product.price)}</span>
            ${ownerMode
              ? `<span class="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-2 text-[11px] font-semibold text-blue-700">Editar</span>`
              : `<button type="button" data-action="add-to-cart" data-id="${product.id}" ${stock.available ? '' : 'disabled'}
                  class="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${stock.available ? 'bg-ink text-white hover:bg-ink-700' : 'cursor-not-allowed bg-ink/5 text-moss'}">
                  ${Utils.icon('plus', 'h-3.5 w-3.5')} ${stock.available ? 'Agregar' : 'Sin stock'}
                </button>`}
          </div>
          ${!ownerMode && inCart > 0 ? `<p class="mt-2 text-[10px] font-medium text-emerald-700">${inCart} en tu pedido</p>` : ''}
        </div>
      </article>`;
  };

  const filteredProducts = (business) => {
    const query = Utils.normalize(CatalogState.query);
    return Store.products(business.slug).filter((product) => {
      const matchesCategory = CatalogState.category === 'Todas' || product.category === CatalogState.category;
      const haystack = Utils.normalize(`${product.name} ${product.category}`);
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });
  };

  const categoriesOf = (business) => {
    const present = Array.from(new Set(Store.products(business.slug).map((p) => p.category)));
    const order = Object.keys(ALTOGO.categories);
    return present.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'es');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  const chipsHTML = (business) => {
    const categories = categoriesOf(business);
    const chip = (label) => {
      const active = CatalogState.category === label;
      return `<button type="button" data-action="catalog-category" data-category="${Utils.esc(label)}"
        class="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? 'bg-ink text-white shadow-sm' : 'border border-ink/10 bg-white text-moss hover:border-ink/20 hover:text-ink'}">
        ${Utils.esc(label)}
      </button>`;
    };
    return [chip('Todas'), ...categories.map(chip)].join('');
  };

  const gridHTML = (business, ownerMode) => {
    const products = filteredProducts(business);
    if (!products.length) {
      return `<div class="col-span-full rounded-2xl border border-dashed border-ink/15 bg-white/60 px-6 py-14 text-center">
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-moss ring-1 ring-ink/5">${Utils.icon('search', 'h-6 w-6')}</span>
        <p class="mt-4 font-display text-base font-semibold">${CatalogState.query || CatalogState.category !== 'Todas' ? 'No encontramos ese producto' : 'Catálogo en preparación'}</p>
        <p class="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-moss">
          ${CatalogState.query || CatalogState.category !== 'Todas'
            ? 'Prueba con otra palabra o cambia de categoría.'
            : 'Este comercio todavía no publica productos.'}
        </p>
        ${ownerMode ? `<button type="button" data-action="new-product" class="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white">Agregar mi primer producto</button>` : ''}
      </div>`;
    }
    return products.map((product) => productCard(product, ownerMode)).join('');
  };

  const countLabel = (business) => {
    const shown = filteredProducts(business).length;
    const total = Store.products(business.slug).length;
    return shown === total ? `${total} ${total === 1 ? 'producto' : 'productos'}` : `${shown} de ${total} productos`;
  };

  /** Repinta solo los resultados (mantiene el foco del buscador). */
  const refreshResults = () => {
    const business = Store.business(CatalogState.slug);
    if (!business) return;
    const ownerMode = Auth.isOwnerOf(business.slug);

    const grid = document.getElementById('catalog-grid');
    const chips = document.getElementById('catalog-chips');
    const count = document.getElementById('catalog-count');
    if (grid) grid.innerHTML = gridHTML(business, ownerMode);
    if (chips) chips.innerHTML = chipsHTML(business);
    if (count) count.textContent = countLabel(business);
  };

  const catalog = (route) => {
    const business = Store.business(route.slug);
    if (!business) return notFound();

    const session = Auth.current();
    const ownerMode = !!session && session.role === 'owner' && session.businessSlug === business.slug;
    const superMode = !!session && session.role === 'super';

    // Un catálogo oculto no se muestra al público (solo dueño / super admin).
    if (business.status === 'oculto' && !ownerMode && !superMode) return unavailable(business);
    if (!business.open && !ownerMode && !superMode) return closed(business);

    if (CatalogState.slug !== business.slug) {
      CatalogState.slug = business.slug;
      CatalogState.query = '';
      CatalogState.category = 'Todas';
    }

    document.title = `${business.name} · ${ALTOGO.brand.name}`;
    Cart.attach(business, ownerMode);

    const products = Store.products(business.slug);
    const status = Utils.openMeta(business.open);

    return `
      <div class="min-h-screen bg-white">
        <!-- Barra superior: "Atrás" siempre visible -->
        <header class="sticky top-0 z-40 border-b border-ink/5 bg-white/90 backdrop-blur-xl">
          <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <a href="/" class="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1.5 pl-1.5 pr-3.5 text-xs font-semibold text-ink transition hover:border-ink/20 hover:bg-white">
              <span class="grid h-7 w-7 place-items-center rounded-full bg-cream">${Utils.icon('back', 'h-3.5 w-3.5')}</span>
              <span>Todos los comercios</span>
            </a>
            <div class="flex items-center gap-2">
              ${ownerMode ? `
                <span class="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-800 ring-1 ring-blue-200 sm:inline-flex">
                  ${Utils.icon('shield', 'h-3.5 w-3.5')} Modo edición
                </span>
                <button type="button" data-action="logout" class="grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white text-moss transition hover:text-ink" aria-label="Cerrar sesión" title="Cerrar sesión">
                  ${Utils.icon('logout', 'h-4 w-4')}
                </button>` : ''}
              ${superMode ? `
                <span class="hidden items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-lime sm:inline-flex">${Utils.icon('shield', 'h-3.5 w-3.5')} Super admin</span>
                <a href="/admin" class="grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white text-moss transition hover:text-ink" aria-label="Volver al panel" title="Volver al panel">
                  ${Utils.icon('chart', 'h-4 w-4')}
                </a>` : ''}
              ${!ownerMode && !superMode ? `
                 <span class="font-display text-2xl font-bold tracking-tight text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span>` : ''}
            </div>
          </div>
        </header>

        <main class="mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pb-24 sm:pt-6">
          <!-- Encabezado del negocio -->
          <section class="rounded-2xl border border-ink/5 bg-white p-5 sm:p-6">
            <div class="flex items-start gap-4">
              ${logoMark(business, 'h-14 w-14 sm:h-16 sm:w-16', 'text-lg sm:text-xl')}
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="truncate font-display text-2xl font-semibold sm:text-3xl">${Utils.esc(business.name)}</h1>
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}">${status.label}</span>
                </div>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-moss sm:text-sm">${Utils.esc(business.tagline || 'Productos a domicilio')}</p>
                <div class="mt-3 flex flex-wrap gap-1.5 text-[11px] text-moss">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-[#F4F5F7] px-2.5 py-1">${Utils.icon('bag', 'h-3.5 w-3.5')} ${Store.deliveryLabel(business)}</span>
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-[#F4F5F7] px-2.5 py-1">${products.length} ${products.length === 1 ? 'producto' : 'productos'}</span>
                </div>
              </div>
            </div>
          </section>

          ${ownerMode ? OwnerUI.toolbar(business) : ''}
          ${ownerMode && (business.status === 'oculto' || !business.open) ? `
            <div class="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <strong>Tu comercio está ${business.status === 'oculto' ? 'oculto' : 'cerrado'}.</strong>
              ${business.status === 'oculto'
                ? 'Los clientes no pueden ver el catálogo. Pídele al super administrador que lo publique.'
                : 'Los clientes ven el catálogo, pero no pueden enviar pedidos. Puedes abrirlo desde Mi tienda.'}
            </div>` : ''}

          <!-- Buscador + filtros -->
          <section class="mt-5">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="relative flex-1 sm:max-w-sm">
                <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-moss">${Utils.icon('search', 'h-4 w-4')}</span>
                <input id="catalog-search" data-input="catalog-search" value="${Utils.esc(CatalogState.query)}" type="search" inputmode="search"
                  placeholder="Buscar productos…" aria-label="Buscar productos"
                  class="w-full rounded-xl border border-ink/10 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-ink" />
                ${CatalogState.query ? `<button type="button" data-action="catalog-clear" class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-moss hover:bg-cream" aria-label="Limpiar búsqueda">${Utils.icon('close', 'h-3.5 w-3.5')}</button>` : ''}
              </div>
              <span id="catalog-count" class="text-[11px] font-medium text-moss sm:text-right">${countLabel(business)}</span>
            </div>
            <div id="catalog-chips" class="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">${chipsHTML(business)}</div>
          </section>

          <!-- Grid de productos -->
          <section class="mt-4">
            <div id="catalog-grid" class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              ${gridHTML(business, ownerMode)}
            </div>
          </section>

          ${ownerMode ? '' : `
            <div class="mt-8 flex gap-2.5 rounded-2xl border border-ink/5 bg-white/60 p-4 text-[11px] leading-relaxed text-moss">
              <span class="mt-0.5 shrink-0">${Utils.icon('pin', 'h-4 w-4')}</span>
              <p>Al confirmar tu pedido se abrirá WhatsApp con el detalle. <strong>Deberás adjuntar tu ubicación actual</strong> para coordinar la entrega con el comercio.</p>
            </div>`}
        </main>

        ${publicFooter()}
      </div>`;
  };

  /* ------------------------------------------------------------------------
     Estados especiales
     ------------------------------------------------------------------------ */
  const miniShell = (content) => `
    <div class="grid min-h-[100dvh] place-items-center bg-white px-4 py-10">
      <div class="w-full max-w-md">
        <div class="rounded-3xl border border-ink/5 bg-white p-7 text-center shadow-soft">
         <span class="font-display text-2xl font-bold tracking-tight text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span>
          ${content}
        </div>
        <p class="mt-5 text-center text-[11px] text-moss">AltoGO · ${ALTOGO.brand.tagline}</p>
      </div>
    </div>`;

  const backButton = `
    <a href="/" class="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white">
      ${Utils.icon('back', 'h-4 w-4')} Volver a todos los comercios
    </a>`;

  const notFound = () => {
    document.title = 'Comercio no encontrado · AltoGO';
    Cart.detach();
    return miniShell(`
      <p class="mt-4 font-display text-2xl font-semibold">Comercio no encontrado</p>
      <p class="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-moss">El enlace puede estar mal escrito o el comercio ya no existe.</p>
      ${backButton}`);
  };

  const unavailable = (business) => {
    document.title = 'Catálogo no disponible · AltoGO';
    Cart.detach();
    return miniShell(`
      <span class="mx-auto mt-4 grid h-12 w-12 place-items-center rounded-full bg-cream text-moss">${Utils.icon('eye', 'h-5 w-5')}</span>
      <p class="mt-3 font-display text-2xl font-semibold">Catálogo no disponible</p>
      <p class="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-moss">Este comercio no está publicado por ahora. Vuelve al inicio para ver los disponibles.</p>
      ${backButton}`);
  };

  const closed = (business) => {
    document.title = `${business.name} · Cerrado`;
    Cart.detach();
    return miniShell(`
      <span class="mx-auto mt-4 grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">${Utils.icon('alert', 'h-5 w-5')}</span>
      <p class="mt-3 font-display text-2xl font-semibold">${Utils.esc(business.name)} está cerrado</p>
      <p class="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-moss">Por ahora no recibe pedidos. Vuelve más tarde o revisa otros comercios.</p>
      ${backButton}`);
  };

  /* ------------------------------------------------------------------------
     Eventos de la vista pública
     ------------------------------------------------------------------------ */
  Events.onInput('catalog-search', (el) => {
    CatalogState.query = el.value;
    refreshResults();

    // El botón de limpiar aparece/desaparece; para evitar repintar el input
    // completo, basta con dejar el buscador como está y actualizar la grid.
    const wrapper = el.parentElement;
    if (wrapper) {
      const existing = wrapper.querySelector('[data-action="catalog-clear"]');
      if (el.value && !existing) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.action = 'catalog-clear';
        btn.setAttribute('aria-label', 'Limpiar búsqueda');
        btn.className = 'absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-moss hover:bg-cream';
        btn.innerHTML = Utils.icon('close', 'h-3.5 w-3.5');
        wrapper.appendChild(btn);
      } else if (!el.value && existing) {
        existing.remove();
      }
    }
  });

  Events.onAction('catalog-clear', () => {
    CatalogState.query = '';
    const input = document.getElementById('catalog-search');
    if (input) {
      input.value = '';
      input.focus();
    }
    refreshResults();
  });

  Events.onAction('catalog-category', (el) => {
    CatalogState.category = el.dataset.category || 'Todas';
    refreshResults();
  });

  Events.onAction('add-to-cart', (el) => {
    const product = Store.product(el.dataset.id);
    if (!product) return;
    const result = Cart.add(product);
    if (result.ok) {
      Utils.toast(`${product.name.split(' ').slice(0, 4).join(' ')} agregado a tu pedido.`, 'success');
    } else {
      Utils.toast(result.message, 'warning');
    }
  });

  /* ---------- Detalle del producto ---------- */

  Events.onAction('product-view', (el) => {
    const product = Store.product(el.dataset.id);
    if (!product) return;
    const stock = Store.stock(product);
    const stockCls = stock.available
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';

    Utils.openModal({
      title: product.name,
      subtitle: product.category,
      size: 'lg',
      body: `
        <div class="overflow-hidden rounded-2xl border border-ink/5 bg-white">
          <div class="aspect-[4/3] w-full">${productMedia(product, 'text-6xl sm:text-7xl')}</div>
        </div>
        <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Precio</p>
            <p class="font-display text-3xl font-semibold tabular">${Utils.money(product.price)}</p>
            <span class="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${stockCls}">${stock.label}</span>
          </div>
          <button type="button" data-action="product-modal-add" data-id="${product.id}" ${stock.available ? '' : 'disabled'}
            class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${stock.available ? 'bg-ink text-white hover:bg-ink-700' : 'cursor-not-allowed bg-ink/5 text-moss'}">
            ${Utils.icon('plus', 'h-4 w-4')} ${stock.available ? 'Agregar al pedido' : 'Sin stock'}
          </button>
        </div>
        <p class="mt-4 rounded-xl bg-[#F4F5F7] px-3.5 py-3 text-[11px] leading-relaxed text-moss">
          Puedes ajustar la cantidad desde el carrito. El pedido se coordina por WhatsApp con el comercio.
        </p>`
    });
  });

  Events.onAction('product-modal-add', (el) => {
    const product = Store.product(el.dataset.id);
    if (!product) return;
    const result = Cart.add(product);
    if (result.ok) {
      Utils.closeModal();
      Utils.toast(`${product.name.split(' ').slice(0, 4).join(' ')} agregado a tu pedido.`, 'success');
    } else {
      Utils.toast(result.message, 'warning');
    }
  });

  return { home, catalog, refreshResults, CatalogState };
})();
