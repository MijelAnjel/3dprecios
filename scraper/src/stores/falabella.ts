import { ScraperResult, StoreConfig } from '../models';
import { fetchJson, delay, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Falabella Chile — API Browse v1
// Plataforma: Falabella SPA (React) + Browse API REST
// ──────────────────────────────────────────────────────────────

// Santiago delivery zone
const ZONE = '15200';
const PAGE_SIZE = 36;

// Falabella API headers required to avoid 400/403
const API_HEADERS = {
  'x-channel-id': 'WEB',
  'x-client-name': 'browser-client',
  Origin:          'https://www.falabella.com',
  Referer:         'https://www.falabella.com/falabella-cl/',
};

// Search terms that cover 3D printing products
const SEARCH_TERMS = [
  'impresora 3d',
  'filamento 3d',
  'resina 3d',
  'bambu lab',
];

interface FalabellaPrice {
  price: number;
  originalPrice?: number;
  type?: string;
}

interface FalabellaProduct {
  displayName: string;
  url?: string;
  prices?: FalabellaPrice[];
  mediaUrls?: string[];
  skuId?: string;
  brand?: string;
  stockStatus?: string;
  sellerName?: string;
}

interface FalabellaResponse {
  data?: {
    results?: FalabellaProduct[];
    pagination?: {
      currentPage: number;
      totalPages: number;
    };
  };
}

function extractPrice(prices?: FalabellaPrice[]): number {
  if (!prices?.length) return 0;
  // Prefer sale price (lowest)
  const sorted = [...prices].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  return sorted[0]?.price ?? 0;
}

export async function scrapeFalabella(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const params = new URLSearchParams({
        zone:        ZONE,
        currentPage: String(page),
        sortBy:      '100',
        pageSize:    String(PAGE_SIZE),
        Ntt:         term,
      });
      const url = `${store.baseUrl}/s/browse/v1/listing/cl?${params}`;
      console.log(`[Falabella] Scraping: ${url}`);

      try {
        const data = await fetchJson<FalabellaResponse>(url, {
          rateDelay:    2000,
          extraHeaders: API_HEADERS,
        });

        const apiResults = data?.data?.results ?? [];
        totalPages = data?.data?.pagination?.totalPages ?? 1;

        for (const product of apiResults) {
          const productUrl = product.url
            ? (product.url.startsWith('http') ? product.url : `${store.baseUrl}${product.url}`)
            : '';

          if (!product.displayName || !productUrl || seen.has(productUrl)) continue;
          seen.add(productUrl);

          const price = extractPrice(product.prices);
          if (price === 0) continue;

          const stockTxt = product.stockStatus ?? 'available';
          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: product.displayName,
            productUrl,
            price,
            currency:    'CLP',
            stock:       inferStock(stockTxt),
            imageUrl:    product.mediaUrls?.[0] ?? '',
            brand:       product.brand ?? undefined,
            sku:         product.skuId ?? undefined,
            scrapedAt:   new Date(),
          });
        }

        page++;
        await delay(1500);
      } catch (err) {
        console.error(`[Falabella] Error en "${term}" p.${page}:`, err);
        break;
      }
    }
  }

  console.log(`[Falabella] Total productos: ${results.length}`);
  return results;
}
