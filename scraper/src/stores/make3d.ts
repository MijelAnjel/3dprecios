import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Make 3D Chile — make3d.cl — Jumpseller platform (NOT WooCommerce)
// Pagination: ?page=N  (NOT /page/N/)
// Category URLs: /impresoras-3d | /filamentos-para-impresion-3d | ...
// Product selectors: h3 a (title/url), .current-price/.money (price)
// ──────────────────────────────────────────────────────────────

// Categorías verificadas en make3d.cl (Abril 2026)
const CATEGORY_PATHS = [
  '/impresoras-3d',
  '/filamentos-para-impresion-3d',
  '/resina',
  '/repuestos',
  '/insumos-para-impresion-3d',
];

export async function scrapeMake3d(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      // Jumpseller paginates with ?page=N (not /page/N/)
      const url = page === 1
        ? `${store.baseUrl}${path}`
        : `${store.baseUrl}${path}?page=${page}`;
      console.log(`[Make3D] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2000 });

        // Jumpseller product containers — common class names across themes
        const products = $('li.product, li.col, .product-item, article.product').filter((_, el) => {
          // Must contain an H3 (product title) to avoid picking up non-product li
          return $(el).find('h3').length > 0;
        });

        if (products.length === 0) { hasMore = false; break; }

        products.each((_, el) => {
          // Jumpseller title: h3 > a (Popup/Loop themes)
          const titleAnchor = $(el).find('h3 a, .product-name a, .product-title a').first();
          const name = titleAnchor.text().trim();
          let href   = titleAnchor.attr('href')
                    ?? $(el).find('a[href^="/"]').first().attr('href')
                    ?? '';

          if (!name || !href) return;
          if (!href.startsWith('http')) href = `${store.baseUrl}${href}`;
          if (seen.has(href)) return;

          // Price: Jumpseller uses .money, .current-price, or span.product-price
          const priceRaw = $(el)
            .find('.money, .current-price, .product-price-amount, .js-price-amount, .product-price span, .price')
            .filter((_, priceEl) => /\$/.test($(priceEl).text()))
            .first()
            .text()
            .trim();

          const price = parsePriceCLP(priceRaw);
          if (price === 0) return;

          seen.add(href);
          const imgSrc = $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? '';
          const isOut  = /agotado/i.test($(el).text());

          results.push({
            storeId:      store.id,
            storeName:    store.name,
            productName:  name,
            productUrl:   href,
            price,
            currency:     'CLP',
            stock:        isOut ? 'out' : 'available',
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, path),
            scrapedAt:    new Date(),
          });
        });

        // Jumpseller pagination: look for ?page=N+1 link or rel="next"
        hasMore = $(`a[href*="?page=${page + 1}"], a[rel="next"], .pagination .next, a.next`).length > 0;
        page++;
        if (page > 30) hasMore = false; // safety cap
      } catch (err) {
        console.error(`[Make3D] Error en ${url}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Make3D] Total productos: ${results.length}`);
  return results;
}
