import { ScraperResult, StoreConfig } from '../models';
import { fetchJson, inferCategory, parsePriceCLP } from '../utils';

// ──────────────────────────────────────────────────────────────
// Bambu Lab Chile — API REST pública
// URL: https://bambulab.com/es-cl
//
// Bambu Lab expone un API de productos por región/idioma.
// Los endpoints fueron identificados desde el tráfico de red del sitio.
// Si falla con 403/404, verificar los endpoints en DevTools → Network.
// ──────────────────────────────────────────────────────────────

const REGION   = 'CL';
const CURRENCY = 'CLP';

// Categorías de productos de interés
const CATEGORY_SLUGS = [
  'printer',
  'filament',
  'accessory',
];

// Cabeceras necesarias para pasar la protección de Cloudflare/CDN
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
  'Referer':         'https://bambulab.com/es-cl',
  'Origin':          'https://bambulab.com',
};

interface BambuProduct {
  id:          string;
  title:       string;
  handle?:     string;
  url?:        string;
  price?:      number | string;
  minPrice?:   number;
  maxPrice?:   number;
  images?:     Array<{ src?: string; url?: string }>;
  mainImage?:  string;
  inStock?:    boolean;
  available?:  boolean;
  category?:   string;
}

interface BambuApiResponse {
  data?:     BambuProduct[];
  products?: BambuProduct[];
  items?:    BambuProduct[];
}

function extractPrice(p: BambuProduct): number {
  const raw = p.price ?? p.minPrice ?? 0;
  if (typeof raw === 'number') return raw;
  return parsePriceCLP(String(raw));
}

function extractImageUrl(p: BambuProduct): string {
  if (p.mainImage)          return p.mainImage;
  if (p.images?.[0]?.src)  return p.images[0].src!;
  if (p.images?.[0]?.url)  return p.images[0].url!;
  return '';
}

export async function scrapeBambulab(store: StoreConfig): Promise<ScraperResult[]> {
  const results:  ScraperResult[] = [];
  const seen      = new Set<string>();

  for (const cat of CATEGORY_SLUGS) {
    const apiUrl = `${store.baseUrl}/api/v1/products?category=${cat}&region=${REGION}&currency=${CURRENCY}&lang=es`;
    console.log(`[BambuLab] Scraping: ${apiUrl}`);

    try {
      const data = await fetchJson<BambuApiResponse>(apiUrl, {
        rateDelay:    3000,
        extraHeaders: HEADERS,
      });

      const products: BambuProduct[] = data?.data ?? data?.products ?? data?.items ?? [];

      for (const p of products) {
        if (!p.title) continue;
        const handle   = p.handle ?? p.id ?? '';
        const url      = p.url ?? `${store.baseUrl}/es-cl/product/${handle}`;
        if (seen.has(url)) continue;
        seen.add(url);

        const price = extractPrice(p);
        if (price === 0) continue;

        const stock   = (p.inStock ?? p.available ?? true) ? 'available' as const : 'out' as const;
        const imgUrl  = extractImageUrl(p);
        const catSlug = inferCategory(p.title, cat);

        results.push({
          storeId:     store.id,
          storeName:   store.name,
          productName: p.title,
          productUrl:  url.startsWith('http') ? url : `https://bambulab.com${url}`,
          price,
          currency:    'CLP',
          stock,
          imageUrl:    imgUrl || undefined,
          categorySlug: catSlug,
          scrapedAt:   new Date(),
        });
      }
    } catch (err) {
      console.warn(`[BambuLab] Error en categoría "${cat}" (API puede requerir ajuste):`, (err as Error).message);
      // No relanzar — si una categoría falla, continuar con las demás
    }
  }

  console.log(`[BambuLab] Total productos: ${results.length}`);
  return results;
}
