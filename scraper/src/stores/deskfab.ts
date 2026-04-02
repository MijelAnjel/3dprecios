import { ScraperResult, StoreConfig } from '../models';
import { fetchJson, inferStock, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// DeskFab — deskfab.cl — Shopify
// Tienda maker: impresoras, filamentos, electrónica
// Usa la API pública de Shopify (/products.json)
// ──────────────────────────────────────────────────────────────

// 3D-printing related keywords to filter from all products
const KEYWORDS_3D = [
  'impresora', 'filamento', 'resina', 'pla', 'petg', 'abs', 'tpu', 'asa',
  'bambu', 'creality', 'prusa', 'ender', 'anycubic', 'elegoo', 'flashforge',
  'extrusor', 'hotend', 'cama caliente', 'nozzle', 'boquilla', 'ams',
  'resin', 'uv lamp', 'fdm', 'sla', 'msla',
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

function is3DRelated(product: ShopifyProduct): boolean {
  const haystack = [product.title, product.product_type, product.tags, product.vendor]
    .join(' ')
    .toLowerCase();
  return KEYWORDS_3D.some(kw => haystack.includes(kw));
}

export async function scrapeDeskfab(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${store.baseUrl}/products.json?limit=250&page=${page}`;
    console.log(`[DeskFab] Scraping: ${url}`);

    try {
      const data = await fetchJson<ShopifyProductsResponse>(url, { rateDelay: 2000 });

      if (!data?.products?.length) {
        hasMore = false;
        break;
      }

      for (const product of data.products) {
        if (!is3DRelated(product)) continue;

        // Use the cheapest available variant
        const variant = product.variants
          .filter(v => v.available !== false && parseFloat(v.price) > 0)
          .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

        if (!variant) continue;

        const price = Math.round(parseFloat(variant.price));
        if (price === 0) continue;

        const imgSrc = product.images[0]?.src ?? '';
        const stock: 'available' | 'low' | 'out' =
          variant.inventory_quantity > 5 ? 'available' :
          variant.inventory_quantity > 0 ? 'low' : 'out';

        results.push({
          storeId:     store.id,
          storeName:   store.name,
          productName: product.title,
          productUrl:  `${store.baseUrl}/products/${product.handle}`,
          price,
          currency:    'CLP',
          stock,
          imageUrl:     imgSrc.startsWith('//') ? `https:${imgSrc}` : imgSrc,
          brand:        product.vendor || undefined,
          categorySlug: inferCategory(product.title, product.product_type),
          scrapedAt:    new Date(),
        });
      }

      // Shopify returns fewer than `limit` on the last page
      hasMore = data.products.length === 250;
      page++;
    } catch (err) {
      console.error(`[DeskFab] Error en ${url}:`, err);
      hasMore = false;
    }
  }

  console.log(`[DeskFab] Total productos: ${results.length}`);
  return results;
}
