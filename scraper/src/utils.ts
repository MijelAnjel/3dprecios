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
  let n = name;

  // 1. Eliminar texto duplicado (WooCommerce repite el nombre completo en algunos temas)
  const half = Math.ceil(n.length / 2);
  if (n.length > 20 && n.slice(0, half).trim() === n.slice(half).trim()) {
    n = n.slice(0, half).trim();
  }

  // 2. Quitar paréntesis de color/variante al final: "(Negro)", "(2 Pack)", etc.
  n = n.replace(/\s*\([^)]{0,40}\)\s*$/, '');

  // 3. Quitar sufijo de tienda: "Producto | TODOTONER.CL | Filamentos"
  n = n.replace(/\s*\|\s*[A-ZÁÉÍÓÚ\w.-]+\.(cl|com|net)\b.*/i, '');

  // 4. Quitar sufijos de marketing: "- Importado", "| Oferta"
  n = n.replace(/\s*[-–|]\s*(importado|import|oferta|sale|nuevo|new|stock|disponible|sección)\b.*/gi, '');

  // 5. Normalizar pesos/medidas: "1 Kg" → "1kg"
  n = n.replace(/(\d)\s*kg\b/gi, '$1kg');
  n = n.replace(/(\d)\s*g\b(?!r)/gi, '$1g');
  n = n.replace(/(\d)\s*ml\b/gi, '$1ml');
  n = n.replace(/(\d)\s*mm\b/gi, '$1mm');

  // 6. Normalizar nombres de marca para consistencia entre tiendas
  n = n.replace(/bambu\.?lab\b/gi, 'Bambu Lab');
  n = n.replace(/\be-?sun\b/gi, 'eSUN');

  // 7. Compactar espacios
  n = n.replace(/\s+/g, ' ').trim();

  return n;
}

