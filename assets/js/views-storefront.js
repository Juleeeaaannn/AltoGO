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

  const productImages = (product) => {
    const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    if (!images.length && product.image) images.push(product.image);
    return images.slice(0, 8);
  };

  const productGallery = (product) => {
    const images = productImages(product);
    if (images.length <= 1) {
      return `<div class="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div class="aspect-[4/3] w-full">${productMedia(product, 'text-6xl sm:text-7xl')}</div>
      </div>`;
    }

    return `
      <div class="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div data-gallery data-index="0" data-count="${images.length}">
          <div class="relative aspect-[4/3] w-full overflow-hidden bg-white">
            ${images.map((image, index) => `
              <img data-gallery-slide="${index}" src="${Utils.esc(image)}" alt="${Utils.esc(product.name)} — imagen ${index + 1}"
                class="absolute inset-0 h-full w-full object-contain p-1.5 transition-opacity duration-200 ${index === 0 ? 'opacity-100' : 'pointer-events-none opacity-0'}" />`).join('')}

            <button type="button" data-action="gallery-prev" aria-label="Imagen anterior"
              class="absolute left-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-ink/5 bg-white/90 text-ink shadow-sm backdrop-blur transition hover:bg-white">
              ${Utils.icon('back', 'h-4 w-4')}
            </button>
            <button type="button" data-action="gallery-next" aria-label="Imagen siguiente"
              class="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-ink/5 bg-white/90 text-ink shadow-sm backdrop-blur transition hover:bg-white">
              ${Utils.icon('forward', 'h-4 w-4')}
            </button>
            <span data-gallery-counter class="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-semibold tabular text-white backdrop-blur">1 / ${images.length}</span>
          </div>

          <div class="flex items-center justify-center gap-1.5 px-3 py-2.5">
            ${images.map((_, index) => `
              <button type="button" data-action="gallery-dot" data-index="${index}" aria-label="Ir a la imagen ${index + 1}"
                class="h-2 rounded-full transition-all ${index === 0 ? 'w-5 bg-ink' : 'w-2 bg-ink/20'}"></button>`).join('')}
          </div>
        </div>
      </div>`;
  };

  /* Hero del comercio: banner de fondo a pantalla completa + datos encima. */
  const businessHero = (business, ownerMode) => {
    const images = Array.isArray(business.bannerImages) ? business.bannerImages.slice(0, 8) : [];
    const multiple = images.length > 1;
    const status = Utils.openMeta(business.open);
    const schedule = String(business.schedule || '').trim();
    const productCount = Store.products(business.slug).length;
    const [from, to] = hashTone(business.name);

    return `
      <section class="relative isolate -mx-4 aspect-[6/7] max-h-[700px] min-h-[450px] overflow-hidden bg-ink text-white sm:-mx-6 sm:aspect-[16/9] sm:min-h-[400px] lg:aspect-[13/5]" data-banner>
        ${images.length ? `
          <div data-banner-track data-count="${images.length}" class="banner-track no-scrollbar absolute inset-0 h-full w-full">
            ${images.map((image, index) => `
              <div class="banner-slide h-full">
                <img src="${Utils.esc(image)}" alt="${Utils.esc(business.name)} — banner ${index + 1}"
                  class="h-full w-full object-cover" loading="${index === 0 ? 'eager' : 'lazy'}" />
              </div>`).join('')}
          </div>` : `
          <div class="absolute inset-0" style="background-image: linear-gradient(145deg, ${from}, ${to});">
            <span class="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"></span>
          </div>`}

        <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10"></div>
        <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/55 to-transparent"></div>

        <div class="relative z-10 flex h-full flex-col justify-end px-4 pb-4 pt-20 sm:px-6 sm:pb-6">
          <div class="flex items-end gap-3 sm:gap-4">
            <div class="shrink-0 rounded-2xl shadow-xl ring-2 ring-white/50">
              ${logoMark(business, 'h-14 w-14 sm:h-20 sm:w-20', 'text-lg sm:text-2xl')}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="truncate font-display text-2xl font-semibold drop-shadow sm:text-4xl">${Utils.esc(business.name)}</h1>
                <span class="rounded-full px-2.5 py-1 text-[10px] font-bold ${status.cls}">${status.label}</span>
              </div>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-white/85 drop-shadow sm:text-sm">${Utils.esc(business.tagline || 'Productos a domicilio')}</p>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-1.5 text-[10px] font-medium sm:text-[11px]">
            ${schedule ? `<span class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20 backdrop-blur">
              ${Utils.icon('clock', 'h-3.5 w-3.5 shrink-0')}<span class="truncate">${Utils.esc(schedule)}</span>
            </span>` : ''}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20 backdrop-blur">${Utils.icon('bag', 'h-3.5 w-3.5')} ${Store.deliveryLabel(business)}</span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20 backdrop-blur">${productCount} ${productCount === 1 ? 'producto' : 'productos'}</span>
          </div>

          ${multiple ? `<div class="mt-3 flex items-center gap-1">
            ${images.map((_, index) => `
              <button type="button" data-action="banner-dot" data-index="${index}" aria-label="Ir al banner ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"
                class="h-2 rounded-full transition-all ${index === 0 ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}"></button>`).join('')}
          </div>` : ''}
        </div>

        ${multiple ? `
          <button type="button" data-action="banner-prev" aria-label="Banner anterior"
            class="absolute left-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-ink/40 text-white shadow-sm backdrop-blur transition hover:bg-ink/70 sm:left-4">
            ${Utils.icon('back', 'h-4 w-4')}
          </button>
          <button type="button" data-action="banner-next" aria-label="Banner siguiente"
            class="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-ink/40 text-white shadow-sm backdrop-blur transition hover:bg-ink/70 sm:right-4">
            ${Utils.icon('forward', 'h-4 w-4')}
          </button>` : ''}

        ${ownerMode ? `
          <button type="button" data-action="owner-settings" class="absolute right-3 top-16 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-ink/50 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-ink/75 sm:top-20">
            ${Utils.icon(images.length ? 'edit' : 'plus', 'h-3.5 w-3.5')} ${images.length ? 'Editar banner' : 'Agregar banner'}
          </button>` : ''}
      </section>`;
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
      const schedule = String(business.schedule || '').trim();
      return `
        <a href="/negocio/${encodeURIComponent(business.slug)}"
          class="group flex min-w-0 items-center gap-3 rounded-2xl border border-ink/5 bg-white p-3.5 transition duration-200 hover:border-ink/15 hover:shadow-[0_16px_35px_-26px_rgba(11,21,17,.5)] sm:gap-4 sm:p-4">
          ${logoMark(business, 'h-12 w-12 sm:h-14 sm:w-14', 'text-sm sm:text-base')}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate font-display text-[15px] font-semibold leading-tight sm:text-base">${Utils.esc(business.name)}</h3>
            </div>
            <p class="mt-0.5 truncate text-[11px] text-moss sm:text-xs">${Utils.esc(business.tagline || 'Productos a domicilio')}</p>
            ${schedule ? `<p class="mt-1 flex items-center gap-1 truncate text-[10px] text-moss sm:text-[11px]">
              ${Utils.icon('clock', 'h-3 w-3 shrink-0')}<span class="truncate">${Utils.esc(schedule)}</span>
            </p>` : ''}
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-moss sm:text-[11px]">
              <span>${productCount} ${productCount === 1 ? 'producto' : 'productos'}</span>
              <span class="h-1 w-1 rounded-full bg-ink/15"></span>
              <span>${Store.deliveryLabel(business)}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            <span class="rounded-full px-2.5 py-1 text-[10px] font-bold ${status.cls}">${status.label}</span>
            <span class="grid h-8 w-8 place-items-center rounded-full bg-[#F4F5F7] text-ink transition group-hover:bg-lime">
              ${Utils.icon('forward', 'h-3.5 w-3.5')}
            </span>
          </div>
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
              <span class="inline">¿Quieres sumar tu negocio?</span> 
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
  const productCard = (product, ownerMode, extraClass = '') => {
    const stock = Store.stock(product);
    const offer = Store.discount(product);
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
        class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-[0_1px_0_rgba(11,21,17,.03)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card ${ownerMode ? 'ring-1 ring-blue-300/80 hover:ring-2 hover:ring-blue-400' : ''} ${extraClass}">
        <div class="relative aspect-[4/3] overflow-hidden bg-white">
          ${productMedia(product)}
          <div class="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
            ${offer ? `<span class="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">-${offer.percent}%</span>` : ''}
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${stockBadge}">${stock.label}</span>
          </div>
          ${ownerMode
            ? `<span class="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow-md">${Utils.icon('edit', 'h-4 w-4')}</span>`
            : `<button type="button" data-action="add-to-cart" data-id="${product.id}" ${stock.available ? '' : 'disabled'}
                aria-label="${stock.available ? 'Agregar' : 'Sin stock'} ${Utils.esc(product.name)}" title="${stock.available ? 'Agregar al pedido' : 'Sin stock'}"
                class="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full shadow-lg ring-2 ring-white/90 transition ${stock.available ? 'bg-emerald-600 text-white hover:scale-105 hover:bg-emerald-700 active:scale-95' : 'cursor-not-allowed bg-ink/30 text-white/80'}">
                ${Utils.icon('plus', 'h-6 w-6')}
              </button>`}
        </div>
        <div class="flex flex-1 flex-col p-3.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-moss/70">${Utils.esc(product.category)}</span>
          <h3 class="mt-1 line-clamp-2 text-sm font-semibold leading-snug">${Utils.esc(product.name)}</h3>
          <div class="mt-auto flex w-full flex-wrap items-end justify-between gap-2">
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <span class="whitespace-nowrap font-display text-base font-semibold tabular sm:text-lg">${Utils.money(product.price)}</span>
              ${offer ? `<span class="text-[11px] font-medium text-moss/60 line-through">${Utils.money(offer.oldPrice)}</span>` : ''}
            </div>
            ${ownerMode
              ? `<span class="inline-flex shrink-0 items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-2 text-[11px] font-semibold text-blue-700">Editar</span>`
              : ''}
          </div>
          ${!ownerMode && inCart > 0 ? `<p class="mt-2 text-[10px] font-medium text-emerald-700">${inCart} en tu pedido</p>` : ''}
        </div>
      </article>`;
  };

  const filteredProducts = (business) => {
    const query = Utils.normalize(CatalogState.query);
    return Store.catalogProducts(business.slug).filter((product) => {
      const matchesCategory = CatalogState.category === 'Todas' || product.category === CatalogState.category;
      const haystack = Utils.normalize(`${product.name} ${product.category}`);
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });
  };

  const productGroups = (business) => {
    const groups = [];
    filteredProducts(business).forEach((product) => {
      let group = groups.find((item) => item.category === product.category);
      if (!group) {
        group = { category: product.category, products: [] };
        groups.push(group);
      }
      group.products.push(product);
    });
    return groups;
  };

  const categoriesOf = (business) => Store.categoriesOf(business.slug);

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
    const groups = productGroups(business);
    if (!groups.length) {
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

    const showHeadings = CatalogState.category === 'Todas';
    if (!showHeadings) return groups[0].products.map((product) => productCard(product, ownerMode)).join('');

    return groups.map((group, groupIndex) => {
      const trackId = `category-track-${groupIndex}`;
      const canScroll = group.products.length > 1;
      return `<section class="col-span-full">
        <div class="flex items-end justify-between gap-3 border-b border-ink/5 pb-1.5 pt-2 first:pt-0">
          <h3 class="font-display text-base font-semibold">${Utils.esc(group.category)}</h3>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-medium text-moss">${group.products.length} ${group.products.length === 1 ? 'producto' : 'productos'}</span>
            ${canScroll ? `<div class="flex items-center gap-1">
              <button type="button" data-action="catalog-carousel" data-target="${trackId}" data-dir="-1"
                aria-label="Productos anteriores de ${Utils.esc(group.category)}" title="Anterior"
                class="grid h-8 w-8 place-items-center rounded-full border border-ink/10 bg-white text-ink transition hover:border-ink/20 hover:bg-[#F4F5F7]">
                ${Utils.icon('back', 'h-3.5 w-3.5')}
              </button>
              <button type="button" data-action="catalog-carousel" data-target="${trackId}" data-dir="1"
                aria-label="Productos siguientes de ${Utils.esc(group.category)}" title="Siguiente"
                class="grid h-8 w-8 place-items-center rounded-full border border-ink/10 bg-white text-ink transition hover:border-ink/20 hover:bg-[#F4F5F7]">
                ${Utils.icon('forward', 'h-3.5 w-3.5')}
              </button>
            </div>` : ''}
          </div>
        </div>
        <div id="${trackId}" class="category-track no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-2">
          ${group.products.map((product) => productCard(product, ownerMode, 'category-card')).join('')}
        </div>
      </section>`;
    }).join('');
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
    requestAnimationFrame(() => syncCatalogHeader());

    return `
      <div class="min-h-screen bg-white">
        <!-- Barra superior: "Atrás" siempre visible -->
        <header id="catalog-header" class="catalog-header fixed inset-x-0 top-0 z-40  border-transparent">
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
                 <span class="rounded-full bg-white/90 px-2.5 py-1 font-display text-2xl font-bold tracking-tight text-[#00197D] shadow-sm backdrop-blur">Alto<span class="text-[#FF2F35] italic">GO</span></span>` : ''}
            </div>
          </div>
        </header>

        <main class="mx-auto max-w-6xl px-4 pb-32 sm:px-6 sm:pb-24">
          ${businessHero(business, ownerMode)}

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

  Events.onAction('catalog-carousel', (el) => {
    const track = document.getElementById(el.dataset.target || '');
    if (!track) return;
    const card = track.querySelector('.category-card');
    const step = card ? card.getBoundingClientRect().width + 12 : track.clientWidth * 0.8;
    track.scrollBy({ left: Number(el.dataset.dir || 1) * step });
  });

  const updateBannerDots = (track, forcedIndex = null) => {
    if (!track) return;
    const count = Number(track.dataset.count) || 0;
    const index = forcedIndex === null
      ? (count ? Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) : 0)
      : forcedIndex;
    track.parentElement.querySelectorAll('[data-action="banner-dot"]').forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle('w-5', active);
      dot.classList.toggle('bg-white', active);
      dot.classList.toggle('w-2', !active);
      dot.classList.toggle('bg-white/55', !active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const syncCatalogHeader = () => {
    const header = document.getElementById('catalog-header');
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };

  window.addEventListener('scroll', syncCatalogHeader, { passive: true });

  const goToBanner = (track, index) => {
    if (!track) return;
    const count = Number(track.dataset.count) || 1;
    const next = ((index % count) + count) % count;
    updateBannerDots(track, next);
    track.scrollTo({ left: next * track.clientWidth });
  };

  Events.onAction('banner-prev', (el) => {
    const track = el.closest('[data-banner]')?.querySelector('[data-banner-track]');
    if (!track) return;
    goToBanner(track, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) - 1);
  });

  Events.onAction('banner-next', (el) => {
    const track = el.closest('[data-banner]')?.querySelector('[data-banner-track]');
    if (!track) return;
    goToBanner(track, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) + 1);
  });

  Events.onAction('banner-dot', (el) => {
    const track = el.closest('[data-banner]')?.querySelector('[data-banner-track]');
    goToBanner(track, Number(el.dataset.index) || 0);
  });

  document.addEventListener('scroll', (event) => {
    const track = event.target;
    if (track && track.matches && track.matches('[data-banner-track]')) updateBannerDots(track);
  }, true);

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
    const offer = Store.discount(product);
    const stockCls = stock.available
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';

    Utils.openModal({
      title: product.name,
      subtitle: product.category,
      size: 'lg',
      body: `
        ${productGallery(product)}
        <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">Precio</p>
            <div class="flex flex-wrap items-baseline gap-2">
              <p class="font-display text-3xl font-semibold tabular">${Utils.money(product.price)}</p>
              ${offer ? `<p class="text-sm font-medium text-moss/60 line-through">${Utils.money(offer.oldPrice)}</p>` : ''}
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${stockCls}">${stock.label}</span>
              ${offer ? `<span class="inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">-${offer.percent}% de descuento</span>` : ''}
            </div>
          </div>
          <button type="button" data-action="product-modal-add" data-id="${product.id}" ${stock.available ? '' : 'disabled'}
            class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${stock.available ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-ink/5 text-moss'}">
            ${Utils.icon('plus', 'h-4 w-4')} ${stock.available ? 'Agregar al pedido' : 'Sin stock'}
          </button>
        </div>
        <p class="mt-4 rounded-xl bg-[#F4F5F7] px-3.5 py-3 text-[11px] leading-relaxed text-moss">
          Puedes ajustar la cantidad desde el carrito. El pedido se coordina por WhatsApp con el comercio.
        </p>`
    });
  });

  const moveGallery = (gallery, index) => {
    if (!gallery) return;
    const count = Number(gallery.dataset.count) || 0;
    if (count < 2) return;
    const next = ((index % count) + count) % count;
    gallery.dataset.index = String(next);

    gallery.querySelectorAll('[data-gallery-slide]').forEach((slide, slideIndex) => {
      slide.classList.toggle('opacity-100', slideIndex === next);
      slide.classList.toggle('pointer-events-none', slideIndex !== next);
      slide.classList.toggle('opacity-0', slideIndex !== next);
    });
    gallery.querySelectorAll('[data-action="gallery-dot"]').forEach((dot, dotIndex) => {
      dot.classList.toggle('w-5', dotIndex === next);
      dot.classList.toggle('bg-ink', dotIndex === next);
      dot.classList.toggle('w-2', dotIndex !== next);
      dot.classList.toggle('bg-ink/20', dotIndex !== next);
      if (dotIndex === next) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    const counter = gallery.querySelector('[data-gallery-counter]');
    if (counter) counter.textContent = `${next + 1} / ${count}`;
  };

  Events.onAction('gallery-prev', (el) => {
    const gallery = el.closest('[data-gallery]');
    if (gallery) moveGallery(gallery, Number(gallery.dataset.index) - 1);
  });

  Events.onAction('gallery-next', (el) => {
    const gallery = el.closest('[data-gallery]');
    if (gallery) moveGallery(gallery, Number(gallery.dataset.index) + 1);
  });

  Events.onAction('gallery-dot', (el) => {
    const gallery = el.closest('[data-gallery]');
    if (gallery) moveGallery(gallery, Number(el.dataset.index));
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
