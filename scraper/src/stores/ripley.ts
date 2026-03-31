import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, delay, parsePriceCLP, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Ripley Chile — simple.ripley.cl — Next.js SSR
// Scraping via búsqueda paginada
// ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const SEARCH_TERMS = [
  'impresora 3d',
  'filamento 3d',
  'resina 3d',
  'bambu lab impresora',
];

const EXTRA_HEADERS = {
  Referer: 'https://simple.ripley.cl/',
  Origin:  'https://simple.ripley.cl',
};

export async function scrapeRipley(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}/buscar?s=${encodeURIComponent(term)}&page=${page}&perPage=${PAGE_SIZE}`;
      console.log(`[Ripley] Scraping: ${url}`);

      try {
        const $ = await fetchHtml(url, { rateDelay: 2500, extraHeaders: EXTRA_HEADERS } as any);

        // Ripley Next.js SSR: products inside React-rendered HTML
        const products = $(
          '.catalog-item, .product-item, [class*="CatalogItem"], [class*="ProductItem"], ' +
          'li[class*="product"], article[class*="product"]'
        );

        // Fallback: check if there's a __NEXT_DATA__ JSON in the page for structured data
        if (products.length === 0) {
          const nextData = $('script#__NEXT_DATA__').text();
          if (nextData) {
            try {
              const parsed = JSON.parse(nextData);
              const items: any[] = parsed?.props?.pageProps?.products?.results
                                ?? parsed?.props?.pageProps?.productsList
                                ?? [];
              for (const item of items) {
                const productUrl = `${store.baseUrl}${item.url ?? item.path ?? ''}`;
                if (!item.displayName || seen.has(productUrl)) continue;
                seen.add(productUrl);

                const price = item.prices?.[0]?.price ?? item.price ?? 0;
                if (price === 0) continue;

                results.push({
                  storeId:     store.id,
                  storeName:   store.name,
                  productName: item.displayName ?? item.name,
                  productUrl,
                  price: Math.round(price),
                  currency:    'CLP',
                  stock:       inferStock(item.stockStatus ?? 'disponible'),
                  imageUrl:    item.mediaUrls?.[0] ?? item.image ?? '',
                  brand:       item.brand ?? undefined,
                  scrapedAt:   new Date(),
                });
              }
            } catch { /* JSON parse failed, ignore */ }
          }
          hasMore = false;
          break;
        }

        products.each((_, el) => {
          const name     = $(el).find('[class*="title"], [class*="name"], h2, h3').first().text().trim();
          const href     = $(el).find('a[href]').first().attr('href') ?? '';
          const priceRaw = $(el).find('[class*="price"], [class*="Price"]').first().text().trim();
          const imgSrc   = $(el).find('img').first().attr('src') ?? $(el).find('img').first().attr('data-src') ?? '';
          const stockTxt = $(el).find('[class*="stock"], [class*="availability"]').text();

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
            imageUrl:    imgSrc,
            scrapedAt:   new Date(),
          });
        });

        hasMore = $('[class*="pagination"] [rel="next"], [aria-label="Siguiente"], .pager-next').length > 0
               && products.length >= PAGE_SIZE;
        page++;
        await delay(1500);
      } catch (err) {
        console.error(`[Ripley] Error en "${term}" p.${page}:`, err);
        hasMore = false;
      }
    }
  }

  console.log(`[Ripley] Total productos: ${results.length}`);
  return results;
}
