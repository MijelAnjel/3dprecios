import { ScraperResult, StoreConfig } from '../models';
import { fetchJson, inferCategory, delay } from '../utils';

// ──────────────────────────────────────────────────────────────
// Afel — afel.cl — Shopify
// Tienda con sección dedicada de impresión 3D
// Colecciones verificadas: impresion-3d, filamento-afel,
// filamentos-artillery, filamentos-esun, repuestos-3d, impresoras-3d
// Usa la API pública de Shopify (/products.json)
// ──────────────────────────────────────────────────────────────

// Colecciones 3D confirmadas en afel.cl (Abril 2026)
const COLLECTION_HANDLES = [
  'impresion-3d',
  'filamento-afel',
  'filamentos-artillery',
  'filamentos-esun',
  'repuestos-3d',
  'impresoras-3d',
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

export async function scrapeAfel(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const handle of COLLECTION_HANDLES) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}/collections/${handle}/products.json?limit=250&page=${page}`;
      console.log(`[Afel] Scraping: ${url}`);

      try {
        const data = await fetchJson<ShopifyProductsResponse>(url, { rateDelay: 2000 });

        if (!data?.products?.length) {
          hasMore = false;
          break;
        }

        for (const product of data.products) {
          const productUrl = `${store.baseUrl}/products/${product.handle}`;
          if (seen.has(productUrl)) continue;

          const variant = product.variants
            .filter(v => v.available !== false && parseFloat(v.price) > 0)
            .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

          if (!variant) continue;

          const price = Math.round(parseFloat(variant.price));
          if (price === 0) continue;

          seen.add(productUrl);

          const stock: 'available' | 'low' | 'out' =
            variant.inventory_quantity > 5 ? 'available' :
            variant.inventory_quantity > 0 ? 'low' : 'out';

          results.push({
            storeId:      store.id,
            storeName:    store.name,
            productName:  product.title,
            productUrl,
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
    } // end while
  } // end for collections

  console.log(`[Afel] Total productos 3D: ${results.length}`);
  return results;
}
