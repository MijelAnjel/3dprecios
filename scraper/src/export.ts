import * as fs   from 'fs';
import * as path from 'path';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { STORES } from './models';

// ─────────────────────────────────────────────────────────────────────────────
// exportCatalog — genera catalog.json a partir de Firestore (Admin SDK)
//
// Este archivo se llama UNA VEZ al finalizar cada scrape. Nunca se usa en el
// frontend. El resultado es un JSON estático subido a Firebase Hosting y
// servido como CDN — los usuarios nunca leen Firestore directamente.
//
// Costo: ~400 lecturas (productos) + ~1200 lecturas (entries) = ~1600 reads
// una sola vez por ejecución del scraper, no por visita de usuario.
// ─────────────────────────────────────────────────────────────────────────────

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
  recordedAt: string; // ISO date string
}

interface CatalogProduct {
  slug:       string;
  id:         string;
  name:       string;
  brand:      string;
  categoryId: string;
  description: string;
  images:     string[];
  specs:      Record<string, string | number>;
  minPrice:   number;
  maxPrice:   number;
  storeCount: number;
  updatedAt:  string; // ISO date string
  createdAt:  string; // ISO date string
  entries:    CatalogEntry[];
  history:    CatalogHistoryPoint[];
}

interface CatalogStore {
  id:         string;
  slug:       string;
  name:       string;
  url:        string;
  logo:       string;
  country:    'CL';
  isActive:   boolean;
  lastScraped: string; // ISO date string
}

interface CatalogData {
  meta: {
    generatedAt:  string;
    productCount: number;
  };
  stores:   CatalogStore[];
  products: CatalogProduct[];
}

/** Convierte un Timestamp de Firestore a string ISO, o devuelve fallback. */
function toISO(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date)      return value.toISOString();
  if (typeof value === 'string')  return value;
  return new Date().toISOString();
}

/**
 * Lee todos los productos + entries de Firestore con el Admin SDK y
 * escribe `catalog.json` en `src/assets/data/` del proyecto Angular.
 *
 * Se llama una vez por ejecución del scraper — NO es una ruta del frontend.
 */
