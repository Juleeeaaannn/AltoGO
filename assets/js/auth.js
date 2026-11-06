/* ==========================================================================
   AltoGO · Autenticación
   --------------------------------------------------------------------------
   Producción: las credenciales se validan en Postgres y la sesión usa un token
   opaco guardado en localStorage. El token caduca y puede revocarse.
   Desarrollo sin Supabase: se mantiene el acceso local de demostración.
   ========================================================================== */

const Auth = (() => {
  let cachedSession = null;

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const clearLocal = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* noop */
    }
  };

  const validOwner = (session) =>
    Boolean(session && session.role === 'owner' && Store.business(session.businessSlug));

  const current = () => {
    if (Backend.enabled) return cachedSession;
    const session = readLocal();
    if (!session || !session.role) return null;
    if (session.role === 'super') return session;
    if (session.role === 'owner') {
      if (!validOwner(session)) {
        clearLocal();
        return null;
      }
      return session;
    }
    clearLocal();
    return null;
  };

  /**
   * Restaura la sesión antes del primer render. Los datos de la pantalla se
   * cargan después, en App.renderRoute(). Un token vencido se descarta.
   */
  const init = async () => {
    if (!Backend.enabled) {
      cachedSession = readLocal();
      if (cachedSession && cachedSession.role === 'owner' && !validOwner(cachedSession)) {
        cachedSession = null;
        clearLocal();
      }
      return cachedSession;
    }

    if (!Backend.token()) {
      cachedSession = null;
      return null;
    }

    const snapshot = await Backend.session();
    if (snapshot && snapshot.user) {
      cachedSession = snapshot.user;
    } else {
      cachedSession = null;
      Backend.clearToken();
    }
    return cachedSession;
  };

  const login = async (username, password) => {
    if (!Backend.enabled) {
      const user = Store.findUser(username, password);
      if (!user) return { ok: false, message: 'Usuario o contraseña incorrectos.' };

      const session = {
        role: user.role,
        username: user.username,
        name: user.name,
        businessSlug: user.businessSlug || null
      };

      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        return { ok: false, message: 'No se pudo guardar la sesión en este navegador.' };
      }
      cachedSession = session;
      return { ok: true, session };
    }

    try {
      const result = await Backend.login(String(username || '').trim(), String(password || ''));
      if (!result || !result.token || !result.user) {
        return { ok: false, message: 'Usuario o contraseña incorrectos.' };
      }
      Backend.saveToken(result.token);
      cachedSession = result.user;
      return { ok: true, session: result.user };
    } catch (error) {
      Backend.clearToken();
      cachedSession = null;
      return { ok: false, message: error.message || 'No se pudo iniciar sesión.' };
    }
  };

  const logout = async () => {
    if (Backend.enabled) {
      await Backend.logout();
      cachedSession = null;
      return;
    }
    cachedSession = null;
    clearLocal();
  };

  const isSuper = () => {
    const session = current();
    return !!session && session.role === 'super';
  };

  const isOwnerOf = (slug) => {
    const session = current();
    return !!session && session.role === 'owner' && session.businessSlug === slug;
  };

  return { init, current, login, logout, isSuper, isOwnerOf };
})();
