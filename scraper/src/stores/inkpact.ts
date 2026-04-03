import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// InkPact — inkpact.cl — WooCommerce
// Tienda con sección de filamentos 3D verificada (Abril 2026)
// URL: /product-category/filamentos-3d/
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/product-category/filamentos-3d/',
];

export async function scrapeInkpact(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = page === 1
        ? `${store.baseUrl}${path}`
        : `${store.baseUrl}${path}page/${page}/`;
      console.log(`[InkPact] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });
        const products = $('li.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          // inkpact.cl uses h3.product-title (not .woocommerce-loop-product__title)
          const titleAnchor = $(el).find('h3.product-title a, .product-title a').first();
          const name     = titleAnchor.text().trim();
          const href     = titleAnchor.attr('href') ?? $(el).find('a.woocommerce-LoopProduct-link').attr('href') ?? '';
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount bdi, .price .woocommerce-Price-amount bdi').first().text().trim();
          const imgSrc   = $(el).find('img').attr('data-src') ?? $(el).find('img').attr('src') ?? '';
          const isOut    = $(el).hasClass('outofstock');
          const stockTxt = $(el).find('.product-stock .stock, .stock').first().text();

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          results.push({
            storeId:      store.id,
            storeName:    store.name,
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

        hasMore = $('a.next.page-numbers').length > 0;
        page++;
        if (page > 20) hasMore = false;
      } catch (err) {
        console.error(`[InkPact] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[InkPact] Total productos: ${results.length}`);
  return results;
}
