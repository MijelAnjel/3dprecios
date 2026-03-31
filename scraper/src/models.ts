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
  { id: 'horus3d',          name: 'Horus3D',              slug: 'horus3d',          baseUrl: 'https://horus3d.cl',              logo: 'https://horus3d.cl/favicon.ico',              isActive: true  },
  { id: 'imperio3d',        name: 'Imperio 3D',           slug: 'imperio3d',        baseUrl: 'https://imperio3d.com',           logo: 'https://imperio3d.com/favicon.ico',           isActive: true  },
  { id: 'makerschile',      name: 'Makers Chile',         slug: 'makerschile',      baseUrl: 'https://makerschile.cl',          logo: 'https://makerschile.cl/favicon.ico',          isActive: true  },
  { id: 'evstore',          name: 'eVStore',              slug: 'evstore',          baseUrl: 'https://evstore.cl',              logo: 'https://evstore.cl/favicon.ico',              isActive: true  },
  { id: 'make3d',           name: 'Make 3D',              slug: 'make3d',           baseUrl: 'https://www.make3d.cl',           logo: 'https://www.make3d.cl/favicon.ico',           isActive: true  },
  { id: 'maxi3d',           name: 'Maxi3D',               slug: 'maxi3d',           baseUrl: 'https://www.maxi3d.cl',           logo: 'https://www.maxi3d.cl/favicon.ico',           isActive: true  },
  { id: 'capital3d',        name: 'Capital 3D',           slug: 'capital3d',        baseUrl: 'https://capital3d.cl',            logo: 'https://capital3d.cl/favicon.ico',            isActive: true  },
  { id: '3dworks',          name: '3DWorks',              slug: '3dworks',          baseUrl: 'https://www.3dworks.cl',          logo: 'https://www.3dworks.cl/favicon.ico',          isActive: true  },
  { id: 'cimech3d',         name: 'Cimech 3D',            slug: 'cimech3d',         baseUrl: 'https://www.cimech3d.cl',         logo: 'https://www.cimech3d.cl/favicon.ico',         isActive: true  },
  { id: 'dream3d',          name: 'Dream 3D',             slug: 'dream3d',          baseUrl: 'https://dream3d.cl',              logo: 'https://dream3d.cl/favicon.ico',              isActive: true  },
  { id: 'triangulab',       name: 'Triangulab',           slug: 'triangulab',       baseUrl: 'https://triangulab.cl',           logo: 'https://triangulab.cl/favicon.ico',           isActive: true  },
  { id: 'printalot',        name: 'Printalot Chile',      slug: 'printalot',        baseUrl: 'https://printalot.cl',            logo: 'https://printalot.cl/favicon.ico',            isActive: true  },
  { id: '3dinsumos',        name: '3D Insumos',           slug: '3dinsumos',        baseUrl: 'https://3dinsumos.cl',            logo: 'https://3dinsumos.cl/favicon.ico',            isActive: true  },
  { id: 'nebula3d',         name: 'Nébula 3D',            slug: 'nebula3d',         baseUrl: 'https://nebula3d.cl',             logo: 'https://nebula3d.cl/favicon.ico',             isActive: true  },
  { id: 'red3d',            name: 'Red3D',                slug: 'red3d',            baseUrl: 'https://red3d.cl',                logo: 'https://red3d.cl/favicon.ico',                isActive: true  },
  { id: 'mundo3d',          name: 'Mundo 3D',             slug: 'mundo3d',          baseUrl: 'https://mundo3d.cl',              logo: 'https://mundo3d.cl/favicon.ico',              isActive: true  },
  { id: 'mekano3d',         name: 'Mekano 3D',            slug: 'mekano3d',         baseUrl: 'https://mekano3d.cl',             logo: 'https://mekano3d.cl/favicon.ico',             isActive: true  },
  { id: 'open3d',           name: 'Open3D',               slug: 'open3d',           baseUrl: 'https://open3d.cl',               logo: 'https://open3d.cl/favicon.ico',               isActive: true  },
  { id: 'filamento',        name: 'Filamento.cl',         slug: 'filamento',        baseUrl: 'https://filamento.cl',            logo: 'https://filamento.cl/favicon.ico',            isActive: true  },
  { id: 'crealitychile',    name: 'Creality Chile',       slug: 'crealitychile',    baseUrl: 'https://crealitychile.cl',        logo: 'https://crealitychile.cl/favicon.ico',        isActive: true  },
  { id: 'artillerychile',   name: 'Artillery Chile',      slug: 'artillerychile',   baseUrl: 'https://artillerychile.cl',       logo: 'https://artillerychile.cl/favicon.ico',       isActive: true  },
  { id: 'deskfab',          name: 'DeskFab',              slug: 'deskfab',          baseUrl: 'https://deskfab.cl',              logo: 'https://deskfab.cl/favicon.ico',              isActive: true  },
  { id: 'impakt',           name: 'Impakt',               slug: 'impakt',           baseUrl: 'https://impakt.cl',               logo: 'https://impakt.cl/favicon.ico',               isActive: true  },
  { id: 'makershop',        name: 'MakerShop',            slug: 'makershop',        baseUrl: 'https://www.makershop.cl',        logo: 'https://www.makershop.cl/favicon.ico',        isActive: true  },
  { id: 'filamentosmaxi',   name: 'Filamentos Maxi',      slug: 'filamentosmaxi',   baseUrl: 'https://filamentosmaxi.cl',       logo: 'https://filamentosmaxi.cl/favicon.ico',       isActive: true  },
  { id: 'todotorner',       name: 'Todo Torner',          slug: 'todotorner',       baseUrl: 'https://todotorner.cl',           logo: 'https://todotorner.cl/favicon.ico',           isActive: true  },
  { id: 'tresd',            name: '3D.cl',                slug: 'tresd',            baseUrl: 'https://3d.cl',                   logo: 'https://3d.cl/favicon.ico',                   isActive: true  },
  // ── Repuestos y electrónica con sección 3D ───────────────────────────────
  { id: 'afel',             name: 'Afel',                 slug: 'afel',             baseUrl: 'https://afel.cl',                 logo: 'https://afel.cl/favicon.ico',                 isActive: true  },
  { id: 'tecnosistec',      name: 'Tecnosistec',          slug: 'tecnosistec',      baseUrl: 'https://tecnosistec.cl',          logo: 'https://tecnosistec.cl/favicon.ico',          isActive: true  },
  { id: 'mcielectronics',   name: 'MCI Electronics',      slug: 'mcielectronics',   baseUrl: 'https://mcielectronics.cl',       logo: 'https://mcielectronics.cl/favicon.ico',       isActive: true  },
  { id: 'electronicat',     name: 'Electronicat',         slug: 'electronicat',     baseUrl: 'https://electronicat.cl',         logo: 'https://electronicat.cl/favicon.ico',         isActive: true  },
  { id: 'einsumos',         name: 'E-Insumos',            slug: 'einsumos',         baseUrl: 'https://e-insumos.cl',            logo: 'https://e-insumos.cl/favicon.ico',            isActive: true  },
  // ── Retail técnico con sección 3D ────────────────────────────────────────
  { id: 'todotoner',        name: 'TodoToner',            slug: 'todotoner',        baseUrl: 'https://www.todotoner.cl',        logo: 'https://www.todotoner.cl/favicon.ico',        isActive: true  },
  { id: 'pcfactory',        name: 'PC Factory',           slug: 'pcfactory',        baseUrl: 'https://www.pcfactory.cl',        logo: 'https://www.pcfactory.cl/favicon.ico',        isActive: true  },
  // ── Retail general ───────────────────────────────────────────────────────
  { id: 'falabella',        name: 'Falabella',            slug: 'falabella',        baseUrl: 'https://www.falabella.com',       logo: 'https://www.falabella.com/favicon.ico',       isActive: true  },
  { id: 'sodimac',          name: 'Sodimac',              slug: 'sodimac',          baseUrl: 'https://www.sodimac.cl',          logo: 'https://www.sodimac.cl/favicon.ico',          isActive: true  },
  { id: 'paris',            name: 'Paris',                slug: 'paris',            baseUrl: 'https://www.paris.cl',            logo: 'https://www.paris.cl/favicon.ico',            isActive: true  },
  { id: 'ripley',           name: 'Ripley',               slug: 'ripley',           baseUrl: 'https://simple.ripley.cl',        logo: 'https://simple.ripley.cl/favicon.ico',        isActive: true  },
  { id: 'lider',            name: 'Lider',                slug: 'lider',            baseUrl: 'https://www.lider.cl',            logo: 'https://www.lider.cl/favicon.ico',            isActive: true  },
  { id: 'easy',             name: 'Easy',                 slug: 'easy',             baseUrl: 'https://www.easy.cl',             logo: 'https://www.easy.cl/favicon.ico',             isActive: true  },
  // ── Sin scraper activo ────────────────────────────────────────────────────
  { id: 'impresalta',       name: 'Impresalta',           slug: 'impresalta',       baseUrl: 'https://impresalta.cl',           logo: '',                                            isActive: false },
  { id: 'ahi3d',            name: 'AHI 3D',               slug: 'ahi3d',            baseUrl: 'https://ahi3d.cl',                logo: '',                                            isActive: false },
  { id: 'formageo',         name: 'Formageo',             slug: 'formageo',         baseUrl: 'https://formageo.cl',             logo: '',                                            isActive: false },
  { id: 'mercadolibre',     name: 'Mercado Libre CL',     slug: 'mercadolibre',     baseUrl: 'https://listado.mercadolibre.cl', logo: '',                                            isActive: false },
];
