/* ==========================================================================
   AltoGO · Router + arranque de la aplicación
   --------------------------------------------------------------------------
   Rutas soportadas:
     /                     → inicio
     /negocio/slug         → catálogo
     /ingreso  (/login)    → acceso oculto
     /admin                → panel super admin

   Los enlaces viejos con hash (#/negocio/slug, #/ingreso) o query
   (?negocio=slug, ?login) se redirigen una vez a la URL limpia. Vercel
   reescribe estas rutas a index.html para que funcionen al recargar.
   ========================================================================== */

const App = (() => {
  let lastTrackedKey = null;
  let lastViewKey = null;
  let routeRequest = 0;

  /* ---------- Parsing de ruta ---------- */

  const decodeSegment = (part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  };

  const normalizeLegacyUrl = () => {
    const url = new URL(window.location.href);
    let target = null;

    if (url.hash) {
      const hash = url.hash.replace(/^#\/?/, '').split('?')[0];
      const segments = hash.split('/').filter(Boolean).map(decodeSegment);
      if (segments[0] === 'negocio' && segments[1]) {
        target = `/negocio/${encodeURIComponent(segments[1])}`;
      } else if (segments[0] === 'ingreso' || segments[0] === 'login') {
        target = '/ingreso';
      } else if (segments[0] === 'admin') {
        target = '/admin';
      } else {
        target = '/';
      }
    } else if (url.search) {
      const params = url.searchParams;
      if (params.get('negocio')) {
        target = `/negocio/${encodeURIComponent(params.get('negocio'))}`;
      } else if (params.has('login')) {
        target = '/ingreso';
      } else if (params.get('panel') === 'admin' || params.get('admin') === '1') {
        target = '/admin';
      }
    }

    if (target) {
      try { window.history.replaceState(null, '', target); } catch { /* noop */ }
    }
  };

  const parseRoute = () => {
    const url = new URL(window.location.href);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeSegment);

    // Rutas limpias.
    if (segments[0] === 'negocio' && segments[1]) return { name: 'negocio', slug: segments[1] };
    if (segments[0] === 'ingreso' || segments[0] === 'login') return { name: 'login' };
    if (segments[0] === 'admin') return { name: 'admin' };

    return { name: 'home' };
  };

  /* ---------- Navegación ---------- */

  const go = (path) => {
    const clean = String(path || '').replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
    const segments = clean.split('/').filter(Boolean).map((part) => encodeURIComponent(decodeSegment(part)));
    const target = segments.length ? `/${segments.join('/')}` : '/';
    try {
      window.history.pushState(null, '', target);
    } catch {
      window.location.assign(target);
      return;
    }
    renderRoute();
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

  const routeView = (route, session) => {
    if (route.name === 'login') return null;
    if (route.name === 'admin') {
      return session && session.role === 'super'
        ? { scope: 'admin', slug: null }
        : null;
    }
    if (route.name === 'negocio') return { scope: 'business', slug: route.slug };
    return { scope: 'home', slug: null };
  };

  const renderLoading = (route) => {
    const app = document.getElementById('app');
    if (!app) return;
    const label = route.name === 'admin'
      ? 'Cargando panel…'
      : route.name === 'negocio'
        ? 'Cargando comercio…'
        : 'Cargando comercios…';
    app.innerHTML = `
      <div class="grid min-h-[100dvh] place-items-center bg-white px-5">
        <div class="text-center">
          <span class="font-display text-2xl font-bold tracking-tight text-[#00197D]">Alto<span class="text-[#FF2F35] italic">GO</span></span>
          <div class="mx-auto mt-5 h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-ink"></div>
          <p class="mt-4 text-xs font-medium text-moss">${label}</p>
        </div>
      </div>`;
  };

  const renderRouteError = (error) => {
    const app = document.getElementById('app');
    if (!app) return;
    const retry = window.location.pathname || '/';
    app.innerHTML = `
      <div class="grid min-h-[100dvh] place-items-center bg-white px-5">
        <div class="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-7 text-center shadow-card">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-rose-600">No se pudo cargar</p>
          <h1 class="mt-2 font-display text-2xl font-semibold">Esta pantalla no está disponible</h1>
          <p class="mt-2 text-sm leading-relaxed text-moss">${Utils.esc(error.message || 'Revisa la conexión e intenta de nuevo.')}</p>
          <a href="${Utils.esc(retry)}" class="mt-5 flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">Reintentar</a>
          <a href="/" class="mt-3 block text-xs font-medium text-moss hover:text-ink">Volver al inicio</a>
        </div>
      </div>`;
  };

  // Carga los datos de la ruta y después pinta. render() solo repinta con lo
  // que ya está en memoria para no volver a pedir todo en cada interacción.
  const renderRoute = async () => {
    const route = parseRoute();
    const session = Auth.current();

    const viewKey = `${route.name}:${route.slug || ''}`;
    if (viewKey !== lastViewKey) {
      lastViewKey = viewKey;
      Utils.closeModal();
    }

    const view = routeView(route, session);
    if (!Backend.enabled || !view) {
      render();
      return;
    }

    const request = ++routeRequest;
    renderLoading(route);

    try {
      await Store.loadView(view.scope, view.slug);
    } catch (error) {
      if (request !== routeRequest) return;
      console.error('[AltoGO] No se pudo cargar la pantalla.', error);
      renderRouteError(error);
      return;
    }

    if (request !== routeRequest) return;
    render();
  };

  const render = () => {
    const app = document.getElementById('app');
    if (!app) return;

    const route = parseRoute();
    const session = Auth.current();

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
    renderRoute();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  /* ---------- Arranque ---------- */

  const init = async () => {
    Events.bind();

    window.addEventListener('hashchange', () => {
      normalizeLegacyUrl();
      scheduleRender();
    });
    window.addEventListener('popstate', scheduleRender);

    try {
      normalizeLegacyUrl();
      await Auth.init();
      await renderRoute();
    } catch (error) {
      console.error('[AltoGO] No se pudo iniciar la aplicación.', error);
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = `
          <div class="grid min-h-[100dvh] place-items-center bg-ink px-5 text-white">
            <div class="w-full max-w-md rounded-3xl bg-white p-7 text-ink shadow-2xl">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Servicio no disponible</p>
              <h1 class="mt-2 font-display text-2xl font-semibold">No pudimos cargar la aplicación</h1>
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