// ── Infer categorySlug from product name + URL/category path ─────────────
//
// ORDEN CRÍTICO:
//   0. Repuestos/piezas claramente identificables → PRIMERO (antes de filamentos e impresoras)
//   1. Filamentos (material de impresión)
//   2. Resinas líquidas (para SLA/MSLA)
//   3. Impresoras de resina (+ estaciones wash & cure)
//   4. Impresoras FDM
//   5. Repuestos generales (por path)
//   6. general (fallback)
//
// El error histórico: "Sensor de final de Filamento Artillery" caía en filamentos-pla
// porque "filamento" aparece en el nombre. Con la detección REPUESTO-PRIMERO esto se corrige.
export function inferCategory(name: string, path: string): string {
  const n = name.toLowerCase();
  const p = path.toLowerCase();

  // ── 0. Repuestos con keywords inequívocos — siempre ganan ─────────────
  // Piezas/accesorios que usan keywords de filamento/impresora en su nombre
  // pero NO son el producto principal. Detectar antes que cualquier otra categoría.
  const isRepuesto =
    // Sensores y finales de carrera
    /\bsensor\b|endstop|final\s*de\s*carrera|\bprobe\b|bltouch|cr[\s-]?touch|inductive\s*probe/i.test(n) ||
    // Herramientas de filamento (cortadores, palancas, etc.)
    /cortador.*filament|palanca.*cort|cutter.*filament|cizalla|palanca\s+corta/i.test(n) ||
    // Térmicos y hotend
    /\bcalefactor\b|\bheater[\s-]?block\b|\btermistor\b|thermistor|thermocouple|termopar|heatbreak|heat\s*break/i.test(n) ||
    // Boquillas y extrusores
    /\bnozzle\b|\bboquilla\b|\bextrusor\b|\bextruder\b|\bbowden\b|\bptfe\b(?!\s*filament)|\bhotend\b/i.test(n) ||
    // Motion: correas, poleas, rodamientos, raíles
    /\bcorrea\b|\bpulley\b|\brodamiento\b|\bbearing\b|rail\s*lineal|lead[\s-]?screw|trapezoidal|varilla\s*roscada/i.test(n) ||
    // Ventiladores específicos (4010, 5015, hotend, capa) — no ventilador genérico
    /ventilador\s*de\s*capa|layer\s*fan|hotend\s*fan|ventilador.*\b\d{4}\b|\b\d{4}\b.*ventilador/i.test(n) ||
    // Cama y superficie de impresión
    /cama\s*caliente|heated\s*bed|vidrio\s*templado|placa\s*de\s*construcci|spring\s*steel|\bpei\b|build\s*plate/i.test(n) ||
    // Protectores de pantalla FEP para resina
    /protector\s*de\s*pantalla|\bfep\b|\bnfep\b|release\s*film|pantalla\s*fep/i.test(n) ||
    // Piezas estructurales / paneles de impresoras por marca
    /panel\s*(hr|hl|lateral|frontal|trasero|derecho|izquierdo)|panel.*bambu|bambu.*panel/i.test(n) ||
    /estructura\s*bambu|bambu.*enclosure|enclosure.*bambu|bambu.*estructura/i.test(n) ||
    // Electrónica de impresoras
    /\bmainboard\b|placa\s*madre.*impr|placa\s*base.*impr|raspberry.*impr/i.test(n) ||
    // Controladores de impresoras (BTT, MKS, etc.)
    /\bbigtreetech\b|\bbtt\b|\bmks\s*(gen|sbase|robin)|skr\s*(mini|pro|v\d)|octopus\s*pro|spider\s*v\d/i.test(n) ||
    // Kits de repuesto explícitos
    /kit\s*correa|kit\s*nozzle|kit\s*hotend|upgrade\s*kit\s*(ender|bambu|prusa)/i.test(n);

  if (isRepuesto) return 'repuestos';

  // ── 1. Filamentos ──────────────────────────────────────────────────────
  const filamentByPath = /filament/i.test(p);
  // Un producto es filamento si su nombre contiene keywords de material
  // SIN mencionar "impresora/printer" (evita "Filamento compatible con impresora X")
  const filamentByName = /\bpla\b|polil[aá]ctico|\bpetg\b|\babs\b|\basa\b|\btpu\b|\btpe\b|\bfilamento\b|\bfilament\b/i.test(n);
  const isPrinterWord  = /\bimpresora\b|\bprinter\b/i.test(n);

  if (filamentByPath || (filamentByName && !isPrinterWord)) {
    if (/\bpetg\b/i.test(n) || /petg/i.test(p))                   return 'filamentos-petg';
    if (/\babs\b|\basa\b/i.test(n) || /\babs\b|\basa\b/i.test(p)) return 'filamentos-abs';
    if (/\btpu\b|\btpe\b/i.test(n) || /tpu|tpe/i.test(p))         return 'filamentos-tpu';
    if (/\bnylon\b|\bpa12\b|\bpa6\b|\bpa\b(?=[\s-]?\d)|policarbonato|\bpc\b|-cf\b|fibra[\s-]*(carbono|vidrio)/i.test(n))
      return 'filamentos-especiales';
    return 'filamentos-pla';
  }

  // ── 2. Resinas líquidas (SLA/MSLA) ────────────────────────────────────
  // isLiquidResin: tiene "resina" en nombre Y (hay cantidad en g/ml o empieza con "Resina")
  const hasResinaWord   = /\bresina\b|\bresin\b/i.test(n);
  const hasLiquidMarker = /\d+\s*(g|ml|kg|litro)\b/i.test(n) || /^resina\b/i.test(n);

  if (/resina|resin/i.test(p) && !/impresora.*resina|impresoras-resina/i.test(p)) return 'resinas';
  if (hasResinaWord && hasLiquidMarker && !isPrinterWord) return 'resinas';

  // ── 3. Impresoras de resina y estaciones wash & cure ──────────────────
  if (/impresora.*resina|resina.*impresora|impresoras-resina/i.test(p)) return 'impresoras-resina';
  // Estaciones de lavado y curado → accesorios esenciales de impresión resina
  if (/wash.*cure|cure.*wash|curado.*lavado|lavado.*curado|lavadora\s*ultras|washing\s*station|curing\s*station|m[aá]quina.*curado/i.test(n)) return 'impresoras-resina';
  // Modelos conocidos de impresoras resina
  if (/\bsaturn\b|\bmars\s*\d|\bphoton\b|\bhalot\b|mono\s*x|\bphrozen\b|anycubic\s*m\d|elegoo\s*saturn|sonic\s*mini/i.test(n)) return 'impresoras-resina';
  if (isPrinterWord && /\bresina\b|\bresin\b|\bsla\b|\bmsla\b|\bdlp\b/i.test(n)) return 'impresoras-resina';

  // ── 4. Impresoras FDM ─────────────────────────────────────────────────
  // NO usar "fdm" sólo: "Filamento FDM" es filamento, no impresora
  if (/impresora|printer|impresion-3d|impresoras-3d|impresoras-fdm/i.test(p) && !/resina|resin/i.test(p)) return 'impresoras-fdm';
  if (/\bender\b|\bneptune\b|\bkobra\b|\baquila\b|\bvoxelab\b|adventurer|flashforge|\bprusa\b|\bvoron\b|bambu\s*(a1|p1|x1|a1\s*mini|p1s|p1p|x1c)|elegoo\s*(neptune|centauri)|\bqidi\b/i.test(n)) return 'impresoras-fdm';
  // Modelos Creality FDM adicionales (K-series, CR-series, etc.)
  if (/\bcreality\b.*\b(k1|k2|cr[\s-]?\d+|sonic\s*pad|nebula)/i.test(n)) return 'impresoras-fdm';
  // Bambu Lab con nombre de modelo sin "bambu" inmediatamente antes (e.g. "Bambu Lab A1C")
  if (/\bbambu\b|\bbambu\s+lab\b/i.test(n) && !filamentByName) return 'impresoras-fdm';
  if (isPrinterWord && !/resina|resin|sla|msla|dlp/i.test(n)) return 'impresoras-fdm';

  // ── 5. Repuestos generales (por path) ─────────────────────────────────
  if (/repuesto|accesorio|spare|upgrade|hotend|nozzle|extrusor|accesorios/i.test(p)) return 'repuestos';
  if (/\bnozzle\b|\bhotend\b|\bextrusor\b|\bbowden\b|\bptfe\b|motor\s*nema|\brodamiento\b|cama\s*caliente|rail/i.test(n)) return 'repuestos';

  return 'general';
}