export async function exportCatalog(db: Firestore): Promise<void> {
  console.log('\n[Export] Generando catalog.json...');
  const start = Date.now();

  // ── 1. Leer todas las tiendas desde STORES (sin Firestore reads extra) ──
  const storesSnap = await db
    .collection('stores')
    .where('isActive', '==', true)
    .get();

  const stores: CatalogStore[] = storesSnap.docs.map(doc => {
    const d = doc.data();
    return {
      id:          doc.id,
      slug:        d['slug'] ?? doc.id,
      name:        d['name'] ?? '',
      url:         d['url']  ?? '',
      logo:        d['logo'] ?? '',
      country:     'CL',
      isActive:    d['isActive'] ?? true,
      lastScraped: toISO(d['lastScraped']),
    };
  });

  // ── 2. Leer todos los productos ──────────────────────────────────────────
  const productsSnap = await db.collection('products').get();
  console.log(`[Export] ${productsSnap.size} productos encontrados`);

  const products: CatalogProduct[] = [];
  let entryCount   = 0;
  let historyCount = 0;

  // Leer entries e historial en paralelo por producto
  const BATCH = 20; // procesar en lotes para evitar rate limits
  const docs = productsSnap.docs;

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async productDoc => {
        const d    = productDoc.data();
        const slug = productDoc.id;

        // ── entries ──────────────────────────────────────────────
        const entriesSnap = await productDoc.ref.collection('entries')
          .where('isActive', '==', true)
          .get();

        const entries: CatalogEntry[] = entriesSnap.docs.map(e => {
          const ed = e.data();
          return {
            storeId: ed['storeId'],
            url:     ed['url'],
            price:   ed['price'],
            stock:   ed['stock'] ?? 'unknown',
            ...(ed['sku'] ? { sku: ed['sku'] } : {}),
          };
        });

        // ── historial (últimos 90 días) ──────────────────────────
        const ninetyDaysAgo = Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const historySnap = await productDoc.ref.collection('history')
          .where('recordedAt', '>=', ninetyDaysAgo)
          .orderBy('recordedAt')
          .get();

        const history: CatalogHistoryPoint[] = historySnap.docs.map(h => {
          const hd = h.data();
          return {
            storeId:    hd['storeId'],
            price:      hd['price'],
            recordedAt: toISO(hd['recordedAt']),
          };
        });

        entryCount   += entries.length;
        historyCount += history.length;

        products.push({
          slug,
          id:          slug,
          name:        d['name']        ?? '',
          brand:       d['brand']       ?? '',
          categoryId:  d['categoryId']  ?? 'general',
          description: d['description'] ?? '',
          images:      d['images']      ?? [],
          specs:       d['specs']       ?? {},
          minPrice:    d['minPrice']    ?? 0,
          maxPrice:    d['maxPrice']    ?? 0,
          storeCount:  d['storeCount']  ?? 0,
          updatedAt:   toISO(d['updatedAt']),
          createdAt:   toISO(d['createdAt']),
          entries,
          history,
        });
      }),
    );

    if (i + BATCH < docs.length) {
      // Pequeña pausa entre lotes para no sobrecargar Firestore
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // ── 3. Ordenar por updatedAt desc (productos más recientes primero) ──────
  products.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // ── 4. Construir objeto final ────────────────────────────────────────────
  const catalog: CatalogData = {
    meta: {
      generatedAt:  new Date().toISOString(),
      productCount: products.length,
    },
    stores,
    products,
  };

  // ── 5. Escribir catalog.json ─────────────────────────────────────────────
  const outputPath = path.resolve(__dirname, '../../src/assets/data/catalog.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf-8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Export] ✓ catalog.json generado: ${products.length} productos, ${entryCount} entries, ${historyCount} puntos de historial (${elapsed}s)`);
  console.log(`[Export] Ruta: ${outputPath}`);

  // ── 6. Generar sitemap.xml dinámico ─────────────────────────────────────
  generateSitemap(catalog);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateSitemap — genera public/sitemap.xml a partir del catálogo
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = 'https://dprecios.web.app';

const STATIC_CATEGORIES = [
  'filamentos-pla',
  'filamentos-petg',
  'filamentos-abs',
  'filamentos-tpu',
  'filamentos-especiales',
  'resinas',
  'impresoras-fdm',
  'impresoras-resina',
  'accesorios',
  'secadores',
  'scanner-3d',
  'lapices-3d',
  'repuestos',
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc: string, opts: { lastmod?: string; changefreq?: string; priority?: number } = {}): string {
  const lines: string[] = [`  <url>`, `    <loc>${xmlEscape(loc)}</loc>`];
  if (opts.lastmod)    lines.push(`    <lastmod>${opts.lastmod.slice(0, 10)}</lastmod>`);
  if (opts.changefreq) lines.push(`    <changefreq>${opts.changefreq}</changefreq>`);
  if (opts.priority !== undefined) lines.push(`    <priority>${opts.priority.toFixed(1)}</priority>`);
  lines.push(`  </url>`);
  return lines.join('\n');
}

function generateSitemap(catalog: CatalogData): void {
  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [];

  // Páginas estáticas
  urls.push(urlEntry(`${SITE_URL}/`,         { changefreq: 'daily',  priority: 1.0 }));
  urls.push(urlEntry(`${SITE_URL}/categorias`, { changefreq: 'daily',  priority: 0.9 }));
  urls.push(urlEntry(`${SITE_URL}/tiendas`,    { changefreq: 'weekly', priority: 0.8 }));
  urls.push(urlEntry(`${SITE_URL}/recursos`,   { changefreq: 'monthly', priority: 0.6 }));
  urls.push(urlEntry(`${SITE_URL}/comparar`,   { changefreq: 'weekly', priority: 0.5 }));

  // Categorías
  for (const cat of STATIC_CATEGORIES) {
    urls.push(urlEntry(`${SITE_URL}/categorias/${cat}`, {
      lastmod:    today,
      changefreq: 'daily',
      priority:   0.8,
    }));
  }

  // Tiendas activas
  for (const store of catalog.stores) {
    urls.push(urlEntry(`${SITE_URL}/tiendas/${xmlEscape(store.slug)}`, {
      lastmod:    store.lastScraped.slice(0, 10),
      changefreq: 'weekly',
      priority:   0.6,
    }));
  }

  // Productos individuales (máx 50 000 URLs por sitemap — estándar Google)
  const MAX_PRODUCTS = 49_000;
  const productsSorted = catalog.products.slice(0, MAX_PRODUCTS);
  for (const product of productsSorted) {
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
  console.log(`[Export] ✓ sitemap.xml generado: ${urls.length} URLs → ${sitemapPath}`);
}
