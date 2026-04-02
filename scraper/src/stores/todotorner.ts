import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Todo Torner — todotorner.cl — WooCommerce
// Tienda especializada en impresoras 3D tipo Torner/CoreXY
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/impresoras-3d/',
  '/categoria-producto/impresoras/',
  '/categoria-producto/filamentos/',
  '/categoria-producto/accesorios/',
  '/categoria-producto/componentes/',
];

export async function scrapeTodoTorner(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}page/${page}/`;
      console.log(`[Todo Torner] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500 });

        // Try WooCommerce product list
        const products = $('li.product, article.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('.woocommerce-loop-product__title, .product-title, h2, h3').first().text().trim();
          const href     = $(el).find('a.woocommerce-LoopProduct-link, a[href*="/producto/"], a[href*="/product/"]').first().attr('href') ?? '';
          const priceRaw = $(el).find('.price ins .woocommerce-Price-amount bdi, .price .woocommerce-Price-amount bdi, .price .amount').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const isOut    = $(el).hasClass('outofstock');
          const stockTxt = $(el).find('.stock, .availability').text();

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
            stock:        isOut ? 'out' : inferStock(stockTxt || 'disponible'),
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, path),
            scrapedAt:    new Date(),
          });
        });

        hasMore = $('a.next.page-numbers, a.next[rel="next"]').length > 0;
        page++;
      } catch (err) {
        console.error(`[Todo Torner] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Todo Torner] Total productos: ${results.length}`);
  return results;
}
