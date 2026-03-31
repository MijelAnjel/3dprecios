import * as cheerio from 'cheerio';

// Cheerio v1 exports CheerioAPI as the return of load()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioAPI = any;

// ── User-Agent rotation ────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Delay helper ───────────────────────────────────────────────────────────
export function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

// ── Fetch with retry + rate limiting ──────────────────────────────────────
export async function fetchHtml(
  url: string,
  {
    retries = 3,
    delayBetweenRetries = 3000,
    rateDelay = 2000,
  }: { retries?: number; delayBetweenRetries?: number; rateDelay?: number } = {},
): Promise<CheerioAPI> {
  await delay(rateDelay);

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': randomUA(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
      }

      const html = await response.text();
      return cheerio.load(html);
    } catch (err) {
      lastError = err;
      console.warn(`[fetch] Intento ${attempt}/${retries} falló para ${url}:`, err);
      if (attempt < retries) await delay(delayBetweenRetries * attempt);
    }
  }

  throw lastError;
}

// ── Fetch JSON API with retry + rate limiting ──────────────────────────────
export async function fetchJson<T = unknown>(
  url: string,
  {
    retries = 3,
    delayBetweenRetries = 3000,
    rateDelay = 1500,
    extraHeaders = {} as Record<string, string>,
  }: { retries?: number; delayBetweenRetries?: number; rateDelay?: number; extraHeaders?: Record<string, string> } = {},
): Promise<T> {
  await delay(rateDelay);

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': randomUA(),
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
          ...extraHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
      }

      return await response.json() as T;
    } catch (err) {
      lastError = err;
      console.warn(`[fetchJson] Intento ${attempt}/${retries} falló para ${url}:`, err);
      if (attempt < retries) await delay(delayBetweenRetries * attempt);
    }
  }

  throw lastError;
}

