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
