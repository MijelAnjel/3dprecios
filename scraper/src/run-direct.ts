import * as dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import * as fs   from 'fs';
import * as path from 'path';

import { ScraperResult, STORES, StoreConfig } from './models';
import { slugify, normalizeProductName, extractSpecs, buildCanonicalKey, inferCategory } from './utils';

// ── Tiendas especializadas ────────────────────────────────────
import { scrapeHorus3d }          from './stores/horus3d';
import { scrapeImperio3d }        from './stores/imperio3d';
import { scrapeMakerschile }      from './stores/makerschile';
import { scrapeEvstore }          from './stores/evstore';
import { scrapeMake3d }           from './stores/make3d';
import { scrapeMaxi3d }           from './stores/maxi3d';
import { scrapeCapital3d }        from './stores/capital3d';
import { scrape3dworks }          from './stores/3dworks';
import { scrapeCimech3d }         from './stores/cimech3d';
import { scrapeDream3d }          from './stores/dream3d';
import { scrapeTriangulab }       from './stores/triangulab';
import { scrapePrintalot }        from './stores/printalot';
import { scrape3dinsumos }        from './stores/3dinsumos';
import { scrapeNebula3d }         from './stores/nebula3d';
import { scrapeRed3d }            from './stores/red3d';
import { scrapeMundo3d }          from './stores/mundo3d';
import { scrapeMekano3d }         from './stores/mekano3d';
import { scrapeOpen3d }           from './stores/open3d';
import { scrapeFilamento }        from './stores/filamento';
import { scrapeCrealityChile }    from './stores/crealitychile';
import { scrapeArtilleryChile }   from './stores/artillerychile';
import { scrapeDeskfab }          from './stores/deskfab';
import { scrapeImpakt }           from './stores/impakt';
import { scrapeMakershop }        from './stores/makershop';
import { scrapeFilamentosMaxi }   from './stores/filamentosmaxi';
import { scrapeTodoTorner }       from './stores/todotorner';
// tresd (3d.cl) — dominio caído, deshabilitado
// import { scrapeTresD }         from './stores/tresd';
// ── Repuestos y electrónica ───────────────────────────────────
import { scrapeAfel }             from './stores/afel';
import { scrapeTecnosistec }      from './stores/tecnosistec';
import { scrapeMciElectronics }   from './stores/mcielectronics';
import { scrapeElectronicat }     from './stores/electronicat';
import { scrapeEinsumos }         from './stores/einsumos';
// ── Retail técnico ────────────────────────────────────────────
import { scrapeTodotoner }        from './stores/todotoner';
import { scrapePcfactory }        from './stores/pcfactory';
import { scrapeBambulab }         from './stores/bambulab';
// ── Retail general ────────────────────────────────────────────
import { scrapeFalabella }        from './stores/falabella';
import { scrapeSodimac }          from './stores/sodimac';
import { scrapeParis }            from './stores/paris';
import { scrapeRipley }           from './stores/ripley';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos — espejo de catalog.json (sin dependencia de Firestore)
// ──────────────────────────────────────────────────────────────────────────────

interface CatalogEntry {
  storeId: string;
  url:     string;
  price:   number;
  stock:   'available' | 'low' | 'out' | 'unknown';
  sku?:    string;
}

interface CatalogHistoryPoint {
  storeId:    string;
  price:      number;
  recordedAt: string;
}

interface CatalogProduct {
  slug:        string;
  id:          string;
  name:        string;
  brand:       string;
  categoryId:  string;
  description: string;
  images:      string[];
  specs:       Record<string, string | number>;
  minPrice:    number;
  maxPrice:    number;
  storeCount:  number;
  updatedAt:   string;
  createdAt:   string;
  entries:     CatalogEntry[];
  history:     CatalogHistoryPoint[];
}

interface CatalogStore {
  id:          string;
  slug:        string;
  name:        string;
  url:         string;
  logo:        string;
  country:     'CL';
  isActive:    boolean;
  lastScraped: string;
}

