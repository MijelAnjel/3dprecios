import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// TodoToner — todotoner.cl — Jumpseller platform, SSR rendered
// Products: button[data-product-name] with .parents('[data-product-id]')
// ──────────────────────────────────────────────────────────────

const SECTION_PATHS = [
  '/todo-3d/',
  '/todo-3d/lavado-y-curado',
];

export async function scrapeTodotoner(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of SECTION_PATHS) {
    const url = `${store.baseUrl}${path}`;
    console.log(`[TodoToner] Scraping: ${url}`);

    try {
      const $ = await fetchHtml(url, { rateDelay: 2000 });

      $('button[data-product-name]').each((_, el) => {
        const name   = $(el).attr('data-product-name')?.trim() ?? '';
        const relUrl = $(el).attr('data-product-url') ?? '';
        if (!name || !relUrl || seen.has(relUrl)) return;

        const container = $(el).parents('[data-product-id]').first();
        const priceRaw  = container.find('.product-block__price--new, .product-block__price').first().text().trim();
        const imgSrc    = container.find('img[src]').not('[src*="data:"]').first().attr('src') ?? '';
        const price     = parsePriceCLP(priceRaw);
        if (price === 0) return;

        seen.add(relUrl);
        const productUrl = relUrl.startsWith('http') ? relUrl : `${store.baseUrl}${relUrl}`;

        results.push({
          storeId:      store.id,
          storeName:    store.name,
          productName:  name,
          productUrl,
          price,
          currency:     'CLP',
          stock:        'available',
          imageUrl:     imgSrc,
          categorySlug: inferCategory(name, relUrl),
          scrapedAt:    new Date(),
        });
      });
    } catch (err) {
      console.error(`[TodoToner] Error en ${url}:`, err);
    }
  }

  console.log(`[TodoToner] Total productos: ${results.length}`);
  return results;
}

