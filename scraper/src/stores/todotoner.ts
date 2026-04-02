import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// TodoToner — todotoner.cl — Jumpseller platform, SSR rendered
// Products: button[data-product-name] with .parents('[data-product-id]')
// Pagination: ?page=N — detected from max page= link on first page
// ──────────────────────────────────────────────────────────────

// Sub-categorías Jumpseller — más eficiente que scraping todo /todo-3d/
const SECTION_PATHS = [
  '/filamentos',              // todos los filamentos (marca propia + Bambu, eSUN, Creality, Elegoo…)
  '/impresoras-3d',           // impresoras FDM + resina
  '/resinas',                 // resinas líquidas
  '/repuestos-3d',            // repuestos Creality, Anycubic, etc.
  '/accesorios-3d',           // accesorios
  '/grabado-laser',           // grabadoras / cortadoras láser
  '/dry-box',                 // secadores de filamento
  '/scanner-3d',              // scanners 3D
  '/lapices-3d',              // lápices 3D
  '/todo-3d/lavado-y-curado', // wash & cure machines
];

// Pages cap per category to avoid runaway scraping on huge catalogs
const MAX_PAGES = 30;

export async function scrapeTodotoner(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of SECTION_PATHS) {
    const baseUrl = `${store.baseUrl}${path}`;
    console.log(`[TodoToner] Scraping: ${baseUrl}`);

    let lastPage = 1;

    for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
      const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

      try {
        const $ = await fetchHtml(pageUrl, { rateDelay: 1500 });

        // On first page, detect total pages from highest ?page= link
        if (page === 1) {
          $('a[href*="?page="]').each((_, el) => {
            const m = ($(el).attr('href') ?? '').match(/\?page=(\d+)/);
            if (m) lastPage = Math.max(lastPage, parseInt(m[1], 10));
          });
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
        console.error(`[TodoToner] Error en ${pageUrl}:`, err);
        break; // skip remaining pages for this path on error
      }

      if (page < Math.min(lastPage, MAX_PAGES)) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  console.log(`[TodoToner] Total productos: ${results.length}`);
  return results;
}