// ── Parse CLP price string → number ───────────────────────────────────────
export function parsePriceCLP(raw: string): number {
  // Handles: "$12.990", "$ 12.990", "12990", "CLP 12.990", "12,990"
  const cleaned = raw
    .replace(/[^\d.,]/g, '')   // strip non-numeric/punctuation
    .replace(/\./g, '')         // remove thousand separators (CLP uses dots)
    .replace(',', '.');         // replace comma decimal (just in case)
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

// ── Slugify product name ───────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Infer stock from text hints ────────────────────────────────────────────
export function inferStock(text: string): 'available' | 'low' | 'out' | 'unknown' {
  const t = text.toLowerCase();
  if (/sin stock|agotado|no disponible|out of stock/.test(t)) return 'out';
  if (/últimas? unidades?|pocas unidades?|quedan \d/.test(t))  return 'low';
  if (/disponible|en stock|add to cart|agregar/.test(t))       return 'available';
  return 'unknown';
}

// ── Normaliza el nombre del producto para mejorar matching entre tiendas ──
// Elimina ruido que varía entre tiendas pero no identifica el producto.
export function normalizeProductName(name: string): string {
  return name
    // Quitar paréntesis de color/variante al final: "(Negro)", "(2 Pack)", etc.
    .replace(/\s*\([^)]{0,30}\)\s*$/, '')
    // Normalizar pesos: "1 Kg" "1KG" "1000 G" → tokens consistentes
    .replace(/(\d)\s*kg\b/gi, '$1kg')
    .replace(/(\d)\s*g\b(?!r)/gi, '$1g')
    .replace(/(\d)\s*ml\b/gi, '$1ml')
    // Quitar sufijos de marketing comunes
    .replace(/\s*[-–|]\s*(importado|import|oferta|sale|nuevo|new|stock|disponible)[\w\s]*/gi, '')
    // Compactar espacios
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Infer categorySlug from product name + URL/category path ─────────────
//
// ORDEN CRÍTICO: filamentos PRIMERO que impresoras.
// "Filamento FDM PLA 1.75mm" antes tenía bug: fdm → impresoras-fdm.
export function inferCategory(name: string, path: string): string {
  const n = name.toLowerCase();
  const p = path.toLowerCase();

  // ── 1. Detectar filamentos primero (por path Y por nombre) ────────────
  // Un producto es filamento si su path/categoría menciona "filament" O si
  // el nombre contiene keywords de material, SIN mención de "impresora/printer".
  const filamentByPath = /filament/i.test(p);
  const filamentByName = /\bpla\b|polil[aá]ctico|\bpetg\b|\babs\b(?!\s*pl)|\basa\b|\btpu\b|\btpe\b|flexible.*filament|filamento|filament|nylon.*filament/i.test(n);
  const isPrinterName  = /impresora|printer/i.test(n);

  if (filamentByPath || (filamentByName && !isPrinterName)) {
    if (/\bpetg\b/i.test(n) || /petg/i.test(p))            return 'filamentos-petg';
    if (/\babs\b|\basa\b/i.test(n) || /\babs\b|\basa\b/i.test(p)) return 'filamentos-abs';
    if (/\btpu\b|\btpe\b/i.test(n) || /tpu|tpe/i.test(p))  return 'filamentos-tpu';
    if (/nylon|\bpa12\b|\bpa6\b|policarbonato|-cf\b|fibra.*(carbono|vidrio)/i.test(n)) return 'filamentos-especiales';
    return 'filamentos-pla';
  }

  // ── 2. Resinas (líquidas para impresoras SLA/MSLA) ─────────────────────
  if (/resina|resin/i.test(p) && !/impresora|printer/i.test(p)) return 'resinas';
  if (/\bresina\b|\bresin\b/i.test(n) && !isPrinterName)         return 'resinas';

  // ── 3. Impresoras resina ──────────────────────────────────────────────
  if (/impresora.*resina|resina.*impresora|impresoras-resina|resin.*printer/i.test(p)) return 'impresoras-resina';
  if (/saturn|mars|photon|halot|mono\s*x|sonic.*mini|phrozen|anycubic.*m[0-9]|elegoo.*saturn/i.test(n)) return 'impresoras-resina';
  if (isPrinterName && /resina|resin|sla|msla|dlp/i.test(n)) return 'impresoras-resina';

  // ── 4. Impresoras FDM ─────────────────────────────────────────────────
  // OJO: NO incluir "fdm" solo — "Filamento FDM" es un filamento
  if (/impresora|printer|impresion-3d|impresoras-3d|impresoras-fdm/i.test(p) && !/resina|resin/i.test(p)) return 'impresoras-fdm';
  if (/ender|neptune|kobra|aquila|voxelab|adventurer|flashforge|prusa|voron|bambu.*(a1|p1|x1)|elegoo.*(neptune|centauri)/i.test(n)) return 'impresoras-fdm';
  if (isPrinterName && !/resina|resin|sla|msla|dlp/i.test(n)) return 'impresoras-fdm';

  // ── 5. Repuestos & accesorios ─────────────────────────────────────────
  if (/repuesto|accesorio|spare|upgrade|hotend|nozzle|extrusor|accesorios/i.test(p)) return 'repuestos';
  if (/nozzle|hotend|extrusor|bowden|ptfe|ventilador|motor.?nema|rodamiento|cama caliente|placa.*calor|rail|correa de impresion/i.test(n)) return 'repuestos';

  return 'general';
}

// ── WooCommerce Store API helper ───────────────────────────────────────────
export interface WcStoreProduct {
  name: string;
  permalink: string;
  prices: {
    price: string;
    regular_price: string;
    currency_code: string;
  };
  images: string[];
  is_in_stock: boolean;
  on_sale: boolean;
  categories: Array<{ id: number; name: string; slug: string }>;
}

/**
 * Fetches all products from a WooCommerce Store API.
 * Handles pagination automatically. Deduplicates by permalink.
 * Use categoryIds=[] to fetch all products.
 */
export async function fetchWcStoreProducts(
  storeUrl: string,
  categoryIds: number[] = [],
  { rateDelay = 1500 }: { rateDelay?: number } = {},
): Promise<WcStoreProduct[]> {
  const results: WcStoreProduct[] = [];
  const seen = new Set<string>();

  const targets = categoryIds.length > 0 ? categoryIds : [0]; // 0 = no filter

  for (const catId of targets) {
    let page = 1;

    while (true) {
      const params = new URLSearchParams({ per_page: '100', page: String(page) });
      if (catId > 0) params.append('category_ids[]', String(catId));

      const url = `${storeUrl}/wp-json/wc/store/v1/products?${params}`;
      console.log(`[WcStore] ${url}`);

      try {
        const data = await fetchJson<WcStoreProduct[]>(url, {
          rateDelay,
          retries: 3,
        });

        if (!Array.isArray(data) || data.length === 0) break;

        for (const p of data) {
          if (p.permalink && !seen.has(p.permalink)) {
            seen.add(p.permalink);
            results.push(p);
          }
        }

        if (data.length < 100) break;
        page++;
      } catch (err) {
        console.error(`[WcStore] Error en ${url}:`, err);
        break;
      }
    }
  }

  return results;
}

