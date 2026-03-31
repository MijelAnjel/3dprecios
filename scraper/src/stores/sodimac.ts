import { ScraperResult, StoreConfig } from '../models';
import { fetchJson, delay, inferStock } from '../utils';

// ──────────────────────────────────────────────────────────────
// Sodimac Chile — API Browse v1
// Misma plataforma API que Falabella (Falabella Group)
// ──────────────────────────────────────────────────────────────

// Santiago / RM delivery zone for Sodimac
const ZONE = '13105';
const PAGE_SIZE = 36;

const API_HEADERS = {
  'x-channel-id': 'WEB',
  'x-client-name': 'browser-client',
  Origin:          'https://www.sodimac.cl',
  Referer:         'https://www.sodimac.cl/sodimac-cl/',
};

const SEARCH_TERMS = [
  'impresora 3d',
  'filamento 3d',
  'resina 3d',
];

interface SodimacPrice {
  price: number;
  originalPrice?: number;
}

interface SodimacProduct {
  displayName: string;
  url?: string;
  prices?: SodimacPrice[];
  mediaUrls?: string[];
  skuId?: string;
  brand?: string;
  stockStatus?: string;
}

interface SodimacResponse {
  data?: {
    results?: SodimacProduct[];
    pagination?: {
      currentPage: number;
      totalPages: number;
    };
  };
}

export async function scrapeSodimac(store: StoreConfig): Promise<ScraperResult[]> {
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
      console.log(`[Sodimac] Scraping: ${url}`);

      try {
        const data = await fetchJson<SodimacResponse>(url, {
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

          const price = product.prices?.[0]?.price ?? 0;
          if (price === 0) continue;

          results.push({
            storeId:     store.id,
            storeName:   store.name,
            productName: product.displayName,
            productUrl,
            price,
            currency:    'CLP',
            stock:       inferStock(product.stockStatus ?? 'available'),
            imageUrl:    product.mediaUrls?.[0] ?? '',
            brand:       product.brand ?? undefined,
            sku:         product.skuId ?? undefined,
            scrapedAt:   new Date(),
          });
        }

        page++;
        await delay(1500);
      } catch (err) {
        console.error(`[Sodimac] Error en "${term}" p.${page}:`, err);
        break;
      }
    }
  }

  console.log(`[Sodimac] Total productos: ${results.length}`);
  return results;
}
