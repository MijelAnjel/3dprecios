import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Capital 3D — capital3d.cl — WooCommerce Store API
// Site renders products client-side → HTML scraping returns 0
// ──────────────────────────────────────────────────────────────
// Category IDs:
// 54 Impresoras 3D | 43 Resina | 49 Repuestos
// 26 PLA | 29 ABS | 30 PETG | 27 TPU-95A | 50 Filamentos Especiales | 39 PLA Pro | 40 PolyTerra

const CATEGORY_IDS = [54, 43, 49, 26, 29, 30, 27, 50, 39, 40];

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

