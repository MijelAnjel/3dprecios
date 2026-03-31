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
  { id: 'impresalta',     name: 'Impresalta',         slug: 'impresalta',     baseUrl: 'https://impresalta.cl',          logo: 'https://impresalta.cl/favicon.ico',          isActive: true  },
  { id: 'formageo',       name: 'Formageo',            slug: 'formageo',       baseUrl: 'https://formageo.cl',            logo: 'https://formageo.cl/favicon.ico',            isActive: true  },
  { id: 'tresd',          name: '3D Chile (TresD)',    slug: 'tresd',          baseUrl: 'https://3d.cl',                  logo: 'https://3d.cl/favicon.ico',                  isActive: true  },
  { id: 'ahi3d',          name: 'AHI 3D',              slug: 'ahi3d',          baseUrl: 'https://ahi3d.cl',               logo: 'https://ahi3d.cl/favicon.ico',               isActive: true  },
  { id: 'filamento',      name: 'Filamento.cl',        slug: 'filamento',      baseUrl: 'https://filamento.cl',           logo: 'https://filamento.cl/favicon.ico',           isActive: true  },
  { id: '3dstore',        name: '3D Store Chile',      slug: '3dstore',        baseUrl: 'https://3dstore.cl',             logo: 'https://3dstore.cl/favicon.ico',             isActive: true  },
  { id: 'makershop',      name: 'MakerShop',           slug: 'makershop',      baseUrl: 'https://makershop.cl',           logo: 'https://makershop.cl/favicon.ico',           isActive: true  },
  { id: 'imperio3d',      name: 'Imperio 3D',          slug: 'imperio3d',      baseUrl: 'https://imperio3d.com',          logo: 'https://imperio3d.com/favicon.ico',          isActive: true  },
  { id: 'impakt',         name: 'Impakt',               slug: 'impakt',         baseUrl: 'https://www.impakt.cl',          logo: 'https://www.impakt.cl/favicon.ico',          isActive: true  },
  { id: 'todotorner',     name: 'Todo Torner',         slug: 'todotorner',     baseUrl: 'https://todotorner.cl',          logo: 'https://todotorner.cl/favicon.ico',          isActive: true  },
  { id: 'deskfab',        name: 'DeskFab',              slug: 'deskfab',        baseUrl: 'https://deskfab.cl',             logo: 'https://deskfab.cl/favicon.ico',             isActive: true  },
  { id: 'filamentosmaxi', name: 'Filamentos Maxi',     slug: 'filamentosmaxi', baseUrl: 'https://filamentosmaxi.cl',      logo: 'https://filamentosmaxi.cl/favicon.ico',      isActive: true  },
  // ── Retail general ───────────────────────────────────────────────────────
  { id: 'falabella',      name: 'Falabella',            slug: 'falabella',      baseUrl: 'https://www.falabella.com',      logo: 'https://www.falabella.com/favicon.ico',      isActive: true  },
  { id: 'sodimac',        name: 'Sodimac',              slug: 'sodimac',        baseUrl: 'https://www.sodimac.cl',         logo: 'https://www.sodimac.cl/favicon.ico',         isActive: true  },
  { id: 'paris',          name: 'Paris',                slug: 'paris',          baseUrl: 'https://www.paris.cl',           logo: 'https://www.paris.cl/favicon.ico',           isActive: true  },
  { id: 'ripley',         name: 'Ripley',               slug: 'ripley',         baseUrl: 'https://simple.ripley.cl',       logo: 'https://simple.ripley.cl/favicon.ico',       isActive: true  },
  // ── Desactivadas / pendientes de integración ────────────────────────────
  { id: 'mercadolibre',   name: 'Mercado Libre CL',    slug: 'mercadolibre',   baseUrl: 'https://listado.mercadolibre.cl', logo: 'https://http2.mlstatic.com/favicon.ico',    isActive: false },
];
