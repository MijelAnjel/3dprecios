import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Capital 3D — capital3d.cl — WooCommerce Store API
// Site renders products client-side → HTML scraping returns 0
// ──────────────────────────────────────────────────────────────
// Capital3D es tienda 100% dedicada a impresión 3D.
// Fetching all products para no perder categorías nuevas (cd3d, plapro, polyterra, etc.)
const CATEGORY_IDS: number[] = [];

export async function scrapeCapital3d(store: StoreConfig): Promise<ScraperResult[]> {
  const products = await fetchWcStoreProducts(store.baseUrl, CATEGORY_IDS, { rateDelay: 1500 });

  const results: ScraperResult[] = products
    .filter(p => p.prices?.price && parseInt(p.prices.price, 10) > 0)
    .map(p => ({
      storeId:      store.id,
      storeName:    store.name,
      productName:  p.name,
      productUrl:   p.permalink,
      price:        parseInt(p.prices.price, 10),
      currency:     'CLP' as const,
      stock:        p.is_in_stock ? 'available' : 'out',
      imageUrl:     p.images?.[0]?.src ?? '',
      categorySlug: inferCategory(p.name, p.categories?.[0]?.slug ?? ''),
      scrapedAt:    new Date(),
    }));

  console.log(`[Capital3D] Total productos: ${results.length}`);
  return results;
}

