import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, delay, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Paris.cl — Cencosud / Salesforce Commerce Cloud (SFCC)
// Scraping via AJAX search endpoint que renderiza HTML
// ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;

const SEARCH_TERMS = [
  'impresora 3d',
  'filamento 3d',
  'resina 3d',
];

const EXTRA_HEADERS = {
  Referer:    'https://www.paris.cl/',
  Origin:     'https://www.paris.cl',
  'X-Requested-With': 'XMLHttpRequest',
};

export async function scrapeParis(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      // SFCC AJAX search endpoint — returns HTML tile grid
      const url = `${store.baseUrl}/on/demandware.store/Sites-Paris-Site/es_CL/Search-Show?q=${encodeURIComponent(term)}&start=${start}&sz=${PAGE_SIZE}&format=ajax`;
      console.log(`[Paris] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500, extraHeaders: EXTRA_HEADERS } as any);

        // SFCC product tile selectors
        const products = $('.product-tile, .grid-tile, [data-itemid]');

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('.product-name a, .name-link, h3 a').first().text().trim();
          const href     = $(el).find('.product-name a, .thumb-link, h3 a').first().attr('href') ?? '';
          const priceRaw = $(el).find('.product-sales-price, .price-sales, .product-pricing .price').first().text().trim()
                        || $(el).find('.price-standard').first().text().trim();
          const imgSrc   = $(el).find('img.producttile-image, img.primary-image, img').first().attr('src')
                        ?? $(el).find('img').first().attr('data-src') ?? '';
          const stockTxt = $(el).find('.availability-msg, .stock').text();

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
            stock:       inferStock(stockTxt || 'disponible'),
            imageUrl:    imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc,
            scrapedAt:   new Date(),
          });
        });

        // SFCC indicates more results via a "show more" element or total count
        const hasNext = $('.infinite-scroll-placeholder[data-loading-state="unloaded"]').length > 0
                     || $('.show-more button').length > 0
                     || products.length === PAGE_SIZE;

        hasMore = hasNext;
        start += PAGE_SIZE;
        await delay(1500);
      } catch (err) {
        console.error(`[Paris] Error en "${term}" start=${start}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Paris] Total productos: ${results.length}`);
  return results;
}
