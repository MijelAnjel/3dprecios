import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Makers Chile — makerschile.cl — WooCommerce Store API
// Site renders products client-side → HTML scraping returns 0
// Buscamos todos los productos y filtramos por categoría inferida
// (los category_ids específicos incluían categorías no-3D)
// ──────────────────────────────────────────────────────────────

export async function scrapeMakerschile(store: StoreConfig): Promise<ScraperResult[]> {
  // Fetch ALL products — la tienda mezcla 3D con otros productos
  const products = await fetchWcStoreProducts(store.baseUrl, [], { rateDelay: 1500 });

  const results: ScraperResult[] = products
    .filter(p => {
      if (!p.prices?.price || parseInt(p.prices.price, 10) <= 0) return false;
      // Descartar productos que no son de impresión 3D
      const catSlug = p.categories?.[0]?.slug ?? '';
      const cat = inferCategory(p.name, catSlug);
      return cat !== 'general';
    })
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
