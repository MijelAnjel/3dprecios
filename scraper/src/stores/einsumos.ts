import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// E-Insumos — e-insumos.cl — WooCommerce Store API
// Tienda de insumos con productos de impresión 3D
// Catálogo mixto — se filtra por categorías y palabras clave 3D
// ──────────────────────────────────────────────────────────────

const IS_3D_SLUG =
  /impresora|filament|resina|3d|repuesto.*3d|accesorio.*3d|bambu|creality|prusa|anycubic|elegoo|extrus|hotend|nozzle|boquilla/i;

export async function scrapeEinsumos(store: StoreConfig): Promise<ScraperResult[]> {
  const products = await fetchWcStoreProducts(store.baseUrl, [], { rateDelay: 1500 });

  const results: ScraperResult[] = products
    .filter(p => {
      const price = parseInt(p.prices?.price ?? '0', 10);
      if (price <= 0) return false;

      const catSlug = p.categories?.[0]?.slug ?? '';
      if (IS_3D_SLUG.test(catSlug)) return true;

      return inferCategory(p.name, catSlug) !== 'general';
    })
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

  console.log(`[E-Insumos] Total productos 3D: ${results.length}`);
  return results;
}
