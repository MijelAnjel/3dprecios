import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// PC Factory — impresoras 3D + filamentos/resinas
const CATEGORY_PATHS = [
  '/categoria/impresoras-y-suministros/impresoras-formatos-especiales/impresoras-3d',
  '/categoria/impresoras-y-suministros/otros-suministros-impresion/resinas-y-filamentos-impresion-3d',
];

export async function scrapePcfactory(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}${path.includes('?') ? '&' : '?'}page=${page}`;
      console.log(`[PCFactory] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500 });

        const products = $('.product-card, .product-item, [class*="ProductCard"], article.product');

        if (products.length === 0) { hasMore = false; break; }

        products.each((_, el) => {
          const name     = $(el).find('h2, h3, .product-name, [class*="title"], [class*="name"]').first().text().trim();
          const href     = $(el).find('a').first().attr('href') ?? '';
          const priceRaw = $(el).find('[class*="price"], .price, [class*="Price"]').first().text().trim();
          const imgSrc   = $(el).find('img').attr('data-src') ?? $(el).find('img').attr('data-lazy-src') ?? $(el).find('img').attr('src') ?? '';
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

        hasMore = $('a[rel="next"], .pagination .next').length > 0;
        page++;
        if (page > 10) hasMore = false;
      } catch (err) {
        console.error(`[PCFactory] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[PCFactory] Total productos: ${results.length}`);
  return results;
}
