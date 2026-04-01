import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// 3D Chile (TresD) — 3d.cl
// Plataforma: PrestaShop / custom
// ──────────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  'filamento',
  'impresora 3d',
  'resina',
  'repuesto bambu',
];

const CATEGORY_URLS = [
  '/72-filamentos',
  '/73-impresoras',
  '/74-resinas',
  '/75-accesorios',
];

const MAX_PAGES = 20;

export async function scrapeTresD(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const catPath of CATEGORY_URLS) {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      const url = `${store.baseUrl}${catPath}?p=${page}`;
      console.log(`[3D Chile] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 1500 });

        // PrestaShop product grid
        const products = $('article.product-miniature, .product-miniature, li.product-item');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        const countBefore = results.length;

        products.each((_, el) => {
          const name     = $(el).find('.product-title a, .product-name a, h2 a, h3 a').first().text().trim();
          const href     = $(el).find('.product-title a, .product-name a, h2 a, h3 a').first().attr('href') ?? '';
          const priceRaw = $(el).find('.price, .product-price, [itemprop="price"]').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const stockEl  = $(el).find('.availability, .product-availability, .out-of-stock');
          const stockTxt = stockEl.text().trim();

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          const fullUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;

          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: name,
            productUrl:  fullUrl,
            price,
            currency:    'CLP',
            stock:        inferStock(stockTxt || 'disponible'),
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, catPath),
            scrapedAt:    new Date(),
          });
        });

        // Stop if no new products (duplicate page — PrestaShop behavior at end of pagination)
        if (results.length === countBefore) {
          hasMore = false;
          break;
        }

        // Scope selector to pagination wrapper to avoid false positives
        hasMore = $('.pagination a[rel="next"], #js-pagination a[rel="next"], .pagination-next a').length > 0;
        page++;
      } catch (err) {
        console.error(`[3D Chile] Error en ${url}:`, err);
        hasMore = false;
      }
    }

    if (page > MAX_PAGES) {
      console.warn(`[3D Chile] Límite de ${MAX_PAGES} páginas alcanzado en ${catPath}`);
    }
  }

  console.log(`[3D Chile] Total productos: ${results.length}`);
  return results;
}
