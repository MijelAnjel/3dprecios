import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Nébula 3D — nebula3d.cl — WooCommerce Store API
// Tienda especializada en impresión 3D
// ──────────────────────────────────────────────────────────────

export async function scrapeNebula3d(store: StoreConfig): Promise<ScraperResult[]> {
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

  console.log(`[Nébula3D] Total productos: ${results.length}`);
  return results;
}
