import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Imperio 3D — imperio3d.com — WooCommerce
// Distribuidor oficial Bambu Lab, Prusa, eSUN en Chile
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/filamentos/',
  '/categoria-producto/accesorios/',
  '/categoria-producto/repuestos/',
  '/categoria-producto/mantenimiento/',
];

export async function scrapeImperio3d(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}page/${page}/`;
      console.log(`[Imperio 3D] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500 });
        const products = $('li.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('.woocommerce-loop-product__title').text().trim();
          const href     = $(el).find('a.woocommerce-LoopProduct-link').attr('href') ?? '';
          // Selects sale price if exists, otherwise regular price
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount bdi, .price .woocommerce-Price-amount bdi').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const isOut    = $(el).hasClass('outofstock');
          const stockTxt = $(el).find('.stock').text();

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: name,
            productUrl:  href,
            price,
            currency:    'CLP',
            stock:       isOut ? 'out' : inferStock(stockTxt || 'disponible'),
            imageUrl:    imgSrc,
            scrapedAt:   new Date(),
          });
        });

        hasMore = $('a.next.page-numbers').length > 0;
        page++;
      } catch (err) {
        console.error(`[Imperio 3D] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Imperio 3D] Total productos: ${results.length}`);
  return results;
}
