import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// TodoToner — todotoner.cl — Jumpseller platform, SSR rendered
// Products: button[data-product-name] with .parents('[data-product-id]')
// Pagination: ?page=N — detected from max page= link on first page
// ──────────────────────────────────────────────────────────────

// /todo-3d es la ruta agregadora de todo el catálogo 3D (59 páginas, ~2360 productos).
// Es más completo y simple que scraping por sub-categorías, ya que la inferencia de
// categoría se hace desde la URL del producto (e.g. /impresoras/impresoras-3d/filamentos/...).
const SECTION_PATHS = [
  '/todo-3d',
];

// 59 páginas en /todo-3d (verificado en sitio). Margen de +5 por si crece.
const MAX_PAGES = 65;

export async function scrapeTodotoner(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of SECTION_PATHS) {
    const baseUrl = `${store.baseUrl}${path}`;
    console.log(`[TodoToner] Scraping: ${baseUrl}`);

    let lastPage = 1;
    let consecutiveErrors = 0;

    for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
      const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

      try {
        const $ = await fetchHtml(pageUrl, { rateDelay: 1500 });
        consecutiveErrors = 0;

        // On first page, detect total pages from highest ?page= link
        if (page === 1) {
          $('a[href*="?page="]').each((_, el) => {
            const m = ($(el).attr('href') ?? '').match(/\?page=(\d+)/);
            if (m) lastPage = Math.max(lastPage, parseInt(m[1], 10));
          });

          // Fallback: parse "Productos X-Y de TOTAL productos" to compute lastPage
          if (lastPage === 1) {
            const bodyText = $('body').text();
            const mCount = bodyText.match(/(\d+)-(\d+)\s+de\s+([\d.]+)\s+productos/i);
            if (mCount) {
              const perPage = parseInt(mCount[2], 10) - parseInt(mCount[1], 10) + 1;
              const total = parseInt(mCount[3].replace(/\./g, ''), 10);
              if (perPage > 0 && total > perPage) {
                lastPage = Math.ceil(total / perPage);
              }
            }
          }

          if (lastPage > 1) {
            console.log(`[TodoToner] ${path} → ${lastPage} página(s)`);
          }
        }

        $('button[data-product-name]').each((_, el) => {
          const name   = $(el).attr('data-product-name')?.trim() ?? '';
          const relUrl = $(el).attr('data-product-url') ?? '';
          if (!name || !relUrl || seen.has(relUrl)) return;

          const container = $(el).parents('[data-product-id]').first();
          const priceRaw  = container.find('.product-block__price--new, .product-block__price').first().text().trim();
          const imgSrc    = container.find('img[src]').not('[src*="data:"]').first().attr('src') ?? '';
          const price     = parsePriceCLP(priceRaw);
          if (price === 0) return;

          // Detect out-of-stock: Jumpseller shows "Agotado" in the discount badge
          const badgeText = container.text();
          const stock: 'available' | 'out' = badgeText.includes('Agotado') ? 'out' : 'available';

          seen.add(relUrl);
          const productUrl = relUrl.startsWith('http') ? relUrl : `${store.baseUrl}${relUrl}`;

          results.push({
            storeId:      store.id,
            storeName:    store.name,
            productName:  name,
            productUrl,
            price,
            currency:     'CLP',
            stock:        stock,
            imageUrl:     imgSrc,
            categorySlug: inferCategory(name, relUrl),
            scrapedAt:    new Date(),
          });
        });
      } catch (err) {
        console.error(`[TodoToner] Error en ${pageUrl}:`, err);
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          console.error(`[TodoToner] 3 errores consecutivos en ${path}, abortando`);
          break;
        }
        // Single error: skip this page, continue with next
      }

      if (page < Math.min(lastPage, MAX_PAGES)) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  console.log(`[TodoToner] Total productos: ${results.length}`);
  return results;
}

