import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Filamentos Maxi — filamentosmaxi.cl — WooCommerce
// Tienda especializada en filamentos y consumibles para impresión 3D
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/filamentos/',
  '/categoria-producto/filamentos-pla/',
  '/categoria-producto/filamentos-petg/',
  '/categoria-producto/filamentos-abs/',
  '/categoria-producto/filamentos-tpu/',
  '/categoria-producto/filamentos-flexibles/',
  '/categoria-producto/resinas/',
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/accesorios/',
  '/shop/',
];

export async function scrapeFilamentosMaxi(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}page/${page}/`;
      console.log(`[Filamentos Maxi] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500 });
        const products = $('li.product, article.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('.woocommerce-loop-product__title, h2').first().text().trim();
          const href     = $(el).find('a.woocommerce-LoopProduct-link, a[href*="/producto/"]').first().attr('href') ?? '';
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount bdi, .price .woocommerce-Price-amount bdi, .price .amount').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const isOut    = $(el).hasClass('outofstock');
          const stockTxt = $(el).find('.stock').text();

          const price = parsePriceCLP(priceRaw);
          const fullUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;

          if (!name || !fullUrl || price === 0 || seen.has(fullUrl)) return;
          seen.add(fullUrl);

          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: name,
            productUrl:  fullUrl,
            price,
            currency:    'CLP',
            stock:       isOut ? 'out' : inferStock(stockTxt || 'disponible'),
            imageUrl:    imgSrc,
            scrapedAt:   new Date(),
          });
        });

        hasMore = $('a.next.page-numbers').length > 0;
        page++;
      } catch (err) {
        console.error(`[Filamentos Maxi] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Filamentos Maxi] Total productos: ${results.length}`);
  return results;
}
