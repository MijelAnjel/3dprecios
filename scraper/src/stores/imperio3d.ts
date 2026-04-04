import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Imperio 3D — imperio3d.com — WooCommerce (tema Electro)
// Distribuidor oficial Bambu Lab, Prusa, eSUN en Chile
//
// La tienda usa "Electro WC per-page" plugin (form POST ppp=-1 = "Show All").
// POST ppp=-1 devuelve todos los productos de la categoría en 1 respuesta,
// eliminando la necesidad de paginar con ?page=N.
//
// Categorías obtenidas de product_cat-sitemap.xml (74 rutas).
// Se deduplica por URL de producto para evitar contar productos que
// aparecen en múltiples categorías (padre e hijo).
// ──────────────────────────────────────────────────────────────

// Categorías raíz con productos únicos (las sub-cats rolan al padre).
// Descubiertas via product_cat-sitemap.xml y verificadas manualmente.
const CATEGORY_PATHS = [
  '/categoria-producto/filamentos/',
  '/categoria-producto/filamentos/bambu-lab/',
  '/categoria-producto/filamentos/filamentos-esun/',
  '/categoria-producto/filamentos/filamentos-creality/',
  '/categoria-producto/filamentos/printalot/',
  '/categoria-producto/filamentos/filamentos-gst/',
  '/categoria-producto/filamentos/filamento-winkle/',
  '/categoria-producto/filamentos/nylon/',
  '/categoria-producto/pvoh/',
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/accesorios/',
  '/categoria-producto/repuestos/',
  '/categoria-producto/mantenimiento/',
  '/categoria-producto/adherencia/',
  '/categoria-producto/makerkit/',
  '/categoria-producto/preventa/',
  '/categoria-producto/upgrade-mejora/',
  '/categoria-producto/grabador-y-cortador-cnc/',
];

function parseProducts(
  $: ReturnType<typeof import('cheerio').load>,
  path: string,
  storeId: string,
  storeName: string,
  seen: Set<string>,
): ScraperResult[] {
  const out: ScraperResult[] = [];
  $('li.product').each((_, el) => {
    const name     = $(el).find('.woocommerce-loop-product__title').text().trim();
    const href     = $(el).find('a.woocommerce-LoopProduct-link').attr('href') ?? '';
    const priceRaw = $(el).find('.price ins .woocommerce-Price-amount bdi, .price .woocommerce-Price-amount bdi').first().text().trim();
    const imgSrc   = $(el).find('img').attr('data-src') ?? $(el).find('img').attr('data-lazy-src') ?? $(el).find('img').attr('src') ?? '';
    const isOut    = $(el).hasClass('outofstock');
    const stockTxt = $(el).find('.stock').text();
    const price    = parsePriceCLP(priceRaw);
    if (!name || !href || price === 0 || seen.has(href)) return;
    seen.add(href);
    out.push({
      storeId, storeName,
      productName:  name,
      productUrl:   href,
      price,
      currency:     'CLP',
      stock:        isOut ? 'out' : inferStock(stockTxt || 'disponible'),
      imageUrl:     imgSrc,
      categorySlug: inferCategory(name, path),
      scrapedAt:    new Date(),
    });
  });
  return out;
}

export async function scrapeImperio3d(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>(); // deduplica por URL de producto

  for (const path of CATEGORY_PATHS) {
    const baseUrl = `${store.baseUrl}${path}`;
    console.log(`[Imperio 3D] Scraping: ${baseUrl}`);

    try {
      // POST ppp=-1 → "Show All": devuelve todos los productos en una sola respuesta
      const $ = await fetchHtml(baseUrl, { rateDelay: 2000, method: 'POST', body: 'ppp=-1' });
      const products = parseProducts($, path, store.id, store.name, seen);
      console.log(`[Imperio 3D] ${path}: ${products.length} productos nuevos`);
      results.push(...products);

      // Si aún hay paginación (en teoría no debería con ppp=-1, pero por seguridad)
      let hasMore = $('a.next.page-numbers').length > 0;
      let page    = 2;
      while (hasMore && page <= 20) {
        const pageUrl = `${baseUrl}page/${page}/`;
        const $p = await fetchHtml(pageUrl, { rateDelay: 2000 });
        const more = parseProducts($p, path, store.id, store.name, seen);
        results.push(...more);
        hasMore = $p('a.next.page-numbers').length > 0;
        page++;
      }
    } catch (err) {
      console.error(`[Imperio 3D] Error en ${path}:`, err);
    }
  }

  console.log(`[Imperio 3D] Total productos: ${results.length}`);
  return results;
}
