import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// eVStore — evstore.cl — WooCommerce Store API
// Site renders products client-side → HTML scraping returns 0
// Store sells only 3D printing products → fetch all (no cat filter)
// ──────────────────────────────────────────────────────────────
// Key categories: 27 eSUN filaments | 65 SUNLU filaments | 36 Repuestos
// 122 Impresoras | 41 Boquillas | 44 Extrusión

export async function scrapeEvstore(store: StoreConfig): Promise<ScraperResult[]> {
  // Fetch all products — store is 100% 3D printing focused
  const products = await fetchWcStoreProducts(store.baseUrl, [], { rateDelay: 1500 });

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

  console.log(`[eVStore] Total productos: ${results.length}`);
  return results;
}
