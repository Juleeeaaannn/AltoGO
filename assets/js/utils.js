/* ==========================================================================
   AltoGO · Utilidades compartidas
   - Helpers de formato y sanitización (esc) para pintar HTML de forma segura.
   - Sistema de eventos delegados (Actions / Forms / Inputs) para no tener que
     reenganchar listeners cada vez que se repinta una vista.
   - Toasts y modales genéricos.
   - Set de iconos SVG inline (sin librerías externas).
   ========================================================================== */

const Utils = (() => {
  /* ---------- Texto / números ---------- */

  // Escapa cualquier texto dinámico antes de inyectarlo en HTML.
  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const money = (value) => {
    const n = Number(value) || 0;
    try {
      return new Intl.NumberFormat(ALTOGO.locale, {
        style: 'currency',
        currency: ALTOGO.currency,
        maximumFractionDigits: 0
      }).format(n);
    } catch {
      return '$' + n;
    }
  };

  const num = (value) => new Intl.NumberFormat(ALTOGO.locale).format(Number(value) || 0);

  const pct = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

  // Quita acentos y pasa a minúsculas: buscador más tolerante ("cafe" → "café").
  const normalize = (value) =>
    String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const slugify = (value) =>
    normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const digits = (value) => String(value ?? '').replace(/\D/g, '');

  const uid = (prefix = 'id') =>
    `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

  const initials = (name) =>
    String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

  const dateLabel = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(ALTOGO.locale, ALTOGO.localeOptions);
  };

  const debounce = (fn, delay = 200) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  /* ---------- Arte generado para productos ---------- */

  const categoryMeta = (category) =>
    ALTOGO.categories[category] || { emoji: '🥤', from: '#94A3B8', to: '#334155' };

  const artStyle = (category) => {
    const meta = categoryMeta(category);
    return `background-image: radial-gradient(135% 120% at 15% 0%, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 55%), linear-gradient(145deg, ${meta.from} 0%, ${meta.to} 100%);`;
  };

  const artEmoji = (category) => categoryMeta(category).emoji;

  /* ---------- Iconos ---------- */

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bag: '<path d="M6 7h12l-1.2 13H7.2L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    back: '<path d="M15 19l-7-7 7-7"/>',
    forward: '<path d="m9 5 7 7-7 7"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    top: '<path d="M5 4h14"/><path d="M12 20V8"/><path d="m7 13 5-5 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    logout: '<path d="M14 4h5v16h-5"/><path d="M15 12H5"/><path d="m9 8-4 4 4 4"/>',
    chart: '<path d="M4 20h16"/><path d="M7 20v-7M12 20V6M17 20v-10"/>',
    store: '<path d="M4 10h16"/><path d="M5 10V6h14v4"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
    pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M17 20a6 6 0 0 0-2-4.5"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    whatsapp: '<path fill="currentColor" stroke="none" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.33 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.13c-.24.68-1.4 1.3-1.94 1.35-.5.05-.98.23-3.3-.69-2.77-1.1-4.55-3.9-4.69-4.08-.14-.19-1.12-1.5-1.12-2.86 0-1.36.71-2.03.96-2.31.25-.28.55-.35.73-.35h.52c.17.01.39-.06.61.47.24.57.8 1.96.87 2.1.07.14.12.31.02.5-.1.19-.15.31-.29.47-.14.16-.3.35-.43.47-.14.14-.29.3-.12.58.16.28.73 1.2 1.57 1.95 1.08.96 1.99 1.26 2.27 1.4.28.14.44.12.6-.07.16-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.25.09 1.62.77 1.9.91.28.14.46.21.53.33.07.12.07.68-.17 1.35Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };

  const icon = (name, cls = 'h-5 w-5') => {
    const paths = ICONS[name] || '';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  };

  /* ---------- Toasts ---------- */

  const toast = (message, tone = 'default') => {
    const root = document.getElementById('toast-root');
    if (!root) return;

    const tones = {
      default: 'bg-ink text-white',
      success: 'bg-ink text-white',
      warning: 'bg-amber-500 text-amber-950',
      error: 'bg-rose-600 text-white'
    };
    const icons = { default: 'check', success: 'check', warning: 'alert', error: 'alert' };

    const el = document.createElement('div');
    el.className = `toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-soft ${tones[tone] || tones.default}`;
    el.innerHTML = `<span class="mt-0.5 shrink-0 opacity-80">${icon(icons[tone] || 'check', 'h-4 w-4')}</span><span class="leading-snug">${esc(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .2s ease, transform .2s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 220);
    }, 3200);
  };

  /* ---------- Modales genéricos ---------- */

  const modalRoot = () => document.getElementById('modal-root');

  const openModal = ({ title = '', subtitle = '', body = '', size = 'md' }) => {
    const root = modalRoot();
    if (!root) return;
    const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
    root.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
        <div class="absolute inset-0 bg-ink/60 backdrop-blur-[3px]" data-action="modal-close"></div>
        <div class="relative flex max-h-[92dvh] w-full ${widths[size] || widths.md} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-pop sm:rounded-3xl" role="dialog" aria-modal="true">
          <div class="flex shrink-0 items-start justify-between gap-4 border-b border-ink/5 px-5 py-4 sm:px-6">
            <div class="min-w-0">
              <h2 class="font-display text-lg font-semibold leading-tight">${esc(title)}</h2>
              ${subtitle ? `<p class="mt-1 text-xs text-moss">${esc(subtitle)}</p>` : ''}
            </div>
            <button type="button" data-action="modal-close" aria-label="Cerrar" class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-moss transition hover:bg-ink/5 hover:text-ink">
              ${icon('close', 'h-4 w-4')}
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6" data-modal-body>${body}</div>
        </div>
      </div>`;
    document.body.classList.add('overflow-hidden');
    const firstField = root.querySelector('[data-modal-body] input:not([type=hidden]), [data-modal-body] select, [data-modal-body] textarea');
    if (firstField) setTimeout(() => firstField.focus({ preventScroll: true }), 60);
  };

  const closeModal = () => {
    const root = modalRoot();
    if (!root) return;
    root.innerHTML = '';
    document.body.classList.remove('overflow-hidden');
  };

  /* ---------- Fechas de analíticas / textos auxiliares ---------- */

  const statusMeta = (status) => ({
    activo: { label: 'Activo', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    inactivo: { label: 'Cerrado', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
    oculto: { label: 'Oculto', cls: 'bg-ink/5 text-moss ring-1 ring-ink/10' }
  }[status] || { label: status, cls: 'bg-ink/5 text-moss' });

  const openMeta = (isOpen) => (isOpen
    ? { label: 'Abierto', cls: 'bg-emerald-500 text-white shadow-sm' }
    : { label: 'Cerrado', cls: 'bg-rose-600 text-white shadow-sm' });

  return {
    esc, money, num, pct, normalize, slugify, digits, uid, initials, dateLabel, debounce,
    categoryMeta, artStyle, artEmoji, icon, toast, openModal, closeModal, statusMeta, openMeta
  };
})();

/* ==========================================================================
   Sistema de eventos delegados
   Las vistas se repintan constantemente; en lugar de re-enganchar listeners,
   cada módulo registra handlers por nombre y el documento los despacha.
   ========================================================================== */

const Events = (() => {
  const actions = new Map();
  const changes = new Map();
  const inputs = new Map();
  const submits = new Map();

  const onAction = (name, fn) => actions.set(name, fn);
  const onChange = (name, fn) => changes.set(name, fn);
  const onInput = (name, fn) => inputs.set(name, fn);
  const onSubmit = (name, fn) => submits.set(name, fn);

  const bind = () => {
    // Navegación SPA para enlaces internos limpios (sin recargar la página).
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      if (event.target.closest('[data-action]')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!/^\/(?:negocio(?:\/|$)|ingreso\/?$|login\/?$|admin\/?$)/.test(url.pathname) && url.pathname !== '/') return;
      event.preventDefault();
      App.go(url.pathname);
    });

    // Clics: el elemento más cercano con [data-action] gana (botones internos > tarjeta).
    document.addEventListener('click', (event) => {
      const host = event.target.closest && event.target.closest('[data-action]');
      if (!host) return;
      const fn = actions.get(host.dataset.action);
      if (fn) fn(host, event);
    });

    document.addEventListener('change', (event) => {
      const host = event.target.closest && event.target.closest('[data-change]');
      if (!host) return;
      const fn = changes.get(host.dataset.change);
      if (fn) fn(host, event);
    });

    document.addEventListener('input', (event) => {
      const host = event.target.closest && event.target.closest('[data-input]');
      if (!host) return;
      const fn = inputs.get(host.dataset.input);
      if (fn) fn(host, event);
    });

    document.addEventListener('submit', (event) => {
      const form = event.target.closest && event.target.closest('form[data-form]');
      if (!form) return;
      event.preventDefault();
      const fn = submits.get(form.dataset.form);
      if (fn) fn(form, event);
    });

    // Cerrar modal con Escape.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') Utils.closeModal();
    });
  };

  return { onAction, onChange, onInput, onSubmit, bind };
})();

// Cerrar modales con el botón de la cabecera / backdrop.
Events.onAction('modal-close', () => Utils.closeModal());
