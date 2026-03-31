import { ScraperResult, StoreConfig } from '../models';
import { fetchJson, inferCategory, delay } from '../utils';

// ──────────────────────────────────────────────────────────────
// Afel — afel.cl — Shopify
// Tienda de repuestos electrónicos con sección de impresión 3D
// URL de interés: afel.cl/collections/repuestos-3d
// Usa la API pública de Shopify (/products.json)
// ──────────────────────────────────────────────────────────────

const KEYWORDS_3D = [
  'impresora', 'impresion 3d', 'filamento', 'resina', 'pla', 'petg', 'abs', 'tpu',
  'bambu', 'creality', 'ender', 'prusa', 'anycubic', 'elegoo', 'flashforge',
  'extrusor', 'hotend', 'nozzle', 'boquilla', 'cama caliente', 'heatbed',
  'sensor filament', 'repuesto 3d', 'accesorio 3d', 'bowden', 'modelo 3d',
];

interface ShopifyVariant {
  price: string;
  inventory_quantity: number;
  available: boolean;
}

interface ShopifyProduct {
  title: string;
  handle: string;
  variants: ShopifyVariant[];
  images: { src: string }[];
  tags: string;
  vendor: string;
  product_type: string;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

function is3DRelated(p: ShopifyProduct): boolean {
  const haystack = [p.title, p.product_type, p.tags, p.vendor].join(' ').toLowerCase();
  return KEYWORDS_3D.some(kw => haystack.includes(kw));
}

export async function scrapeAfel(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${store.baseUrl}/collections/repuestos-3d/products.json?limit=250&page=${page}`;
    console.log(`[Afel] Scraping: ${url}`);

    try {
      const data = await fetchJson<ShopifyProductsResponse>(url, { rateDelay: 2000 });

      if (!data?.products?.length) {
        hasMore = false;
        break;
      }

      for (const product of data.products) {
        if (!is3DRelated(product)) continue;

        const variant = product.variants
          .filter(v => v.available !== false && parseFloat(v.price) > 0)
          .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

        if (!variant) continue;

        const price = Math.round(parseFloat(variant.price));
        if (price === 0) continue;

        const stock: 'available' | 'low' | 'out' =
          variant.inventory_quantity > 5 ? 'available' :
          variant.inventory_quantity > 0 ? 'low' : 'out';

        results.push({
          storeId:      store.id,
          storeName:    store.name,
          productName:  product.title,
          productUrl:   `${store.baseUrl}/products/${product.handle}`,
          price,
          currency:     'CLP',
          stock,
          imageUrl:     product.images[0]?.src ?? '',
          categorySlug: inferCategory(product.title, product.product_type),
          scrapedAt:    new Date(),
        });
      }

      // Shopify API returns all results if less than limit
      if (data.products.length < 250) {
        hasMore = false;
      } else {
        page++;
        await delay(1500);
      }
    } catch (err) {
      console.error(`[Afel] Error en ${url}:`, err);
      hasMore = false;
    }
  }

  console.log(`[Afel] Total productos 3D: ${results.length}`);
  return results;
}
