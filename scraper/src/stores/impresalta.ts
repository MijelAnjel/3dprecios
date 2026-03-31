import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Impresalta.cl — Tienda WooCommerce
// Endpoint: /categoria-producto/filamentos + /categoria-producto/impresoras
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/filamentos/',
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/resinas/',
  '/categoria-producto/repuestos/',
];

export async function scrapeImpresalta(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}page/${page}/`;
      console.log(`[Impresalta] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });
        const products = $('li.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name  = $(el).find('.woocommerce-loop-product__title').text().trim();
          const href  = $(el).find('a.woocommerce-LoopProduct-link').attr('href') ?? '';
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount, .price .woocommerce-Price-amount').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const stockTxt = $(el).find('.stock, .out-of-stock').text();

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;

          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: name,
            productUrl:  href,
            price,
            currency:    'CLP',
            stock:       stockTxt.includes('agotado') || $(el).hasClass('outofstock') ? 'out' : inferStock(stockTxt),
            imageUrl:    imgSrc,
            categorySlug: path.replace(/\//g, '').replace('categoria-producto', ''),
            scrapedAt:   new Date(),
          });
        });

        // WooCommerce pagination
        hasMore = $('a.next.page-numbers').length > 0;
        page++;
      } catch (err) {
        console.error(`[Impresalta] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Impresalta] Total productos: ${results.length}`);
  return results;
}
