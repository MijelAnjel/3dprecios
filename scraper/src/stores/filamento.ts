import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Filamento.cl — Tienda especializada en filamentos
// WooCommerce con rutas de categoría /categoria/ (no /categoria-producto/)
// ──────────────────────────────────────────────────────────────

const CATEGORY_PATHS = [
  '/categoria/filamento-pla/',
  '/categoria/filamento-abs/',
  '/categoria/filamento-petg/',
  '/categoria/filamento-tpu/',
  '/categoria/filamentos-tecnicos/',
  '/categoria/resinas/',
  '/categoria/impresoras/',
  '/categoria/accesorios/',
];

export async function scrapeFilamento(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}page/${page}/`;
      console.log(`[Filamento.cl] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });
        const products = $('li.product, .product-small, .product');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('.woocommerce-loop-product__title, .product-title, h2, h3').first().text().trim();
          const href     = $(el).find('a.woocommerce-LoopProduct-link, a[href*="/producto"]').first().attr('href') ?? '';
          const priceRaw = $(el).find('.woocommerce-Price-amount, .price').first().text().trim();
          const imgSrc   = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const outStock = $(el).hasClass('outofstock');

          const price = parsePriceCLP(priceRaw);
          if (!name || !href || price === 0) return;
          if (seen.has(href)) return;
          seen.add(href);

          results.push({
            storeId:      store.id,
            storeName:    store.name,
            productName:  name,
            productUrl:   href,
            price,
            currency:     'CLP',
            stock:        outStock ? 'out' : inferStock('disponible'),
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, path),
            scrapedAt:    new Date(),
          });
        });

        hasMore = $('a.next.page-numbers').length > 0;
        page++;
      } catch (err) {
        console.error(`[Filamento.cl] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Filamento.cl] Total productos: ${results.length}`);
  return results;
}
