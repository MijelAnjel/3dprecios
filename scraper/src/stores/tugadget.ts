import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// TuGadget — tugadget.cl — PrestaShop
// Tienda de electrónica con sección de impresión 3D
// Categorías 3D verificadas (Abril 2026):
//   /68-impresion-3d          /76-accesorios-y-repuestos-para-impresoras-3d
//   /70-impresoras-de-filamento-   /82-escaner-3d-scanners-3d-portatiles-y-escritorio-
//   /71-impresoras-de-resina
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/68-impresion-3d',
  '/70-impresoras-de-filamento-',
  '/71-impresoras-de-resina',
  '/76-accesorios-y-repuestos-para-impresoras-3d',
  '/82-escaner-3d-scanners-3d-portatiles-y-escritorio-',
];

// Safety guard: PrestaShop stores rarely exceed 30 pages
const MAX_PAGES = 30;

export async function scrapeTugadget(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const catPath of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      const url = page === 1
        ? `${store.baseUrl}${catPath}`
        : `${store.baseUrl}${catPath}?p=${page}`;
      console.log(`[TuGadget] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 1500 });

        // PrestaShop product grid selectors
        const products = $('article.product-miniature, .product-miniature, li.product-item, .js-product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        const countBefore = results.length;

        products.each((_, el) => {
          const titleEl  = $(el).find('.product-title a, .product-name a, h2 a, h3 a').first();
          const name     = titleEl.text().trim();
          const href     = titleEl.attr('href') ?? '';
          const priceRaw = $(el).find('.price, .product-price, [itemprop="price"]').first().text().trim();
          const imgSrc   = $(el).find('img').attr('data-src') ?? $(el).find('img').attr('src') ?? '';
          const stockTxt = $(el).find('.availability, .product-availability').text().trim();

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          const fullUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;
          if (seen.has(fullUrl)) return;
          seen.add(fullUrl);

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

        // Stop if no new products were added (duplicate page — common PrestaShop behavior at end)
        if (results.length === countBefore) {
          hasMore = false;
          break;
        }

        // PrestaShop next page link
        hasMore = $('.pagination a[rel="next"], #js-pagination a[rel="next"], .pagination-next a').length > 0;
        page++;
      } catch (err) {
        console.error(`[TuGadget] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[TuGadget] Total productos: ${results.length}`);
  return results;
}
