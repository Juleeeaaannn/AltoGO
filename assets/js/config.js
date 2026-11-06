/* ==========================================================================
   AltoGO · Configuración global
   Un solo lugar para marca, moneda, rutas y metadatos de categorías.
   ========================================================================== */

const ALTOGO = {
  brand: {
    name: 'AltoGO',
    tagline: 'Productos a domicilio',
    claim: 'Tus productos favoritos, a un WhatsApp de distancia.'
  },

  /* Prefijo único de localStorage: permite versionar los datos del MVP */
  storage: {
    prefix: 'altogo.v1.',
    key(name) {
      return this.prefix + name;
    }
  },

  /* Pesos argentinos */
  currency: 'ARS',
  locale: 'es-AR',

  /* Rutas internas limpias. Los enlaces viejos con hash o query se redirigen. */
  routes: {
    home: '/',
    login: '/ingreso',
    admin: '/admin'
  },

  /* Categorías de productos: emoji + degradado para el arte generado */
  categories: {
    Almacén:          { emoji: '🥫', from: '#FCD34D', to: '#92400E' },
    Lácteos:          { emoji: '🥛', from: '#BFDBFE', to: '#1E3A8A' },
    Bebidas:          { emoji: '🧃', from: '#67E8F9', to: '#0E7490' },
    Snacks:           { emoji: '🍿', from: '#FDE68A', to: '#B45309' },
    Limpieza:         { emoji: '🧼', from: '#7DD3FC', to: '#075985' },
    'Cuidado personal': { emoji: '🧴', from: '#F9A8D4', to: '#9D174D' },
    Hogar:            { emoji: '🏠', from: '#A7F3D0', to: '#065F46' },
    Accesorios:       { emoji: '🎒', from: '#C4B5FD', to: '#4C1D95' },
    Otros:            { emoji: '📦', from: '#CBD5E1', to: '#334155' }
  },

  /* Límite de unidades por producto en el carrito */
  maxQtyPerItem: 99,

  /* Sellos de tiempo "humanos" para el panel */
  localeOptions: { day: '2-digit', month: 'short', year: 'numeric' }
};
