/* ==========================================================================
   AltoGO · Vista de acceso oculto (/ingreso)
   --------------------------------------------------------------------------
   Esta ruta NO está enlazada desde ninguna vista pública: hay que escribirla
   a mano (/#/ingreso, /ingreso o ?login). Desde aquí entran el super admin y
   los administradores de cada comercio.
   ========================================================================== */

const LoginView = (() => {
  let error = '';

  const setError = (message) => {
    error = message || '';
  };

  const render = () => {
    document.title = `Acceso administrativo · ${ALTOGO.brand.name}`;
    Cart.detach();

    const hasSession = Auth.current();

    return `
      <div class="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-ink px-4 py-10 text-white">
        <div class="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-lime/15 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"></div>

        <div class="relative w-full max-w-md">
          <div class="flex items-center justify-center gap-2.5">
            <span class="relative grid h-10 w-10 place-items-center rounded-xl bg-cream font-display text-lg font-bold text-ink">
              A<span class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-lime"></span>
            </span>
            <span class="font-display text-2xl font-bold tracking-tight">Alto<span class="text-lime">GO</span></span>
          </div>

          <div class="mt-6 rounded-3xl bg-white p-6 text-ink shadow-2xl sm:p-8">
            <div class="flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-moss">
              ${Utils.icon('shield', 'h-3.5 w-3.5')} Acceso restringido
            </div>
            <h1 class="mt-4 font-display text-2xl font-semibold">Panel de administración</h1>
            <p class="mt-1 text-sm leading-relaxed text-moss">Ingresa con tu usuario de comercio o con la cuenta de super administrador.</p>

            ${error ? `
              <div class="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                <span class="mt-0.5 shrink-0">${Utils.icon('alert', 'h-4 w-4')}</span>
                <span>${Utils.esc(error)}</span>
              </div>` : ''}

            <form data-form="login" class="mt-5 space-y-3">
              <label class="block">
                <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-moss">Usuario</span>
                <input name="username" required autocomplete="username" autocapitalize="none" spellcheck="false"
                  class="w-full rounded-xl border border-ink/10 bg-cream/60 px-3 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-white" placeholder="tu-usuario" />
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-moss">Contraseña</span>
                <input name="password" type="password" required autocomplete="current-password"
                  class="w-full rounded-xl border border-ink/10 bg-cream/60 px-3 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-white" placeholder="••••••••" />
              </label>
              <button type="submit" class="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-700">
                Entrar al panel ${Utils.icon('forward', 'h-4 w-4')}
              </button>
            </form>

            ${Backend.enabled ? '' : `<details class="mt-5 rounded-xl border border-ink/10 bg-cream/50 px-3 py-2 text-[11px] text-moss">
              <summary class="cursor-pointer select-none font-semibold text-ink">Credenciales de demostración</summary>
              <div class="mt-2 space-y-1.5 leading-relaxed">
                <p><span class="font-semibold text-ink">Super admin:</span> admin / altogo2026</p>
                <p><span class="font-semibold text-ink">Tienda:</span> esquina / esquina123</p>
                <p class="text-moss/80">Cada comercio creado recibe su propia cuenta desde el panel general.</p>
              </div>
            </details>`}

            <a href="#/" class="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-moss transition hover:text-ink">
              ${Utils.icon('back', 'h-3.5 w-3.5')} Volver al catálogo público
            </a>
          </div>

          <p class="mt-5 text-center text-[10px] text-white/35">
            ${hasSession ? 'Ya tienes una sesión activa en este navegador.' : `Área privada de ${ALTOGO.brand.name}${Backend.enabled ? '' : ' · modo demo local'}`}
          </p>
        </div>
      </div>`;
  };

  Events.onSubmit('login', async (form) => {
    const data = new FormData(form);
    const username = String(data.get('username') || '');
    const password = String(data.get('password') || '');

    const result = await Auth.login(username, password);
    if (!result.ok) {
      setError(result.message);
      App.render();
      return;
    }

    setError('');
    Utils.toast(`Bienvenido, ${result.session.name.split(' ')[0]}.`);

    // Super admin → panel general. Dueño → su catálogo en modo edición.
    if (result.session.role === 'super') {
      App.go('admin');
    } else {
      App.go(`negocio/${result.session.businessSlug}`);
    }
  });

  return { render, setError };
})();