interface CatalogData {
  meta: {
    generatedAt:  string;
    productCount: number;
  };
  stores:   CatalogStore[];
  products: CatalogProduct[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Registro de scrapers (idéntico a run.ts)
// ──────────────────────────────────────────────────────────────────────────────

type StoreScraperFn = (store: StoreConfig) => Promise<ScraperResult[]>;

const STORE_SCRAPERS: Record<string, StoreScraperFn> = {
  horus3d:          scrapeHorus3d,
  imperio3d:        scrapeImperio3d,
  makerschile:      scrapeMakerschile,
  evstore:          scrapeEvstore,
  make3d:           scrapeMake3d,
  maxi3d:           scrapeMaxi3d,
  capital3d:        scrapeCapital3d,
  '3dworks':        scrape3dworks,
  cimech3d:         scrapeCimech3d,
  dream3d:          scrapeDream3d,
  triangulab:       scrapeTriangulab,
  printalot:        scrapePrintalot,
  '3dinsumos':      scrape3dinsumos,
  nebula3d:         scrapeNebula3d,
  red3d:            scrapeRed3d,
  mundo3d:          scrapeMundo3d,
  mekano3d:         scrapeMekano3d,
  open3d:           scrapeOpen3d,
  filamento:        scrapeFilamento,
  crealitychile:    scrapeCrealityChile,
  artillerychile:   scrapeArtilleryChile,
  deskfab:          scrapeDeskfab,
  impakt:           scrapeImpakt,
  makershop:        scrapeMakershop,
  filamentosmaxi:   scrapeFilamentosMaxi,
  todotorner:       scrapeTodoTorner,
  // tresd: disabled — 3d.cl caído
  afel:             scrapeAfel,
  tecnosistec:      scrapeTecnosistec,
  mcielectronics:   scrapeMciElectronics,
  electronicat:     scrapeElectronicat,
  einsumos:         scrapeEinsumos,
  todotoner:        scrapeTodotoner,
  pcfactory:        scrapePcfactory,
  bambulab:         scrapeBambulab,
  falabella:        scrapeFalabella,
  sodimac:          scrapeSodimac,
  paris:            scrapeParis,
  ripley:           scrapeRipley,
};

// ──────────────────────────────────────────────────────────────────────────────
// Ejecutar scrapers (sin db)
// ──────────────────────────────────────────────────────────────────────────────

async function runAllScrapers(): Promise<{ results: ScraperResult[]; scrapedStoreIds: Set<string> }> {
  const allResults: ScraperResult[] = [];
  const scrapedStoreIds = new Set<string>();

  const activeStores = STORES.filter(s => s.isActive);
  const storeArg = process.argv.find(a => a.startsWith('--store='))?.split('=')[1];

  const storesToRun = storeArg
    ? activeStores.filter(s => s.id === storeArg)
    : activeStores;

  if (storeArg && storesToRun.length === 0) {
    throw new Error(`Tienda no encontrada: "${storeArg}". Disponibles: ${activeStores.map(s => s.id).join(', ')}`);
  }

  for (const store of storesToRun) {
    const scraper = STORE_SCRAPERS[store.id];
    if (!scraper) {
      console.warn(`[Scraper] Sin implementación para: ${store.id}`);
      continue;
    }

    console.log(`\n━━━ Iniciando ${store.name} ━━━`);
    const start = Date.now();

    try {
      const results = await scraper(store);
      allResults.push(...results);
      scrapedStoreIds.add(store.id);
      console.log(`[${store.name}] ✓ ${results.length} productos en ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`[${store.name}] ✗ Error:`, err);
      // Continúa con las demás tiendas
    }
  }

  return { results: allResults, scrapedStoreIds };
}

// ──────────────────────────────────────────────────────────────────────────────
// Merge — combina resultados del scrape con el catálogo existente
// ──────────────────────────────────────────────────────────────────────────────

function mergeCatalog(
  existing: CatalogData,
  results: ScraperResult[],
  scrapedStoreIds: Set<string>,
): CatalogData {
  const now           = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // ── Productos existentes: re-indexar con clave canónica si es posible ───
  // Esto hace que los productos ya almacenados adopten las nuevas claves
  // canónicas (fil-…, fdm-…, res-…) sin necesidad de re-scrape.
  const productMap = new Map<string, CatalogProduct>();

  for (const p of existing.products) {
    const prod = JSON.parse(JSON.stringify(p)) as CatalogProduct;

    // Re-inferir categoría desde varias categorías fuente:
    //   - 'general': cualquier categoría más específica
    //   - impresoras-*: sólo si nuevo resultado es repuesto/resina/accesorio
    //   - filamentos-*: sólo si nuevo resultado es repuesto/resina/accesorio-resina/secador
    //     (corrige gargantas/boquillas/resinas que quedaron en filamentos por bug)
    const RECATEGORIZE_ALL = [
      'general', 'impresoras-fdm', 'impresoras-resina',
      'filamentos-pla', 'filamentos-abs', 'filamentos-petg', 'filamentos-tpu', 'filamentos-especiales',
      'accesorios',
    ];
    const FILAMENT_CATS = new Set([
      'filamentos-pla', 'filamentos-abs', 'filamentos-petg', 'filamentos-tpu', 'filamentos-especiales',
    ]);
    if (RECATEGORIZE_ALL.includes(prod.categoryId)) {
      const reCat = inferCategory(prod.name, '');
      const isDowngradeSafe = prod.categoryId === 'general'
        ? reCat !== 'general'
        : FILAMENT_CATS.has(prod.categoryId) || prod.categoryId === 'accesorios'
          ? ['repuestos', 'resinas', 'accesorios-resina', 'secadores', 'accesorios', 'impresoras-fdm', 'impresoras-resina'].includes(reCat)
          : ['repuestos', 'resinas', 'accesorios', 'accesorios-resina'].includes(reCat);
      if (isDowngradeSafe) {
        prod.categoryId = reCat;
        // Re-extraer specs con la categoría correcta
        const reSpecs = extractSpecs(prod.name, reCat);
        if (Object.keys(reSpecs).length > Object.keys(prod.specs).length) {
          prod.specs    = reSpecs;
          prod.brand    = prod.brand || (reSpecs['brand'] as string | undefined) || '';
        }
      }
    }

    // Re-extraer specs para productos ya en 'repuestos'/'impresoras-resina'
    // para aplicar nuevas reglas de partType, compatibleWith, resolution, etc.
    if (prod.categoryId === 'repuestos' || prod.categoryId === 'impresoras-resina' || prod.categoryId === 'accesorios-resina') {
      const freshSpecs = extractSpecs(prod.name, prod.categoryId);
      if (Object.keys(freshSpecs).length > 0) {
        prod.specs = { ...prod.specs, ...freshSpecs }; // freshSpecs override stale values
        prod.brand = prod.brand || (freshSpecs['brand'] as string | undefined) || '';
      }
    }

    // Construir clave canónica y re-insertar bajo esa clave
    const canonKey = buildCanonicalKey(prod.categoryId, prod.specs, prod.name);
    if (canonKey !== prod.slug && !productMap.has(canonKey)) {
      // Producto migrado a clave canónica
      prod.slug = canonKey;
      prod.id   = canonKey;
    } else if (productMap.has(canonKey) && canonKey !== prod.slug) {
      // Ya existe un producto con la misma clave canónica → fusionar entries
      const existing_canon = productMap.get(canonKey)!;
      for (const entry of prod.entries) {
        const idx = existing_canon.entries.findIndex(e => e.storeId === entry.storeId);
        if (idx >= 0) {
          existing_canon.entries[idx] = entry;
        } else {
          existing_canon.entries.push(entry);
        }
      }
      for (const h of prod.history) {
        existing_canon.history.push(h);
      }
      continue; // no re-insertar el producto duplicado
    }

    productMap.set(prod.slug, prod);
  }

  // ── Procesar cada resultado del scrape ──────────────────────────────────
  for (const result of results) {
    // Limpiar nombre duplicado (algunos WooCommerce repiten el texto)
    const rawName = result.productName;
    const halfLen = Math.ceil(rawName.length / 2);
    const cleanName =
      rawName.length > 10 && rawName.slice(0, halfLen) === rawName.slice(halfLen)
        ? rawName.slice(0, halfLen).trim()
        : rawName;

    const normalizedName = normalizeProductName(cleanName);
    if (!slugify(normalizedName)) continue;

    const validImage =
      result.imageUrl && !result.imageUrl.startsWith('data:') ? result.imageUrl : undefined;
    const categoryId = result.categorySlug ?? 'general';

    // Extraer specs desde el nombre original (antes de normalización) para
    // capturar colores en paréntesis ("PLA Rojo (1kg)") antes de que se eliminen
    const specs      = extractSpecs(cleanName, categoryId);
    const canonKey   = buildCanonicalKey(categoryId, specs, normalizedName);

    const newEntry: CatalogEntry = {
      storeId: result.storeId,
      url:     result.productUrl,
      price:   result.price,
      stock:   result.stock,
      ...(result.sku ? { sku: result.sku } : {}),
    };

    const prod = productMap.get(canonKey);

    if (!prod) {
      // ── Producto nuevo ─────────────────────────────────────────
      productMap.set(canonKey, {
        slug:        canonKey,
        id:          canonKey,
        name:        cleanName,
        brand:       result.brand ?? (specs['brand'] as string | undefined) ?? '',
        categoryId,
        description: '',
        images:      validImage ? [validImage] : [],
        specs,
        minPrice:    result.price,
        maxPrice:    result.price,
        storeCount:  1,
        updatedAt:   now,
        createdAt:   now,
        entries:     [newEntry],
        history:     [{ storeId: result.storeId, price: result.price, recordedAt: now }],
      });
    } else {
      // ── Producto existente — actualizar entry ──────────────────
      const entryIdx  = prod.entries.findIndex(e => e.storeId === result.storeId);
      const prevPrice = entryIdx >= 0 ? prod.entries[entryIdx].price : null;

      if (entryIdx >= 0) {
        prod.entries[entryIdx] = newEntry;
      } else {
        prod.entries.push(newEntry);
      }

      // Agregar punto de historial solo si el precio cambió
      if (prevPrice !== result.price) {
        prod.history.push({ storeId: result.storeId, price: result.price, recordedAt: now });
      }

      // Podar historial a 90 días
      prod.history = prod.history.filter(h => h.recordedAt >= ninetyDaysAgo);

      // Actualizar categoría si la nueva es más específica
      if (categoryId !== 'general' && prod.categoryId === 'general') {
        prod.categoryId = categoryId;
        // Re-extraer specs con la categoría correcta
        const betterSpecs = extractSpecs(cleanName, categoryId);
        if (Object.keys(betterSpecs).length > Object.keys(prod.specs).length) {
          prod.specs = betterSpecs;
        }
      }

      // Actualizar imagen si no hay una válida
      if (validImage && prod.images.length === 0) {
        prod.images = [validImage];
      }

      prod.updatedAt = now;
    }
  }

  // ── Recalcular minPrice / maxPrice / storeCount ─────────────────────────
  for (const prod of productMap.values()) {
    // Deduplicar entries por (storeId + url) — previene duplicados del catálogo anterior
    const seenEntryKeys = new Set<string>();
    prod.entries = prod.entries.filter(entry => {
      const key = `${entry.storeId}:${entry.url}`;
      if (seenEntryKeys.has(key)) return false;
      seenEntryKeys.add(key);
      return true;
    });

    if (prod.entries.length > 0) {
      const available = prod.entries.filter(e => e.stock !== 'out');
      const priceSrc  = available.length > 0 ? available : prod.entries;
      const prices    = priceSrc.map(e => e.price);
      prod.minPrice   = Math.min(...prices);
      prod.maxPrice   = Math.max(...prices);
      prod.storeCount = prod.entries.length;
    }
  }

  // ── Construir lista de tiendas con lastScraped actualizado ───────────────
  const prevLastScraped = new Map<string, string>(
    existing.stores.map(s => [s.id, s.lastScraped]),
  );
  for (const storeId of scrapedStoreIds) {
    prevLastScraped.set(storeId, now);
  }

  const stores: CatalogStore[] = STORES.filter(s => s.isActive).map(s => ({
    id:          s.id,
    slug:        s.slug,
    name:        s.name,
    url:         s.baseUrl,
    logo:        s.logo,
    country:     'CL' as const,
    isActive:    s.isActive,
    lastScraped: prevLastScraped.get(s.id) ?? now,
  }));

  // Ordenar productos por updatedAt desc
  const products = Array.from(productMap.values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    meta: { generatedAt: now, productCount: products.length },
    stores,
    products,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// generateSitemap — genera public/sitemap.xml a partir del catálogo
// ──────────────────────────────────────────────────────────────────────────────

const SITE_URL = 'https://dprecios.web.app';

const STATIC_CATEGORIES = [
  'filamentos-pla', 'filamentos-petg', 'filamentos-abs', 'filamentos-tpu',
  'filamentos-especiales', 'resinas', 'impresoras-fdm', 'impresoras-resina',
  'accesorios', 'secadores', 'scanner-3d', 'lapices-3d', 'repuestos',
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

function urlEntry(
  loc: string,
  opts: { lastmod?: string; changefreq?: string; priority?: number } = {},
): string {
  const lines: string[] = [`  <url>`, `    <loc>${xmlEscape(loc)}</loc>`];
  if (opts.lastmod)            lines.push(`    <lastmod>${opts.lastmod.slice(0, 10)}</lastmod>`);
  if (opts.changefreq)         lines.push(`    <changefreq>${opts.changefreq}</changefreq>`);
  if (opts.priority !== undefined) lines.push(`    <priority>${opts.priority.toFixed(1)}</priority>`);
  lines.push(`  </url>`);
  return lines.join('\n');
}

function generateSitemap(catalog: CatalogData): void {
  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [];

  urls.push(urlEntry(`${SITE_URL}/`,           { changefreq: 'daily',   priority: 1.0 }));
  urls.push(urlEntry(`${SITE_URL}/categorias`, { changefreq: 'daily',   priority: 0.9 }));
  urls.push(urlEntry(`${SITE_URL}/tiendas`,    { changefreq: 'weekly',  priority: 0.8 }));
  urls.push(urlEntry(`${SITE_URL}/recursos`,   { changefreq: 'monthly', priority: 0.6 }));
  urls.push(urlEntry(`${SITE_URL}/comparar`,   { changefreq: 'weekly',  priority: 0.5 }));

  for (const cat of STATIC_CATEGORIES) {
    urls.push(urlEntry(`${SITE_URL}/categorias/${cat}`, {
      lastmod: today, changefreq: 'daily', priority: 0.8,
    }));
  }

  for (const store of catalog.stores) {
    urls.push(urlEntry(`${SITE_URL}/tiendas/${xmlEscape(store.slug)}`, {
      lastmod:    store.lastScraped.slice(0, 10),
      changefreq: 'weekly',
      priority:   0.6,
    }));
  }

  const MAX_PRODUCTS = 49_000;
  for (const product of catalog.products.slice(0, MAX_PRODUCTS)) {
    urls.push(urlEntry(`${SITE_URL}/productos/${xmlEscape(product.slug)}`, {
      lastmod:    product.updatedAt.slice(0, 10),
      changefreq: 'weekly',
      priority:   0.7,
    }));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  const sitemapPath = path.resolve(__dirname, '../../public/sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`[Direct] ✓ sitemap.xml: ${urls.length} URLs`);
}

// ──────────────────────────────────────────────────────────────────────────────
// main
// ──────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[3DPrecios Scraper] Modo: directo a catalog.json (sin Firestore)');
  console.log(`[3DPrecios Scraper] ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const isReprocess   = process.argv.includes('--reprocess');
  const isPurgeNon3d  = process.argv.includes('--purge-non3d');

  // ── Cargar catálogo existente ──────────────────────────────────────────
  const catalogPath = path.resolve(__dirname, '../../src/assets/data/catalog.json');
  let existingCatalog: CatalogData = {
    meta:     { generatedAt: new Date().toISOString(), productCount: 0 },
    stores:   [],
    products: [],
  };

  if (fs.existsSync(catalogPath)) {
    existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as CatalogData;
    console.log(`[Direct] Catálogo existente: ${existingCatalog.products.length} productos`);
  } else {
    console.log('[Direct] No existe catálogo previo — creando desde cero');
  }

  // ── Modo --reprocess: re-categoriza y re-deduplica sin scraping ────────
  // Ideal para aplicar nuevas reglas de categorización/deduplicación
  // sobre el catálogo existente sin necesitar volver a hacer scraping.
  if (isReprocess) {
    console.log('[Direct] Modo --reprocess: re-procesando catálogo existente...');
    const catalog = mergeCatalog(existingCatalog, [], new Set());
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

    // Estadísticas post-reprocess
    const multiStore = catalog.products.filter(p => p.storeCount > 1).length;
    const byCat = catalog.products.reduce<Record<string, number>>((acc, p) => {
      acc[p.categoryId] = (acc[p.categoryId] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`[Direct] ✓ catalog.json: ${catalog.products.length} productos`);
    console.log(`[Direct] Productos en múltiples tiendas: ${multiStore}`);
    console.log('[Direct] Distribución por categoría:');
    Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });

    generateSitemap(catalog);
    console.log('\n[3DPrecios Scraper] ✓ Re-proceso completado.');
    return;
  }

  // ── Modo --purge-non3d: elimina productos non-3D del catálogo legado ───
  // Para tiendas "mixtas" (cimech3d, electronicat, etc.) que scrapeaban
  // productos de Arduino/CNC/fresas antes de que se implementara el filtro.
  if (isPurgeNon3d) {
    const NON3D_STORES = new Set(['cimech3d', 'electronicat', 'mcielectronics', 'afel']);
    // Blacklist estricta: solo patrones inequívocamente NO relacionados con impresión 3D
    const NON_3D_BLACKLIST = new RegExp([
      // Arduino y microcontroladores
      '\\barduino\\b','\\batmega\\b','\\bgrbl\\b','\\bmach3\\b',
      // Kits de electrónica genérica (usar .* para permitir "de" entre palabras)
      'kit\\s+de\\s+(diod|capac|transistor|bot[oó]n|potenci|led\\s+de\\s+varios)',
      'kit\\s+(diod|capac|transistor|bot[oó]n|potenci)',
      'kit\\s+para\\s+arduino',
      // CNC — controladores, interfaces, herramientas
      'fluid\\s*cnc','\\bmach3\\b',
      'controlador.*mach3|mach3.*controlador',
      'controlador.*\\d\\s*ejes?.*cnc|\\d\\s*ejes?.*controlador.*cnc|controlador.*usb.*\\d\\s*ejes?',
      'interfaz.*cnc|cnc.*interfaz',
      'pantalla.*cnc|cnc.*pantalla',
      'thc\\s+\\d{2,}|m[oó]dulo\\s+thc\\b|controlador\\s+(plasma|thc)',
      // Fresas CNC (cualquier tipo de fresa es herramienta CNC)
      '\\bfresa\\b',
      // Collets/mandriles CNC
      'spring\\s+collet|er\\s*\\d+\\s+collet|adaptador\\s+de\\s+collet',
      // Arduino shields
      'shield.*cnc|cnc.*shield','monster\\s+moto\\s+shield',
      '\\buno\\s+r3\\b|\\bnano\\s+33\\b|\\bmega\\s+2560\\b',
      'placa\\s+nano\\s+controladora|nano\\s+controladora',
      // Reguladores y drivers de electrónica general
      'regulador\\s+de\\s+voltaje\\s+lm',
      'driver\\s+l298n',
      'm[oó]dulo\\s+relay\\s+5v',
      'm[oó]dulo\\s+encoder\\s+rotatorio\\s+arduino',
      'm[oó]dulo\\s+lector\\s+tarjeta\\s+sd\\s+arduino',
      'm[oó]dulo\\s+pap\\s+driver|step\\s*stick\\b|big\\s*easy\\s*driver\\b',
      // Filtros y adaptadores eléctricos genéricos
      'filtro\\s+(de\\s+)?l[ií]nea\\s+emi|filtro\\s+emi[\\s/]emc|filtro\\s+emc\\b',
      'adaptador\\s+12v\\s+\\d+a\\b',
      // Herramientas de chips / IC tools
      'herramienta\\s+para\\s+extraer\\s+(chips?|ic|plcc)',
      // Cuchillas genéricas (no 3D)
      'cuchilla.*ipa',
      // Brocas CNC
      'kit\\s+(de\\s+)?brocas?(\\s+para)?\\s*cnc',
      // Slot covers (perfil de aluminio para CNC)
      '\\bslot\\s+cover\\b',
      // Servicios CNC
      'servicio\\s+de\\s+(corte|grabado|laser|cnc|router\\s+cnc|modelado\\s+3d\\s+por\\s+hora)',
      // Actuador lineal armado (servicio, no producto 3D)
      'armado.*actuador\\s+lineal|actuador\\s+lineal.*armado',
      // Cortador de cable genérico (no es herramienta 3D específica)
      'cortador\\s+de\\s+cable\\s+o\\s+cortafrio',
      // Llaves genéricas (no relacionadas con 3D)
      'herramienta\\s+para\\s+extraer|llave\\s+de\\s+extremo\\s+abierto',
      // Laser CO2 heads (CNC laser, not 3D)
      'cabezales?\\s+para\\s+maquina\\s+l[aá]ser\\s+co2',
      // Simuladores y cajas plásticas
      'simulador\\s+de\\s+carreras',
      'caja\\s+organizadora|caja\\s+pl[aá]stica\\s+apilable',
    ].join('|'), 'i');

    const before = existingCatalog.products.length;
    existingCatalog.products = existingCatalog.products.filter(prod => {
      const name = prod.name.toLowerCase();
      // Solo purgar si: viene de tienda mixta Y está en general Y nombre en blacklist
      if (prod.categoryId !== 'general') return true;  // proteger repuestos y otros
      const fromMixedStore = prod.entries?.some(e => NON3D_STORES.has(e.storeId));
      if (!fromMixedStore) return true;
      return !NON_3D_BLACKLIST.test(name);
    });

    const removed = before - existingCatalog.products.length;
    console.log(`[Direct] --purge-non3d: eliminados ${removed} productos non-3D (${before} → ${existingCatalog.products.length})`);

    // Guardar y mostrar distribución
    const catalog = mergeCatalog(existingCatalog, [], new Set());
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
    const byCatP = catalog.products.reduce<Record<string, number>>((acc, p) => {
      acc[p.categoryId] = (acc[p.categoryId] ?? 0) + 1;
      return acc;
    }, {});
    console.log('[Direct] Distribución post-purga:');
    Object.entries(byCatP).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
    generateSitemap(catalog);
    console.log('\n[3DPrecios Scraper] ✓ Purga completada.');
    return;
  }

  // ── Ejecutar scrapers ──────────────────────────────────────────────────
  const { results, scrapedStoreIds } = await runAllScrapers();
  console.log(`\n[Scraper] Total resultados: ${results.length}`);

  // ── Merge ──────────────────────────────────────────────────────────────
  console.log('[Direct] Mergeando con catálogo existente...');
  const catalog = mergeCatalog(existingCatalog, results, scrapedStoreIds);

  // ── Escribir catalog.json ──────────────────────────────────────────────
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`[Direct] ✓ catalog.json: ${catalog.products.length} productos`);

  // ── Generar sitemap.xml ────────────────────────────────────────────────
  generateSitemap(catalog);

  console.log('\n[3DPrecios Scraper] ✓ Completado exitosamente.');
}

main().catch((err: unknown) => {
  console.error('[3DPrecios Scraper] Error fatal:', err);
  process.exit(1);
});