// ── Extrae specs estructurados desde el nombre del producto ───────────────
// Permite que los filtros del catálogo funcionen con datos reales de Firestore.
export function extractSpecs(name: string, categorySlug: string): Record<string, string> {
  const specs: Record<string, string> = {};

  // ── Marcas por categoría ───────────────────────────────────────────────
  const FILAMENT_BRANDS: [RegExp, string][] = [
    [/bambu\.?lab\b/i, 'Bambu Lab'],
    [/\bcreality\b/i, 'Creality'],
    [/\bpolymaker\b/i, 'Polymaker'],
    [/\bprusament\b|\bprusa\b.*filament/i, 'Prusament'],
    [/\besun\b|\be-sun\b/i, 'eSUN'],
    [/\bsunlu\b/i, 'Sunlu'],
    [/\bfiberlogy\b/i, 'Fiberlogy'],
    [/\bhatchbox\b/i, 'Hatchbox'],
    [/\bzaxe\b/i, 'Zaxe'],
    [/\beleego\b|\belegoo\b/i, 'Elegoo'],
    [/\bantinsky\b/i, 'Antinsky'],
    [/\b3dl[aá]c\b|3d\s*lac/i, '3DLac'],
    [/\boverture\b/i, 'Overture'],
    [/\braiser3d\b|\braise3d\b/i, 'Raise3D'],
    [/\bprimavalue\b|\bprima\s*value\b/i, 'PrimaValue'],
    [/\bformfutura\b|\bforma\s*futura\b/i, 'FormFutura'],
  ];

  const PRINTER_BRANDS: [RegExp, string][] = [
    [/bambu\.?lab\b/i, 'Bambu Lab'],
    [/\bcreality\b/i, 'Creality'],
    [/\bprusa\b/i, 'Prusa'],
    [/\belegoo\b/i, 'Elegoo'],
    [/\banycubic\b/i, 'Anycubic'],
    [/\bphrozen\b/i, 'Phrozen'],
    [/\bflashforge\b/i, 'Flashforge'],
    [/\bqidi\b/i, 'Qidi'],
    [/\bvoxelab\b/i, 'Voxelab'],
    [/\bartillery\b/i, 'Artillery'],
    [/\braise3d\b/i, 'Raise3D'],
    [/\bgraphy\b/i, 'Graphy'],
  ];

  const RESIN_BRANDS: [RegExp, string][] = [
    [/\belegoo\b/i, 'Elegoo'],
    [/\banycubic\b/i, 'Anycubic'],
    [/\bphrozen\b/i, 'Phrozen'],
    [/\bcreality\b/i, 'Creality'],
    [/\besun\b|\be-sun\b/i, 'eSUN'],
    [/\bantinsky\b/i, 'Antinsky'],
    [/\bsiraya\b/i, 'Siraya Tech'],
    [/\bgraphy\b/i, 'Graphy'],
    [/\bwashable\b/i, 'Generic'],
  ];

  // ── Filamentos ────────────────────────────────────────────────────────
  if (categorySlug.startsWith('filamento')) {
    // Marca
    for (const [re, brand] of FILAMENT_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }

    // Material específico
    if (/\bpetg\b/i.test(name))                          specs['material'] = 'PETG';
    else if (/\babs\b/i.test(name))                      specs['material'] = 'ABS';
    else if (/\basa\b/i.test(name))                      specs['material'] = 'ASA';
    else if (/\btpu\b/i.test(name))                      specs['material'] = 'TPU';
    else if (/\btpe\b/i.test(name))                      specs['material'] = 'TPE';
    else if (/\bnylon\b|\bpa\d/i.test(name))             specs['material'] = 'Nylon';
    else if (/policarbonato|\bpc\b/i.test(name))         specs['material'] = 'PC';
    else if (/\bpla\b/i.test(name)) {
      if (/-cf\b|carbono/i.test(name))                   specs['material'] = 'PLA-CF';
      else if (/\bsilk\b|\bseda\b/i.test(name))         specs['material'] = 'PLA Silk';
      else if (/\bmatte\b|\bmate\b/i.test(name))        specs['material'] = 'PLA Matte';
      else if (/high.?speed|\bhs\b/i.test(name))        specs['material'] = 'PLA HF';
      else if (/\bplus\b|\+/i.test(name))               specs['material'] = 'PLA+';
      else                                                specs['material'] = 'PLA';
    }

    // Diámetro
    const dMatch = name.match(/(\d[.,]\d+)\s*mm/i);
    if (dMatch) {
      const d = parseFloat(dMatch[1].replace(',', '.'));
      if (d >= 1.5 && d <= 2.0)  specs['diameter'] = '1.75';
      if (d >= 2.5 && d <= 3.0)  specs['diameter'] = '2.85';
    } else {
      // Inferir por defecto: 99% del mercado es 1.75mm
      specs['diameter'] = '1.75';
    }

    // Peso → normalizar a gramos
    const wMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
    if (wMatch) {
      const val  = parseFloat(wMatch[1].replace(',', '.'));
      const unit = wMatch[2].toLowerCase();
      const grams = unit === 'kg' ? Math.round(val * 1000) : Math.round(val);
      // Snap a pesos estándar: 250, 500, 750, 1000, 1250, 2000, 3000, 5000
      const standards = [125, 250, 500, 750, 1000, 1250, 1500, 2000, 3000, 5000];
      const closest = standards.reduce((a, b) => Math.abs(b - grams) < Math.abs(a - grams) ? b : a);
      specs['weight'] = String(Math.abs(closest - grams) < 200 ? closest : grams);
    }

    // Color (detectar colores comunes)
    const COLOR_MAP: [RegExp, string][] = [
      [/\bblanco\b|\bwhite\b|\bnatural\b|\bcrema\b/i, 'Blanco'],
      [/\bnegro\b|\bblack\b/i, 'Negro'],
      [/\brojo\b|\bred\b/i, 'Rojo'],
      [/\bazul\b|\bblue\b/i, 'Azul'],
      [/azul\s*oscuro|dark\s*blue|navy/i, 'Azul Oscuro'],
      [/\bverde\b|\bgreen\b/i, 'Verde'],
      [/\bamarillo\b|\byellow\b/i, 'Amarillo'],
      [/\bnaranja\b|\borange\b/i, 'Naranja'],
      [/\bgris\b|\bgray\b|\bgrey\b/i, 'Gris'],
      [/\bmorado\b|\bvioleta\b|\bpurple\b/i, 'Morado'],
      [/\btransparente\b|\btransparent\b|\bclear\b/i, 'Transparente'],
      [/\bceleste\b|\bsky[\s-]?blue\b/i, 'Celeste'],
      [/\brosa\b|\bpink\b/i, 'Rosa'],
      [/\bcaf[eé]\b|\bbrown\b/i, 'Café'],
      [/\bmarfil\b|\bivory\b/i, 'Marfil'],
      [/\bdorado\b|\bgold\b/i, 'Dorado'],
      [/\bplateado\b|\bsilver\b/i, 'Plateado'],
    ];
    for (const [re, color] of COLOR_MAP) {
      if (re.test(name)) { specs['color'] = color; break; }
    }
  }

  // ── Impresoras FDM / Resina ────────────────────────────────────────────
  if (categorySlug === 'impresoras-fdm' || categorySlug === 'impresoras-resina') {
    for (const [re, brand] of PRINTER_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }
  }

  // ── Resinas líquidas ──────────────────────────────────────────────────
  if (categorySlug === 'resinas') {
    for (const [re, brand] of RESIN_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }
    // Volumen → normalizar a ml
    const vMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(ml|g(?!r)|kg|litro)/i);
    if (vMatch) {
      const val  = parseFloat(vMatch[1].replace(',', '.'));
      const unit = vMatch[2].toLowerCase();
      let ml: number;
      if (/litro/i.test(unit))  ml = Math.round(val * 1000);
      else if (unit === 'kg')   ml = Math.round(val * 1000);
      else                       ml = Math.round(val); // g ≈ ml para resinas
      specs['volume'] = String(ml);
    }
    // Tipo de resina
    if (/water[\s-]?washable|lavable\s*al\s*agua/i.test(name)) specs['type'] = 'Water Washable';
    else if (/abs[\s-]?like|abs\s*type/i.test(name))            specs['type'] = 'ABS-Like';
    else if (/\b8k\b|\b12k\b|\b16k\b/i.test(name))             specs['type'] = 'Alta Resolución';
    else if (/dental|castable|joyería|jewelry/i.test(name))     specs['type'] = 'Especializada';
    else                                                          specs['type'] = 'Estándar';
  }

  // ── Repuestos ─────────────────────────────────────────────────────────
  if (categorySlug === 'repuestos') {
    for (const [re, brand] of PRINTER_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }
  }

  return specs;
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
  // WC Store API v1 returns images as objects, not plain strings
  images: Array<{ id: number; src: string; thumbnail: string; name: string; alt: string }>;
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

