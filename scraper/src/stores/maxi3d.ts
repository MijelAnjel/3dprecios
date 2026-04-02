import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Maxi 3D — maxi3d.cl — WooCommerce
// 282 filamentos (eSUN + iSANMATE) + resinas + insumos + repuestos
// IMPORTANT: paginación usa ?product-page=N (no /page/N/)
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/filamentos/',
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/resinas/',
  '/categoria-producto/repuestos/',
  '/categoria-producto/insumos/',
  '/categoria-producto/herramientas3d/',
];

export async function scrapeMaxi3d(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      // maxi3d.cl uses ?product-page=N for WooCommerce category pagination
      const url = page === 1
        ? `${store.baseUrl}${path}`
        : `${store.baseUrl}${path}?product-page=${page}`;
      console.log(`[Maxi3D] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });
        const products = $('li.product');
        if (products.length === 0) { hasMore = false; break; }

        products.each((_, el) => {
          const name     = $(el).find('.woocommerce-loop-product__title').text().trim();
          const href     = $(el).find('a.woocommerce-LoopProduct-link').attr('href') ?? '';
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount, .price .woocommerce-Price-amount').first().text().trim();
          const imgSrc   = $(el).find('img').attr('data-src') ?? $(el).find('img').attr('data-lazy-src') ?? $(el).find('img').attr('src') ?? '';
          const stockTxt = $(el).find('.stock, .out-of-stock').text();
          const price    = parsePriceCLP(priceRaw);

          if (!name || !href || price === 0) return;
          if (seen.has(href)) return;
          seen.add(href);

          results.push({
            storeId: store.id, storeName: store.name,
            productName: name, productUrl: href, price, currency: 'CLP',
            stock: $(el).hasClass('outofstock') ? 'out' : inferStock(stockTxt),
            imageUrl: imgSrc,
            categorySlug: inferCategory(name, path),
            scrapedAt: new Date(),
          });
        });

        // Standard WooCommerce next-page link (still present with ?product-page pagination)
        hasMore = $('a.next.page-numbers, a[href*="product-page="]').filter((_, el) => {
          const href = $(el).attr('href') ?? '';
          const match = href.match(/product-page=(\d+)/);
          return match ? parseInt(match[1]) === page + 1 : false;
        }).length > 0 || $('a.next.page-numbers').length > 0;
        page++;
        if (page > 25) hasMore = false; // safety
      } catch (err) {
        console.error(`[Maxi3D] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Maxi3D] Total productos: ${results.length}`);
  return results;
}
