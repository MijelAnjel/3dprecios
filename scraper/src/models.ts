// ──────────────────────────────────────────────
// Modelos compartidos del scraper — 3DPrecios
// ──────────────────────────────────────────────

export interface ScraperResult {
  storeId: string;
  storeName: string;
  productName: string;
  productUrl: string;
  price: number;
  currency: 'CLP';
  stock: 'available' | 'low' | 'out' | 'unknown';
  sku?: string;
  imageUrl?: string;
  categorySlug?: string;
  brand?: string;
  specs?: Record<string, string | number>;
  scrapedAt: Date;
}

export interface StoreConfig {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  logo: string;
  isActive: boolean;
}

export const STORES: StoreConfig[] = [
  // ── Especializadas en impresión 3D ──────────────────────────────────────
  { id: 'horus3d',        name: 'Horus3D',             slug: 'horus3d',        baseUrl: 'https://horus3d.cl',             logo: 'https://horus3d.cl/favicon.ico',             isActive: true  },
  { id: 'imperio3d',      name: 'Imperio 3D',          slug: 'imperio3d',      baseUrl: 'https://imperio3d.com',          logo: 'https://imperio3d.com/favicon.ico',          isActive: true  },
  { id: 'makerschile',    name: 'Makers Chile',        slug: 'makerschile',    baseUrl: 'https://makerschile.cl',         logo: 'https://makerschile.cl/favicon.ico',         isActive: true  },
  { id: 'evstore',        name: 'eVStore',             slug: 'evstore',        baseUrl: 'https://evstore.cl',             logo: 'https://evstore.cl/favicon.ico',             isActive: true  },
  { id: 'make3d',         name: 'Make 3D',             slug: 'make3d',         baseUrl: 'https://www.make3d.cl',          logo: 'https://www.make3d.cl/favicon.ico',          isActive: true  },
  { id: 'maxi3d',         name: 'Maxi3D',              slug: 'maxi3d',         baseUrl: 'https://www.maxi3d.cl',          logo: 'https://www.maxi3d.cl/favicon.ico',          isActive: true  },
  { id: 'capital3d',      name: 'Capital 3D',          slug: 'capital3d',      baseUrl: 'https://capital3d.cl',           logo: 'https://capital3d.cl/favicon.ico',           isActive: true  },
  // ── Retail técnico con sección 3D ────────────────────────────────────────
  { id: 'todotoner',      name: 'TodoToner',           slug: 'todotoner',      baseUrl: 'https://www.todotoner.cl',       logo: 'https://www.todotoner.cl/favicon.ico',       isActive: true  },
  { id: 'pcfactory',      name: 'PC Factory',          slug: 'pcfactory',      baseUrl: 'https://www.pcfactory.cl',       logo: 'https://www.pcfactory.cl/favicon.ico',       isActive: true  },
  // ── Retail general ───────────────────────────────────────────────────────
  { id: 'falabella',      name: 'Falabella',           slug: 'falabella',      baseUrl: 'https://www.falabella.com',      logo: 'https://www.falabella.com/favicon.ico',      isActive: true  },
  { id: 'sodimac',        name: 'Sodimac',             slug: 'sodimac',        baseUrl: 'https://www.sodimac.cl',         logo: 'https://www.sodimac.cl/favicon.ico',         isActive: true  },
  { id: 'paris',          name: 'Paris',               slug: 'paris',          baseUrl: 'https://www.paris.cl',           logo: 'https://www.paris.cl/favicon.ico',           isActive: true  },
  { id: 'ripley',         name: 'Ripley',              slug: 'ripley',         baseUrl: 'https://simple.ripley.cl',       logo: 'https://simple.ripley.cl/favicon.ico',       isActive: true  },
  { id: 'lider',          name: 'Lider',               slug: 'lider',          baseUrl: 'https://www.lider.cl',           logo: 'https://www.lider.cl/favicon.ico',           isActive: true  },
  { id: 'easy',           name: 'Easy',                slug: 'easy',           baseUrl: 'https://www.easy.cl',            logo: 'https://www.easy.cl/favicon.ico',            isActive: true  },
  // ── Sin scraper activo (datos del seed eliminados) ───────────────────────
  { id: 'impresalta',     name: 'Impresalta',          slug: 'impresalta',     baseUrl: 'https://impresalta.cl',          logo: '',                                           isActive: false },
  { id: 'ahi3d',          name: 'AHI 3D',              slug: 'ahi3d',          baseUrl: 'https://ahi3d.cl',               logo: '',                                           isActive: false },
  { id: 'formageo',       name: 'Formageo',            slug: 'formageo',       baseUrl: 'https://formageo.cl',            logo: '',                                           isActive: false },
  { id: 'mercadolibre',   name: 'Mercado Libre CL',   slug: 'mercadolibre',   baseUrl: 'https://listado.mercadolibre.cl', logo: '',                                          isActive: false },
];
