import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Makers Chile — makerschile.cl — WooCommerce Store API
// Site renders products client-side → HTML scraping returns 0
// El catálogo mezcla productos 3D con electrónica general.
// Se excluyen categorías WC explícitamente no-3D.
// ──────────────────────────────────────────────────────────────

// Categorías WC de MakersChile que definitivamente no son 3D printing
// Nota: maquinas-cnc-laser/laser-co2/laser-diodo SÍ son válidos (grabadoras láser)
const NON_3D_SLUGS =
  /bater[íi]as?|lora\b|espressif|gsm|gprs|sensores|raspberry|sin-categoria/i;

// Marcas y categorías WC que SÍ son 3D printing (aunque no digan "impresora")
const IS_3D_SLUG =
  /impresora|filament|repuesto|accesorio|resina|3d|bambu|creality|prusa|anycubic|elegoo|flashforge|qidi|artillery/i;

export async function scrapeMakerschile(store: StoreConfig): Promise<ScraperResult[]> {
  // Fetch ALL products — la tienda mezcla 3D con otros productos
  const products = await fetchWcStoreProducts(store.baseUrl, [], { rateDelay: 1500 });

  const results: ScraperResult[] = products
    .filter(p => {
      const price = parseInt(p.prices?.price ?? '0', 10);
      if (price <= 0) return false;

      const catSlug = p.categories?.[0]?.slug ?? '';

      // Excluir explícitamente categorías no-3D
      if (NON_3D_SLUGS.test(catSlug)) return false;

      // Incluir si la categoría WC es claramente 3D-related
      if (IS_3D_SLUG.test(catSlug)) return true;

      // Fallback: usar inferCategory en nombre para el resto
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

  console.log(`[MakersChile] Total productos: ${results.length}`);
  return results;
}

