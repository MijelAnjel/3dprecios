import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// TodoToner — sección Todo 3D
// URL: https://www.todotoner.cl/todo-3d
const SECTION_PATHS = [
  '/todo-3d/filamentos',
  '/todo-3d/impresoras-3d',
  '/todo-3d/resinas',
  '/todo-3d/accesorios-3d',
];

export async function scrapeTodotoner(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of SECTION_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}?page=${page}`;
      console.log(`[TodoToner] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });

        // TodoToner usa su propio layout (no WooCommerce estándar)
        const products = $('[class*="product-card"], .product-item, article.product, .card-product');

        if (products.length === 0) {
          // Intentar selectores alternativos
          const altProducts = $('div[data-product-id], .product');
          if (altProducts.length === 0) { hasMore = false; break; }
        }

        products.each((_, el) => {
          const name     = $(el).find('h2, h3, .product-name, .card-title, [class*="name"]').first().text().trim();
          const href     = $(el).find('a').first().attr('href') ?? '';
          const priceRaw = $(el).find('[class*="price"], .price').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const price    = parsePriceCLP(priceRaw);
          if (!name || price === 0) return;

          const fullUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;

          results.push({
            storeId: store.id, storeName: store.name,
            productName: name, productUrl: fullUrl, price, currency: 'CLP',
            stock: 'unknown',
            imageUrl: imgSrc,
            categorySlug: inferCategory(name, path),
            scrapedAt: new Date(),
          });
        });

        hasMore = $('a[rel="next"], .pagination .next, a:contains("Siguiente")').length > 0;
        page++;
        if (page > 20) hasMore = false;
      } catch (err) {
        console.error(`[TodoToner] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[TodoToner] Total productos: ${results.length}`);
  return results;
}
