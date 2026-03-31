import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock } from '../utils';

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

export async function scrapeTresD(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const catPath of CATEGORY_URLS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${catPath}?p=${page}`;
      console.log(`[3D Chile] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500 });

        // PrestaShop product grid
        const products = $('article.product-miniature, .product-miniature, li.product-item');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

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
            stock:       inferStock(stockTxt || 'disponible'),
            imageUrl:    imgSrc,
            scrapedAt:   new Date(),
          });
        });

        hasMore = $('a[rel="next"], .next, a.js-search-link:contains("Siguiente")').length > 0;
        page++;
      } catch (err) {
        console.error(`[3D Chile] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[3D Chile] Total productos: ${results.length}`);
  return results;
}
