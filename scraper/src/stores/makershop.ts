import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// MakerShop.cl — Tienda general de impresión 3D
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/filamentos/',
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/resinas/',
  '/categoria-producto/herramientas/',
];

export async function scrapeMakershop(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}page/${page}/`;
      console.log(`[MakerShop] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });
        const products = $('li.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('.woocommerce-loop-product__title').text().trim();
          const href     = $(el).find('a.woocommerce-LoopProduct-link').attr('href') ?? '';
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount, .price .woocommerce-Price-amount').first().text().trim();
          const imgSrc   = $(el).find('img').attr('data-src') ?? $(el).find('img').attr('src') ?? '';
          const outStock = $(el).hasClass('outofstock');
          const lowStock = $(el).find('.stock').text().toLowerCase().includes('quedan');

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: name,
            productUrl:  href,
            price,
            currency:    'CLP',
            stock:        outStock ? 'out' : lowStock ? 'low' : 'available',
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, path),
            scrapedAt:    new Date(),
          });
        });

        hasMore = $('a.next.page-numbers').length > 0;
        page++;
      } catch (err) {
        console.error(`[MakerShop] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[MakerShop] Total productos: ${results.length}`);
  return results;
}
