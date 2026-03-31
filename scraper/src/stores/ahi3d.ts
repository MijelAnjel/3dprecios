import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// AHI 3D — ahi3d.cl
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/collections/filamentos',
  '/collections/impresoras',
  '/collections/resinas',
  '/collections/accesorios',
];

export async function scrapeAhi3d(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}?page=${page}`;
      console.log(`[AHI 3D] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });

        // Shopify-style grid
        const products = $('.product-item, .grid__item, [data-product-id]');

        if (products.length === 0) {
          // Try JSON product data embedded in page (Shopify pattern)
          const jsonMatch = $('script[type="application/ld+json"]').toArray()
            .map(el => { try { return JSON.parse($(el).html() ?? ''); } catch { return null; } })
            .filter(Boolean)
            .find(d => d['@type'] === 'ItemList' || d['@type'] === 'Product');

          if (!jsonMatch) { hasMore = false; break; }
        }

        products.each((_, el) => {
          const name     = $(el).find('.product-item__title, .product-title, h3, h2').first().text().trim();
          const href     = $(el).find('a[href]').first().attr('href') ?? '';
          const priceRaw = $(el).find('.price, .product-price, .price__regular, [data-regular-price]').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const stockTxt = $(el).find('.sold-out, .unavailable, .available').text();

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
            stock:       $(el).find('.sold-out').length ? 'out' : inferStock(stockTxt || 'disponible'),
            imageUrl:    imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc,
            scrapedAt:   new Date(),
          });
        });

        hasMore = $('a[rel="next"], .pagination__next, a:contains("Siguiente")').length > 0 && products.length > 0;
        page++;
      } catch (err) {
        console.error(`[AHI 3D] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[AHI 3D] Total productos: ${results.length}`);
  return results;
}
