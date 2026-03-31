import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Makers Chile — makerschile.cl — WooCommerce Store API
// Site renders products client-side → HTML scraping returns 0
// ──────────────────────────────────────────────────────────────
// Category IDs (3D printing only):
// 1218 Impresoras 3D FDM | 1222 Impresoras 3D RESINA
// 1216 Filamentos        | 1224 Resinas
// 1172 Repuestos FDM     | 1281 Repuestos Resina | 1282 Accesorios | 1228 Boquillas

const CATEGORY_IDS = [1218, 1222, 1216, 1224, 1172, 1281, 1282, 1228];

export async function scrapeMakerschile(store: StoreConfig): Promise<ScraperResult[]> {
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
      imageUrl:     p.images?.[0] ?? '',
      categorySlug: inferCategory(p.name, p.categories?.[0]?.slug ?? ''),
      scrapedAt:    new Date(),
    }));

  console.log(`[MakersChile] Total productos: ${results.length}`);
  return results;
}
