import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Formageo.cl — Tienda WooCommerce / Jumpseller
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria-producto/filamento/',
  '/categoria-producto/impresoras/',
  '/categoria-producto/resinas/',
  '/categoria-producto/accesorios/',
];

const MAX_PAGES = 20;

export async function scrapeFormageo(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      const url = `${store.baseUrl}${path}?page=${page}`;
      console.log(`[Formageo] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });

        // Try WooCommerce structure first, then generic grid
        let products = $('li.product, .product-item, article.product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name  = $(el).find('.woocommerce-loop-product__title, .product-name, h2, h3').first().text().trim();
          const href  = $(el).find('a[href]').first().attr('href') ?? '';
          const priceRaw = $(el).find('.price .woocommerce-Price-amount, .price, [data-price]').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
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
            stock:       inferStock(stockTxt || ($(el).hasClass('outofstock') ? 'sin stock' : 'disponible')),
            imageUrl:    imgSrc,
            scrapedAt:   new Date(),
          });
        });

        hasMore = $('a.next.page-numbers, a[rel="next"]').length > 0 && products.length > 0;
        page++;
      } catch (err) {
        console.error(`[Formageo] Error en ${url}:`, err);
        hasMore = false;
      }
    }

    if (page > MAX_PAGES) {
      console.warn(`[Formageo] Límite de ${MAX_PAGES} páginas alcanzado en ${path}`);
    }
  }

  console.log(`[Formageo] Total productos: ${results.length}`);
  return results;
}
