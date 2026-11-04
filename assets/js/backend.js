/* ==========================================================================
   AltoGO · Backend de producción (Supabase RPC)
   --------------------------------------------------------------------------
   La app nunca accede a las tablas directamente: todas las operaciones pasan
   por funciones RPC que validan rol, sesión y reglas de negocio en Postgres.
   Solo se usan la URL pública y la anon key; nunca la service_role.
   ========================================================================== */

const Backend = (() => {
  const meta = (name) => {
    const el = document.querySelector(`meta[name="${name}"]`);
    const value = el ? el.getAttribute('content') || '' : '';
    return value.trim();
  };

  const url = meta('altogo-supabase-url').replace(/\/+$/, '');
  const anonKey = meta('altogo-supabase-anon-key');
  const enabled = Boolean(url && anonKey && /^https:\/\//i.test(url));
  const tokenKey = ALTOGO.storage.key('session.token');

  let memoryToken = null;

  const token = () => {
    if (memoryToken) return memoryToken;
    try {
      return localStorage.getItem(tokenKey) || null;
    } catch {
      return null;
    }
  };

  const saveToken = (value) => {
    memoryToken = value || null;
    try {
      if (value) localStorage.setItem(tokenKey, value);
      else localStorage.removeItem(tokenKey);
    } catch {
      /* La sesión queda solo en memoria. */
    }
  };

  const clearToken = () => saveToken(null);

  const parseError = (payload, fallback) => {
    if (!payload) return fallback;
    if (typeof payload === 'string') return payload;
    return payload.message || payload.error_description || payload.hint || fallback;
  };

  const rpc = async (fn, params = {}, { withToken = true } = {}) => {
    if (!enabled) throw new Error('Supabase no está configurado.');
    const currentToken = token();
    const body = withToken && currentToken ? { p_token: currentToken, ...params } : params;

    let response;
    try {
      response = await fetch(`${url}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      throw new Error(
        error && error.name === 'TimeoutError'
          ? 'El servidor tardó demasiado en responder. Intenta de nuevo.'
          : 'No pudimos conectar con el servidor. Revisa tu conexión.'
      );
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearToken();
      throw new Error(parseError(payload, 'No se pudo completar la operación.'));
    }

    return payload;
  };

  const login = (username, password) =>
    rpc('api_login', { p_username: username, p_password: password }, { withToken: false });

  const logout = async () => {
    const current = token();
    try {
      if (current) await rpc('api_logout', {}, { withToken: true });
    } catch {
      /* La sesión local se cierra igual. */
    } finally {
      clearToken();
    }
  };

  const snapshot = () => rpc('api_snapshot', { p_token: token() }, { withToken: false });

  const trackVisit = (slug = null) =>
    rpc('api_track_visit', { p_slug: slug }, { withToken: false });

  const trackWhatsapp = (slug) =>
    rpc('api_track_whatsapp', { p_slug: slug }, { withToken: false });

  const createOrder = (payload) =>
    rpc('api_create_order', payload, { withToken: false });

  return {
    enabled,
    token,
    saveToken,
    clearToken,
    login,
    logout,
    snapshot,
    trackVisit,
    trackWhatsapp,
    createOrder,
    rpc
  };
})();
