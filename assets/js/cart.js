/* ==========================================================================
   AltoGO · Carrito + checkout por WhatsApp
   --------------------------------------------------------------------------
   - El carrito se guarda por negocio en localStorage: altogo.v1.cart.<slug>
   - Cada operación revalida el stock actual del producto (los dueños pueden
     editarlo en cualquier momento desde su panel).
   - El checkout NO pide dirección: genera un mensaje de WhatsApp que incluye
     el detalle, el envío y el recordatorio de adjuntar la ubicación actual.
   ========================================================================== */

const Cart = (() => {
  // Contexto actual (solo existe dentro de un catálogo, fuera del modo dueño)
  let context = { slug: null, ownerMode: false };
  let items = [];              // [{ productId, qty }]
  let customer = { name: '', notes: '', payment: '', zoneId: '' };
  let isOpen = false;

  /* ---------- Persistencia ---------- */

  const storageKey = (slug) => ALTOGO.storage.key(`cart.${slug}`);

  const persist = () => {
    if (!context.slug) return;
    try {
      localStorage.setItem(storageKey(context.slug), JSON.stringify({ items, customer }));
    } catch {
      /* noop: seguimos en memoria */
    }
  };

  const hydrate = (slug) => {
    items = [];
    customer = { name: '', notes: '', payment: '', zoneId: '' };
    try {
      const raw = localStorage.getItem(storageKey(slug));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.items)) {
        items = parsed.items
          .filter((item) => item && typeof item.productId === 'string')
          .map((item) => ({
            productId: item.productId,
            qty: Math.max(1, Math.floor(Number(item.qty) || 1))
          }));
      }
      if (parsed.customer) {
        customer = {
          name: String(parsed.customer.name || ''),
          notes: String(parsed.customer.notes || ''),
          payment: ['efectivo', 'transferencia'].includes(parsed.customer.payment) ? parsed.customer.payment : '',
          zoneId: String(parsed.customer.zoneId || '')
        };
      }
    } catch {
      /* carrito corrupto → se empieza vacío */
    }
  };

  /* ---------- Consultas ---------- */

  const currentBusiness = () => (context.slug ? Store.business(context.slug) : null);

  const count = () => items.reduce((sum, item) => sum + item.qty, 0);

  const qtyOf = (productId) => {
    const item = items.find((entry) => entry.productId === productId);
    return item ? item.qty : 0;
  };

  const totals = () => {
    const business = currentBusiness();
    const subtotal = items.reduce((sum, item) => {
      const product = Store.product(item.productId);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
    const info = Store.deliveryInfo(business);
    const zone = info.mode === 'zones'
      ? info.zones.find((entry) => entry.id === customer.zoneId) || null
      : null;
    const shipping = info.mode === 'whatsapp'
      ? 0
      : info.mode === 'zones'
        ? (zone ? Number(zone.price) || 0 : 0)
        : info.amount;
    return {
      subtotal,
      shipping,
      total: subtotal + shipping,
      mode: info.mode,
      zone,
      shippingKnown: info.mode !== 'zones' || Boolean(zone)
    };
  };

  /* ---------- Validación de stock ---------- */

  /**
   * Sincroniza el carrito con el stock real:
   * elimina productos agotados/borrados y recorta cantidades por encima del stock.
   * Devuelve true si hubo cambios.
   */
  const reconcile = () => {
    let changed = false;
    const next = [];

    items.forEach((item) => {
      const product = Store.product(item.productId);
      if (!product || product.businessSlug !== context.slug) {
        changed = true;
        return;
      }
      const stock = Store.stock(product);
      if (!stock.available) {
        changed = true;
        return;
      }
      let qty = Math.min(item.qty, stock.exact ? stock.qty : ALTOGO.maxQtyPerItem);
      if (qty < 1) {
        changed = true;
        return;
      }
      if (qty !== item.qty) changed = true;
      next.push({ productId: item.productId, qty });
    });

    if (changed) {
      items = next;
      persist();
    }
    return changed;
  };

  /* ---------- Mutaciones ---------- */

  const add = (product) => {
    if (!product) return { ok: false, message: 'Producto no encontrado.' };

    const stock = Store.stock(product);
    if (!stock.available) return { ok: false, message: 'Ese producto está agotado.' };

    const item = items.find((entry) => entry.productId === product.id);
    const nextQty = (item ? item.qty : 0) + 1;

    if (stock.exact && nextQty > stock.qty) {
      return {
        ok: false,
        message: stock.qty === 1 ? 'Solo queda 1 unidad disponible.' : `Solo quedan ${stock.qty} unidades.`
      };
    }
    if (nextQty > ALTOGO.maxQtyPerItem) {
      return { ok: false, message: `Máximo ${ALTOGO.maxQtyPerItem} unidades por producto.` };
    }

    if (item) item.qty = nextQty;
    else items.push({ productId: product.id, qty: 1 });

    persist();
    render();
    return { ok: true };
  };

  const setQty = (productId, qty) => {
    const item = items.find((entry) => entry.productId === productId);
    if (!item) return;
    const product = Store.product(productId);
    if (!product) return;

    const stock = Store.stock(product);
    let next = Math.floor(Number(qty) || 0);

    if (next <= 0) {
      items = items.filter((entry) => entry.productId !== productId);
    } else {
      const max = stock.exact ? stock.qty : ALTOGO.maxQtyPerItem;
      next = Math.min(next, max);
      if (stock.exact && next > stock.qty) {
        Utils.toast(stock.qty === 1 ? 'Solo queda 1 unidad disponible.' : `Solo quedan ${stock.qty} unidades.`, 'warning');
      }
      item.qty = next;
    }

    persist();
    render();
  };

  const remove = (productId) => {
    items = items.filter((entry) => entry.productId !== productId);
    persist();
    render();
  };

  const clear = () => {
    items = [];
    if (context.slug) {
      try {
        localStorage.removeItem(storageKey(context.slug));
      } catch {
        /* noop */
      }
    }
    persist();
    render();
  };

  const saveCustomer = (patch) => {
    customer = { ...customer, ...patch };
    persist();
  };

  /* ---------- Enlace de WhatsApp ---------- */

  const buildMessage = (business) => {
    const { subtotal, shipping, total, mode, zone } = totals();
    const paymentLabel = customer.payment === 'transferencia' ? 'Transferencia' : 'Efectivo';
    const lines = [
      ` *_PEDIDO ${ALTOGO.brand.name} - ${business.name}_*`,
      '',
      '*Detalle del pedido:*'
    ];

    items.forEach((item, index) => {
      const product = Store.product(item.productId);
      if (!product) return;
      lines.push(
         `${item.qty} × ${product.name} — ${Utils.money(product.price)} = ${Utils.money(product.price * item.qty)}`
      );
    });

    if (mode === 'zones' && zone) lines.push(`Zona de entrega: *${zone.name}*`);
    if (mode === 'whatsapp') {
      lines.push(
        'Delivery: *A coordinar por WhatsApp*',
        '*—————————————*',
        `_*TOTAL PRODUCTOS: ${Utils.money(subtotal)}*_`,
        '_El costo del delivery se acuerda en el chat._'
      );
    } else {
      lines.push(
        `Envío - ${shipping > 0 ? Utils.money(shipping) : 'Gratis'}`,
        '*—————————————*',
        `_*TOTAL: ${Utils.money(total)}*_`
      );
    }

    lines.push(
      '',
      `Pago: *${paymentLabel}*`,
      `Cliente: *${customer.name.trim()}*`,
      customer.notes.trim() ? `📝 Observaciones: ${customer.notes.trim()}` : null,
      '',
      'Ubicacion: *El cliente adjunta su ubicacion.*',
      '',
      '¡Gracias por tu compra!'
    );

    return lines.filter((line) => line !== null).join('\n');
  };

  const waLink = (business, message) => {
    let phone = Utils.digits(business.whatsapp);
    // Si solo capturaron 10 dígitos, asumimos ARGENTINA (54).
    if (phone.length === 10) phone = '54' + phone;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  /**
   * Valida y "envía" el pedido.
   * Devuelve { ok, url } o { ok:false, message }.
   */
  const submitOrder = async () => {
    const business = currentBusiness();
    if (!business) return { ok: false, message: 'El comercio no está disponible.' };
    if (business.status === 'oculto' || !business.open) return { ok: false, message: 'Este comercio está cerrado en este momento.' };
    if (!items.length) return { ok: false, message: 'Tu carrito está vacío.' };

    const name = customer.name.trim();
    if (!name) return { ok: false, message: 'Escribe tu nombre para continuar.' };
    if (!['efectivo', 'transferencia'].includes(customer.payment)) {
      return { ok: false, message: 'Elige cómo vas a pagar: efectivo o transferencia.' };
    }

    if (reconcile()) {
      render();
      return { ok: false, message: 'Actualizamos tu pedido por cambios de stock. Revisa las cantidades.' };
    }

    const summary = totals();
    if (summary.mode === 'zones' && !summary.zone) {
      return { ok: false, message: 'Elige tu zona de entrega para continuar.' };
    }

    const message = buildMessage(business);
    const url = waLink(business, message);

    if (Backend.enabled) {
      try {
        await Backend.createOrder({
          p_business_slug: business.slug,
          p_customer_name: name,
          p_notes: customer.notes.trim(),
          p_payment: customer.payment,
          p_items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
          p_shipping_zone: summary.zone ? summary.zone.id : null
        });
        try {
          await Store.refresh();
        } catch (refreshError) {
          console.warn('[AltoGO] Pedido guardado; no se pudo refrescar el catálogo.', refreshError);
        }
      } catch (error) {
        return { ok: false, message: error.message || 'No se pudo registrar el pedido. Intenta de nuevo.' };
      }
    } else {
      // En demo, guardamos el pedido en localStorage para las analíticas locales.
      Store.trackWhatsappClick(business.slug);
      Store.recordDemoOrder({
        businessSlug: business.slug,
        customerName: name,
        payment: customer.payment,
        items: items.map((item) => {
          const product = Store.product(item.productId);
          return {
            productId: item.productId,
            name: product ? product.name : '',
            price: product ? product.price : 0,
            qty: item.qty
          };
        }),
        subtotal: summary.subtotal,
        shipping: summary.shipping,
        total: summary.total,
        shippingMode: summary.mode,
        shippingZone: summary.zone ? summary.zone.name : ''
      });
    }

    // Se vacía el carrito del negocio pero se conserva el nombre del cliente.
    const previousCustomer = { ...customer };
    items = [];
    try {
      localStorage.removeItem(storageKey(business.slug));
    } catch {
      /* noop */
    }
    customer = { name: previousCustomer.name, notes: '', payment: '', zoneId: '' };
    persist();
    isOpen = false;
    render();

    return { ok: true, url, businessName: business.name };
  };

  /* ---------- Pintado del carrito ---------- */

  const mediaThumb = (product) => {
    if (product.image) {
      return `<img src="${Utils.esc(product.image)}" alt="" class="h-full w-full object-contain p-1" loading="lazy" />`;
    }
    return `<div class="art h-full w-full" style="${Utils.artStyle(product.category)}"><span class="art-emoji text-2xl">${Utils.artEmoji(product.category)}</span></div>`;
  };

  const barHTML = () => {
    const business = currentBusiness();
    if (!business || context.ownerMode || !items.length) return '';
    const { total, mode, shippingKnown } = totals();
    const totalLabel = mode === 'whatsapp'
      ? `${Utils.money(total)} + delivery`
      : !shippingKnown
        ? `${Utils.money(total)} + envío`
        : Utils.money(total);

    return `
      <button type="button" data-action="open-cart" aria-label="Ver mi pedido"
        class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-white shadow-[0_24px_50px_-20px_rgba(11,21,17,.75)] transition active:scale-[.99] sm:bottom-6"
        style="bottom: calc(1rem + env(safe-area-inset-bottom));">
        <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
          ${Utils.icon('bag', 'h-5 w-5')}
          <span class="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink">${count()}</span>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[10px] uppercase tracking-wider text-white/50">Tu pedido</span>
          <span class="block truncate text-sm font-semibold tabular">${count()} ${count() === 1 ? 'artículo' : 'artículos'} · ${totalLabel}</span>
        </span>
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime text-ink">${Utils.icon('forward', 'h-4 w-4')}</span>
      </button>`;
  };

  const itemHTML = (item) => {
    const product = Store.product(item.productId);
    if (!product) return '';
    const stock = Store.stock(product);
    const max = stock.exact ? stock.qty : ALTOGO.maxQtyPerItem;
    const lineTotal = product.price * item.qty;

    return `
      <article class="flex gap-3 rounded-2xl border border-ink/5 bg-white p-3">
        <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">${mediaThumb(product)}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <h3 class="line-clamp-2 text-sm font-semibold leading-snug">${Utils.esc(product.name)}</h3>
            <button type="button" data-action="cart-remove" data-id="${product.id}" aria-label="Quitar ${Utils.esc(product.name)}"
              class="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-moss transition hover:bg-rose-50 hover:text-rose-600">
              ${Utils.icon('trash', 'h-4 w-4')}
            </button>
          </div>
          <p class="mt-0.5 text-[11px] text-moss">${Utils.money(product.price)} c/u</p>
          <div class="mt-2 flex items-center justify-between gap-2">
            <div class="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-cream p-1">
              <button type="button" data-action="cart-dec" data-id="${product.id}" aria-label="Quitar una unidad"
                class="grid h-7 w-7 place-items-center rounded-full text-ink transition hover:bg-white">${Utils.icon('minus', 'h-3.5 w-3.5')}</button>
              <span class="w-7 text-center text-sm font-semibold tabular">${item.qty}</span>
              <button type="button" data-action="cart-inc" data-id="${product.id}" aria-label="Agregar una unidad" ${item.qty >= max ? 'disabled' : ''}
                class="grid h-7 w-7 place-items-center rounded-full text-ink transition hover:bg-white disabled:opacity-30">${Utils.icon('plus', 'h-3.5 w-3.5')}</button>
            </div>
            <span class="text-sm font-semibold tabular">${Utils.money(lineTotal)}</span>
          </div>
        </div>
      </article>`;
  };

  const drawerHTML = () => {
    if (!isOpen) return '';
    const business = currentBusiness();
    if (!business) return '';
    const { subtotal, shipping, total, mode, zone, shippingKnown } = totals();
    const zones = Store.deliveryInfo(business).zones;

    const body = items.length
      ? `
        <div class="space-y-3">${items.map(itemHTML).join('')}</div>

        <section class="mt-4 rounded-2xl border border-ink/5 bg-white p-4">
          <h3 class="font-display text-sm font-semibold">Datos del pedido</h3>
          <form id="checkout-form" data-form="checkout" class="mt-3 space-y-3">
            <label class="block">
              <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-moss">Nombre</span>
              <input name="name" data-input="checkout-name" value="${Utils.esc(customer.name)}" required maxlength="80" autocomplete="name"
                placeholder="¿Cómo te llamas?" class="w-full rounded-xl border border-ink/10 bg-cream/60 px-3 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-white" />
            </label>
            <label class="block">
              <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-moss">Observaciones <span class="font-normal normal-case text-moss/70">(opcional)</span></span>
              <textarea name="notes" rows="2" maxlength="500" data-input="checkout-notes" placeholder="Referencias, horario, timbre…"
                class="w-full resize-none rounded-xl border border-ink/10 bg-cream/60 px-3 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-white">${Utils.esc(customer.notes)}</textarea>
            </label>

            ${mode === 'zones' ? `<label class="block">
              <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-moss">Zona de entrega</span>
              <select name="zoneId" data-change="checkout-zone" required
                class="w-full rounded-xl border border-ink/10 bg-cream/60 px-3 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-white">
                <option value="">Elige tu zona</option>
                ${zones.map((item) => `<option value="${Utils.esc(item.id)}" ${customer.zoneId === item.id ? 'selected' : ''}>${Utils.esc(item.name)} — ${Utils.money(item.price)}</option>`).join('')}
              </select>
            </label>` : ''}

            ${mode === 'whatsapp' ? `<div class="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-900">
              <span class="mt-0.5 shrink-0">${Utils.icon('whatsapp', 'h-4 w-4')}</span>
              <p class="text-[11px] leading-relaxed"><strong>El delivery se cobra por WhatsApp.</strong> Al enviar el pedido, el comercio coordina el costo según tu ubicación.</p>
            </div>` : ''}

            <fieldset>
              <legend class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-moss">Forma de pago</legend>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink/20">
                  <input type="radio" name="payment" value="efectivo" data-change="checkout-payment" class="h-4 w-4 accent-[#0B1511]" ${customer.payment === 'efectivo' ? 'checked' : ''} />
                  <span class="font-medium">Efectivo</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink/20">
                  <input type="radio" name="payment" value="transferencia" data-change="checkout-payment" class="h-4 w-4 accent-[#0B1511]" ${customer.payment === 'transferencia' ? 'checked' : ''} />
                  <span class="font-medium">Transferencia</span>
                </label>
              </div>
            </fieldset>
          </form>
        </section>

        <div class="mt-3 flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
          <span class="mt-0.5 shrink-0">${Utils.icon('pin', 'h-4 w-4')}</span>
          <p class="text-[11px] leading-relaxed">
            <strong>No pedimos dirección.</strong> Al confirmar se abrirá WhatsApp y deberás <strong>adjuntar tu ubicación actual</strong> para que el comercio pueda entregarte.
          </p>
        </div>
      `
      : `
        <div class="grid place-items-center py-16 text-center">
          <span class="grid h-16 w-16 place-items-center rounded-full bg-white text-moss ring-1 ring-ink/5">${Utils.icon('bag', 'h-7 w-7')}</span>
          <p class="mt-4 font-display text-lg font-semibold">Tu carrito está vacío</p>
          <p class="mt-1 max-w-[16rem] text-xs text-moss">Agrega productos del catálogo y aparecerán aquí.</p>
          <button type="button" data-action="close-cart" class="mt-5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Seguir eligiendo</button>
        </div>`;

    return `
      <div class="fixed inset-0 z-[70]">
        <div class="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" data-action="close-cart"></div>
        <aside role="dialog" aria-modal="true" aria-label="Mi pedido"
          class="absolute right-0 top-0 flex h-[100dvh] w-full animate-drawer flex-col overflow-hidden bg-cream shadow-2xl sm:max-w-md sm:rounded-l-3xl">
          <header class="flex shrink-0 items-start justify-between gap-3 border-b border-ink/5 bg-white px-5 py-4">
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-moss">${Utils.esc(business.name)}</p>
              <h2 class="font-display text-xl font-semibold">Tu pedido</h2>
            </div>
            <button type="button" data-action="close-cart" aria-label="Cerrar carrito"
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-moss transition hover:bg-ink/5 hover:text-ink">
              ${Utils.icon('close', 'h-4 w-4')}
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">${body}</div>

          <div class="shrink-0 border-t border-ink/5 bg-white px-5 pt-3" style="padding-bottom: calc(1rem + env(safe-area-inset-bottom));">
            <dl class="space-y-1 text-sm">
              <div class="flex justify-between text-moss"><dt>Subtotal</dt><dd class="tabular">${Utils.money(subtotal)}</dd></div>
              <div class="flex justify-between text-moss"><dt>Envío</dt><dd class="tabular">${mode === 'whatsapp' ? 'A coordinar' : !shippingKnown ? 'Elige zona' : shipping > 0 ? Utils.money(shipping) : 'Gratis'}</dd></div>
              <div class="flex justify-between gap-3 pt-1 text-base font-semibold"><dt>${mode === 'whatsapp' ? 'Total productos' : 'Total'}</dt><dd class="tabular text-right">${mode === 'whatsapp' ? Utils.money(subtotal) : !shippingKnown ? `${Utils.money(subtotal)} + envío` : Utils.money(total)}</dd></div>
            </dl>
            <button type="submit" form="checkout-form" ${items.length ? '' : 'disabled'}
              class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1FA855] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#188C46] disabled:opacity-40">
              ${Utils.icon('whatsapp', 'h-5 w-5')} Enviar pedido por WhatsApp
            </button>
            <p class="mt-2 text-center text-[10px] leading-relaxed text-moss">${mode === 'whatsapp' ? 'El costo del delivery se acuerda por WhatsApp con el comercio.' : 'Pago y entrega se acuerdan directo con el comercio.'}</p>
          </div>
        </aside>
      </div>`;
  };

  const render = () => {
    const root = document.getElementById('cart-root');
    if (!root) return;
    const business = currentBusiness();
    if (!business || context.ownerMode) {
      root.innerHTML = '';
      document.body.classList.remove('overflow-hidden');
      return;
    }
    root.innerHTML = barHTML() + drawerHTML();
    // Evita el scroll del fondo mientras el carrito está abierto.
    document.body.classList.toggle('overflow-hidden', isOpen);
  };

  /* ---------- Contexto ---------- */

  const open = () => {
    if (!context.slug) return;
    const business = currentBusiness();
    const info = Store.deliveryInfo(business);
    if (info.mode === 'zones' && customer.zoneId && !info.zones.some((zone) => zone.id === customer.zoneId)) {
      customer.zoneId = '';
    }
    if (reconcile()) {
      Utils.toast('Ajustamos tu pedido por cambios de stock.', 'warning');
    }
    isOpen = true;
    render();
  };

  const close = () => {
    isOpen = false;
    render();
  };

  /** Llamado por la vista del catálogo. */
  const attach = (business, ownerMode = false) => {
    if (context.slug !== business.slug) {
      context = { slug: business.slug, ownerMode };
      hydrate(business.slug);
      isOpen = false;
    } else {
      context.ownerMode = ownerMode;
    }
    // El dueño editando no debe ver barra de compra.
    render();
  };

  /** Llamado al entrar al inicio, login o panel. */
  const detach = () => {
    context = { slug: null, ownerMode: false };
    items = [];
    isOpen = false;
    customer = { name: '', notes: '', payment: '', zoneId: '' };
    render();
  };

  /* ---------- Eventos ---------- */

  Events.onAction('open-cart', () => open());
  Events.onAction('close-cart', () => close());

  Events.onAction('cart-inc', (el) => {
    const product = Store.product(el.dataset.id);
    if (product) add(product);
  });

  Events.onAction('cart-dec', (el) => {
    const productId = el.dataset.id;
    setQty(productId, qtyOf(productId) - 1);
  });

  Events.onAction('cart-remove', (el) => {
    remove(el.dataset.id);
    Utils.toast('Producto quitado del pedido.');
  });

  Events.onInput('checkout-name', (el) => saveCustomer({ name: el.value }));
  Events.onInput('checkout-notes', (el) => saveCustomer({ notes: el.value }));
  Events.onChange('checkout-payment', (el) => saveCustomer({ payment: el.value }));
  Events.onChange('checkout-zone', (el) => {
    const scrollBody = document.querySelector('aside .overflow-y-auto');
    const scrollTop = scrollBody ? scrollBody.scrollTop : 0;
    saveCustomer({ zoneId: el.value });
    render();
    const nextBody = document.querySelector('aside .overflow-y-auto');
    if (nextBody) nextBody.scrollTop = scrollTop;
  });

  Events.onSubmit('checkout', async (form) => {
    const data = new FormData(form);
    saveCustomer({
      name: String(data.get('name') || ''),
      notes: String(data.get('notes') || ''),
      payment: String(data.get('payment') || ''),
      zoneId: String(data.get('zoneId') || '')
    });

    const result = await submitOrder();
    if (!result.ok) {
      Utils.toast(result.message, 'error');
      return;
    }

    // Si el navegador bloquea la pestaña, el modal de éxito incluye el enlace.
    const win = window.open(result.url, '_blank');
    if (win) {
      try { win.opener = null; } catch { /* noop */ }
    } else {
      Utils.toast('Permite ventanas emergentes para abrir WhatsApp.', 'warning');
    }

    Utils.openModal({
      title: 'Pedido listo 🎉',
      subtitle: result.businessName,
      body: `
        <div class="space-y-4 text-center">
          <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">${Utils.icon('whatsapp', 'h-7 w-7')}</span>
          <div>
            <p class="font-display text-lg font-semibold">Tu pedido está en WhatsApp</p>
            <p class="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-moss">
              Adjunta tu <strong>ubicación actual</strong> en el chat para que el comercio pueda entregarte.
            </p>
          </div>
          <div class="flex flex-col gap-2">
            <a href="${result.url}" target="_blank" rel="noopener"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1FA855] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#188C46]">
              ${Utils.icon('whatsapp', 'h-5 w-5')} Abrir WhatsApp de nuevo
            </a>
            <button type="button" data-action="modal-close" class="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream">
              Seguir comprando
            </button>
          </div>
        </div>`
    });
  });

  return { attach, detach, render, open, close, add, setQty, remove, clear, reconcile, count, qtyOf, totals, submitOrder };
})();
