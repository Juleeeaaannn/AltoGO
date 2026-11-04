/* ==========================================================================
   AltoGO · Router + arranque de la aplicación
   --------------------------------------------------------------------------
   Rutas soportadas:
     /                o  #/                     → inicio
     ?negocio=slug     o  #/negocio/slug          → catálogo
     /ingreso          o  #/ingreso   (?login)    → acceso oculto
     /admin            o  #/admin                 → panel super admin

   La navegación interna usa hash (#/…) para funcionar también en hosting
   estático (GitHub Pages, file://). Al entrar directamente por /ingreso o
   ?negocio= también se resuelve, y en Vercel se reescribe a index.html.
   ========================================================================== */

const App = (() => {
  let lastTrackedKey = null;
  let lastViewKey = null;

  /* ---------- Parsing de ruta ---------- */

  const parseRoute = () => {
    const url = new URL(window.location.href);
    const hash = url.hash.replace(/^#\/?/, '');
    const segments = hash.split('/').filter(Boolean).map((part) => {
      try { return decodeURIComponent(part); } catch { return part; }
    });
    const params = url.searchParams;

    // 1) Hash (navegación interna y enlaces compartidos modernos)
    if (segments[0] === 'negocio' && segments[1]) return { name: 'negocio', slug: segments[1] };
    if (segments[0] === 'ingreso' || segments[0] === 'login') return { name: 'login' };
    if (segments[0] === 'admin') return { name: 'admin' };

    // Si ya hay un hash (aunque sea #/), manda sobre query/pathname. Evita que
    // un ?negocio= inicial siga ganando después de navegar a otra vista.
    if (url.hash.startsWith('#')) return { name: 'home' };

    // 2) Query params (compatibilidad / enlaces directos)
    if (params.get('negocio')) return { name: 'negocio', slug: params.get('negocio') };
    if (params.has('login')) return { name: 'login' };
    if (params.get('panel') === 'admin' || params.get('admin') === '1') return { name: 'admin' };

    // 3) Pathname (Vercel rewrite / servidor con fallback)
    const path = url.pathname.replace(/\/+$/, '');
    if (/\/(ingreso|login)$/.test(path)) return { name: 'login' };
    if (/\/admin$/.test(path)) return { name: 'admin' };

    return { name: 'home' };
  };

  /* ---------- Navegación ---------- */

  const go = (path) => {
    const clean = String(path || '').replace(/^#\/?/, '').replace(/\/+$/, '');
    const target = `${window.location.pathname}#/${clean}`;
    try {
      window.history.pushState(null, '', target);
    } catch {
      window.location.hash = `#/${clean}`;
      return;
    }
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };

  /* ---------- Analítica de visitas (una por entrada de ruta) ---------- */

  const trackRouteEnter = (route, session) => {
    const key = `${route.name}:${route.slug || ''}`;
    if (key === lastTrackedKey) return;

    const isOwner = !!session && session.role === 'owner' && session.businessSlug === route.slug;
    const isSuper = !!session && session.role === 'super';
    lastTrackedKey = key;

    if (route.name === 'home') {
      Store.trackVisit(null);
      return;
    }

    if (route.name === 'negocio') {
      const business = Store.business(route.slug);
      // El panel y el modo edición no inflan las métricas.
      if (business && business.status !== 'oculto' && business.open && !isOwner && !isSuper) {
        Store.trackVisit(business.slug);
      }
    }
  };

  /* ---------- Render ---------- */

  const render = () => {
    const app = document.getElementById('app');
    if (!app) return;

    const route = parseRoute();
    const session = Auth.current();

    // Limpia query params heredados en cuanto la navegación pasa a usar hash.
    if (window.location.search && window.location.hash) {
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      } catch { /* noop */ }
    }

    // Al cambiar de vista se descartan modales abiertos de la vista anterior.
    const viewKey = `${route.name}:${route.slug || ''}`;
    if (viewKey !== lastViewKey) {
      lastViewKey = viewKey;
      Utils.closeModal();
    }

    trackRouteEnter(route, session);

    // Limpia el modo edición en cada render; el catálogo lo reactiva.
    document.body.classList.remove('owner-mode');

    if (route.name === 'login') {
      if (session) {
        go(session.role === 'super' ? 'admin' : `negocio/${session.businessSlug}`);
        return;
      }
      LoginView.setError('');
      app.innerHTML = LoginView.render();
      return;
    }

    if (route.name === 'admin') {
      if (!session || session.role !== 'super') {
        LoginView.setError(
          session
            ? 'Esta cuenta no tiene permisos de super administrador.'
            : 'Inicia sesión para continuar.'
        );
        app.innerHTML = LoginView.render();
        return;
      }
      app.innerHTML = AdminView.render();
      return;
    }

    if (route.name === 'negocio') {
      const business = Store.business(route.slug);
      if (business && Auth.isOwnerOf(business.slug)) {
        document.body.classList.add('owner-mode');
      }
      app.innerHTML = Storefront.catalog(route);
      return;
    }

    app.innerHTML = Storefront.home();
  };

  const scheduleRender = () => {
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  /* ---------- Arranque ---------- */

  const init = async () => {
    Events.bind();

    window.addEventListener('hashchange', scheduleRender);
    window.addEventListener('popstate', scheduleRender);

    try {
      await Auth.init();
      render();
    } catch (error) {
      console.error('[AltoGO] No se pudo iniciar la aplicación.', error);
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = `
          <div class="grid min-h-[100dvh] place-items-center bg-ink px-5 text-white">
            <div class="w-full max-w-md rounded-3xl bg-white p-7 text-ink shadow-2xl">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Servicio no disponible</p>
              <h1 class="mt-2 font-display text-2xl font-semibold">No pudimos cargar el catálogo</h1>
              <p class="mt-2 text-sm leading-relaxed text-moss">${Utils.esc(error.message || 'Revisa la conexión e intenta de nuevo.')}</p>
              <a href="/" class="mt-5 flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">Reintentar</a>
            </div>
          </div>`;
      }
    }
  };

  return { render, go, init, parseRoute };
})();

App.init();
