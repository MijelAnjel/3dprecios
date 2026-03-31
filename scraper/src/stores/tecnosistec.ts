import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Tecnosistec — tecnosistec.cl — PrestaShop
// Tienda de electrónica y repuestos con sección de impresión 3D
// URL de la sección 3D: /154-repuestos-impresoras-3d
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/154-repuestos-impresoras-3d',
];

export async function scrapeTecnosistec(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const catPath of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = page === 1
        ? `${store.baseUrl}${catPath}`
        : `${store.baseUrl}${catPath}?p=${page}`;
      console.log(`[Tecnosistec] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500 });

        // PrestaShop product grid selectors
        const products = $('article.product-miniature, .product-miniature, li.product-item, .js-product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const titleEl  = $(el).find('.product-title a, .product-name a, h2 a, h3 a').first();
          const name     = titleEl.text().trim();
          const href     = titleEl.attr('href') ?? '';
          const priceRaw = $(el).find('.price, .product-price, [itemprop="price"]').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const stockTxt = $(el).find('.availability, .product-availability').text().trim();

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          const fullUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;

          results.push({
            storeId:      store.id,
            storeName:    store.name,
            productName:  name,
            productUrl:   fullUrl,
            price,
            currency:     'CLP',
            stock:        inferStock(stockTxt || 'disponible'),
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, catPath),
            scrapedAt:    new Date(),
          });
        });

        hasMore = $('a[rel="next"], .next, a.js-search-link:contains("Siguiente"), li.next a').length > 0;
        page++;
      } catch (err) {
        console.error(`[Tecnosistec] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Tecnosistec] Total productos: ${results.length}`);
  return results;
}
