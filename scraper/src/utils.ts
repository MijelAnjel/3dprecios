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
      // Cloudflare / bot-protection challenge page detection
      if (html.includes('One moment, please') || html.includes('Checking your browser') || html.includes('cf-browser-verification')) {
        throw new Error(`CF-BLOCKED — ${url}`);
      }
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

      const text = await response.text();
      // Cloudflare / bot-protection challenge page detection
      if (text.includes('One moment, please') || text.includes('Checking your browser') || text.includes('cf-browser-verification')) {
        throw new Error(`CF-BLOCKED — ${url}`);
      }
      return JSON.parse(text) as T;
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

  // 5. Quitar frases de descripción verbosas (cimech3d, otros WooCommerce)
  //    "para impresión 3D marca X" → eliminar la frase descriptiva pero mantener la marca
  n = n.replace(/\s+para\s+(impresi[oó]n|impresoras?)\s+3d\b/gi, '');
  n = n.replace(/\s+marca\s+(?=\S)/gi, ' '); // "marca eSUN" → " eSUN"

  // 6. Normalizar pesos/medidas: "1 Kg" → "1kg"
  n = n.replace(/(\d)\s*kg\b/gi, '$1kg');
  n = n.replace(/(\d)\s*g\b(?!r)/gi, '$1g');
  n = n.replace(/(\d)\s*ml\b/gi, '$1ml');
  n = n.replace(/(\d)\s*mm\b/gi, '$1mm');

  // 7. Normalizar nombres de marca para consistencia entre tiendas
  n = n.replace(/bambu\.?lab\b/gi, 'Bambu Lab');
  n = n.replace(/\be-?sun\b/gi, 'eSUN');

  // 8. Compactar espacios
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
    /\bsensor\b|endstop|final\s*de\s*carrera|l[ií]mite\s*de\s*carrera|\bprobe\b|bltouch|cr[\s-]?touch|inductive\s*probe/i.test(n) ||
    // Módulo de detección de filamento
    /modulo\s*(de\s*)?detecci[oó]n\s*(de\s*)?filament|filament\s*detector|run[\s-]?out\s*sensor/i.test(n) ||
    // Herramientas de filamento (cortadores, palancas, etc.)
    /cortador.*filament|palanca.*cort|cutter.*filament|cizalla|palanca\s+corta/i.test(n) ||
    // Térmicos y hotend
    /\bcalefactor\b|\bheater[\s-]?block\b|\btermistor\b|thermistor|thermocouple|termopar|heatbreak|heat\s*break/i.test(n) ||
    // Boquillas (singular y plural), gargantas y extrusores
    /\bnozzle\b|\bboquillas?\b|\bextrusor\b|\bextruder\b|\bbowden\b|\bptfe\b(?!\s*filament)|\bhotend\b|\bhot[\s-]?end\b/i.test(n) ||
    /\bgarganta\b|\bthroat\b|tubo\s*(de\s*)?calor/i.test(n) ||
    // Engranajes y piezas de extrusión
    /\bengranaje\b|\bgear\b.*extru|extru.*\bgear\b|\bmk8\b|\bmk\s*8\b|\bdual\s*drive\b|\bbmg\b/i.test(n) ||
    // Cables planos FFC/FPC para ejes de impresoras
    /cable\b.*(plano|ffc|fpc).*(eje|artillery|ender|bambu|creality|prusa)/i.test(n) ||
    /(eje\s*[xyz]|artillery|ender|bambu|creality).*cable\s*(plano|ffc|fpc)/i.test(n) ||
    // Volcano / E3D Volcano (ecosistema de boquilla/hotend de alto caudal) — siempre repuesto
    /\bvolcano\b/i.test(n) ||
    // Block de aluminio de tipo Volcano y similares (repuesto hotend)
    /block\s*aluminio\s*(v6|mk8)|volcano\s*block|bloque\s*aluminio\s*volcano/i.test(n) ||
    // Acoples y conectores de cabeza de impresora
    /acople\s*cabeza|conector\s*acople\s*cabeza|head\s*connector/i.test(n) ||
    // Silicona para bloques / protectores de hotend
    /silicona\s*(para\s*)?(bloque|hotend|calefactor)|silicona\s*protectora.*extru/i.test(n) ||
    // Tuercas anti-backlash (patrón flexible — el modificador 'metálica' puede ir en medio)
    /anti[\s-]?backlash/i.test(n) ||
    /tuerca\s*(para\s*)?(varilla|husillo|tornillo|lead)/i.test(n) ||
    /tuerca\s*para\s*apretar/i.test(n) ||
    // Bloques disipadores y accesorios térmicos (no el hotend completo)
    /bloque\s*disipador|disipador\s*de\s*aluminio|bloque.*disipaci[oó]n|disipaci[oó]n.*bloque|heatsink.*print|coldsend|cold\s*end/i.test(n) ||
    // Power switch, interruptores eléctricos de impresora
    /power\s*switch.*\d+[avAV]|\binterruptor\b.*\d+[aA]|\bswitching\s*\d+[aA]/i.test(n) ||
    // Tanque/cuba/vat de resina (repuesto de impresoras de resina)
    /\btanque\s*(de\s*)?resina\b|\bresin\s+vat\b|\bvat\b.*resina/i.test(n) ||
    // Perfil de extensión, piezas estructurales de aluminio extruido
    /perfil\s*(de\s*)?exten.*eje|perfil.*eje\s*[xyz]/i.test(n) ||
    // Kits de reparación / kits de mantenimiento para modelos concretos
    /kit\s*(de\s*)?(repara|reparaci[oó]n|mantenimiento)\s*(ender|bambu|prusa|creality|artillery)/i.test(n) ||
    /kit\s*(repara|reparaci[oó]n)/i.test(n) ||
    // Drivers de placas (FS, TMC, A4988, DRV, y genérico con disipador)
    /driver\s+(fs\d+|tmc\d+|a4988|drv8825|elb\d+|mv\d+)/i.test(n) ||
    /driver\s+(con\s+disipador|de\s+(calor|motor)|para\s+(impres|artil|creali|bambu|prusa))/i.test(n) ||
    // Motion: correas (singular y plural), poleas, rodamientos, raíles (EN + ES)
    /\bcorreas?\b|\bpulley\b|\bpolea\b|\brodamiento\b|\bbearing\b|rail\s*lineal|lead[\s-]?screw|trapezoidal|varilla\s*roscada/i.test(n) ||
    // Conectores neumáticos (PC4-M10, PC4-M6, PC6-01, etc.) para tubo PTFE
    /pc[46][-\s]?m?\d|\bconector\s*neum[aá]/i.test(n) ||
    // Puntas / tips endurecidos (nozzles de acero, carburo, E3D, Hardened)
    /puntas?\s*(de\s*)?(acero\s*endurecido|carburo|tungsten|e3d)|kit.*puntas.*(impres|e3d)/i.test(n) ||
    // Espiral / recubrimiento de cables para impresoras
    /espiral\s*(caucas|negro|cables).*impresi|cable\s*management.*impresi/i.test(n) ||
    // Ventiladores específicos (4010, 5015, hotend, capa) — no ventilador genérico
    /ventilador\s*de\s*capa|layer\s*fan|hotend\s*fan|ventilador.*\b\d{4}\b|\b\d{4}\b.*ventilador/i.test(n) ||
    // Ruedas de carruaje y rodillos de precisión (V-slot, etc.)
    /rueda\s*(policarbonato|pvc|v[\s-]?slot|eccentr|precision)|eccentric\s*(spacer|nut)|espaciador\s*exc[eé]ntrico/i.test(n) ||
    // Cama y superficie de impresión / placas de impresión reemplazables
    /cama\s*caliente|heated\s*bed|vidrio\s*templado|placa\s*de\s*construcci|spring\s*steel|\bpei\b|build\s*plate|\bcryogrip\b|cryo\s*grip|\bflexplate\b|panda.*plate/i.test(n) ||
    // Protectores de pantalla FEP para resina
    /protector\s*de\s*pantalla|\bfep\b|\bnfep\b|release\s*film|pantalla\s*fep/i.test(n) ||
    // Piezas estructurales / paneles de impresoras por marca
    /panel\s*(hr|hl|lateral|frontal|trasero|derecho|izquierdo)|panel.*bambu|bambu.*panel/i.test(n) ||
    /estructura\s*bambu|bambu.*enclosure|enclosure.*bambu|bambu.*estructura/i.test(n) ||
    // Electrónica de impresoras 3D y grabadoras (mainboards, placas madre)
    /\bmainboard\b|placa\s*madre.*impr|placa\s*base.*impr|raspberry.*impr/i.test(n) ||
    // Placa madre de grabadora láser o CNC
    /placa\s*(madre|pcb|controladora)\s*(grab[a]+dora|laser|l[aá]ser|cnc|ortur|xtool|sculpfun)/i.test(n) ||
    /placa\s*(madre|pcb|controladora)\s*(para\s*)?(artillery|creality|ender|bambu|prusa|anycubic|elegoo)/i.test(n) ||
    /placa\s*(madre|pcb|controladora)\s*(eje|x\d?|z\d?)/i.test(n) ||
    // Placa madre/silenciosa para impresoras (con o sin "madre" antes de "silenciosa")
    /placa\s*(madre\s*)?(silenciosa|32[\s-]?bit)\b/i.test(n) ||
    // Placa de impresora por marca/modelo específico
    /placa\s*(impresora|impresi[oó]n)\s*3d\b/i.test(n) ||
    /\bplaca\s*(madre|pcb)\s*32[\s-]?bit\b/i.test(n) ||
    // Controladores de impresoras (BTT, MKS, etc.)
    /\bbigtreetech\b|\bbtt\b|\bmks\s*(gen|sbase|robin)|skr\s*(mini|pro|v\d)|octopus\s*pro|spider\s*v\d/i.test(n) ||
    /\bramps\s*\d\.?\d?\b|tarjeta\s+controlador\s+ramps/i.test(n) ||
    // Drivers de motores para impresoras 3D
    /\ba4988\b|\bdrv8825\b|driver\s+motor\s+paso|driver\s+stepper/i.test(n) ||
    // Pantallas LCD/TFT de impresoras 3D
    /pantalla\s+(lcd|tft|t[aá]ctil).*(artillery|creality|ender|prusa|bambu|anycubic|elegoo)/i.test(n) ||
    /(artillery|creality|ender|prusa|bambu|anycubic|elegoo).*pantalla\s+(lcd|tft|t[aá]ctil)/i.test(n) ||
    // Motores paso a paso para impresoras 3D (cuando se menciona eje o marca de impresora)
    // Soporta variantes como "Motor 42/48 paso a paso eje X Ender 6"
    /motor(\s+[\d/]+)?\s+paso\s+a\s+paso.*(eje|artillery|ender|creality)/i.test(n) ||
    /(eje\s+[xyz]|artillery|ender|creality).*motor(\s+[\d/]+)?\s+paso/i.test(n) ||
    // Fuentes de poder para impresoras 3D
    /fuente\s+(de\s+)?poder.*(impres|artillery|creality|ender|prusa|bambu|meanwell)/i.test(n) ||
    /\bmeanwell\b.*\d+[vV]\s*\d/i.test(n) ||
    // Sistemas de extrusión nombrados
    /sistema\s+de\s+extrusi[oó]n|extrus[oó]n\s+titan|titan\s+extrus/i.test(n) ||
    // Kits de repuesto explícitos
    /kit\s*correa|kit\s*nozzle|kit\s*hotend|upgrade\s*kit\s*(ender|bambu|prusa)/i.test(n) ||
    // Acoplamientos flexibles para ejes de impresoras
    /acoplamiento\s*flexible|acopl.*flexi|flexible.*acopl|spider\s*coupling|jaw\s*coupling/i.test(n) ||
    // Módulos LED / iluminación específica para impresoras 3D
    /m[oó]dulo\s*led.*(impresi|artillery|creality|ender|bambu|prusa)|led.*(strip|tira).*impresi/i.test(n) ||
    /l[aá]mpara\s*led.*(impres|creality|ender|bambu|artillery|prusa)/i.test(n) ||
    /(creality|ender|bambu|artillery|prusa).*l[aá]mpara\s*led/i.test(n) ||
    // Cables de motor stepper (mayormente para impresoras 3D)
    /cable.*(motor\s*stepper|stepper\s*motor)|stepper.*cable.*motor/i.test(n) ||
    // Kits de herramientas y limpieza asociados a impresoras (no genéricos)
    /kit\s*(de\s*)?(herramientas|limpieza|boquillas)\s*(para\s*)?(impres|ender|bambu|creality|artillery)/i.test(n) ||
    /(ender|bambu|creality|artillery|prusa|anycubic).*kit\s*(boquill|nozzle|hotend|repuest)/i.test(n) ||
    // Limpiadores y cepillos de boquillas/nozzle
    /(limpiador|cepillo)\s*(de|para)?\s*boquillas?/i.test(n) ||
    /limpiador\s*(de|para)?\s*nozzle|nozzle\s*cleaner/i.test(n) ||
    // Herramientas/accesorios del sistema AMS (Bambu Lab multi-material) — no son filamento
    /(embudo|funnel)\s*(para\s*)?(filamento|ams|bambu)/i.test(n) ||
    /placa\s*de\s*conexi[oó]n\s*buffer|buffer.*plate.*filament|ams\s*buffer/i.test(n) ||
    // Filamento de limpieza (eClean, etc.) — herramienta, no material de impresión
    /\beclean\b|filamento\s*de\s*limpieza|limpieza\s*filamento|cleaning\s*filament/i.test(n) ||
    // Motor del eje Z/X/Y de impresora (repuesto de movimiento)
    /motor\s*(del?\s*)?(eje|axis)\s*[xyz]?\b|motor\s+para\s+eje\s+[xyz]/i.test(n) ||
    // Cables y packs de cable para impresoras 3D por marca
    /cables?\s+(para|de)\s*(bambu|bambulab|bambu\s*lab|a1\b|x1\b|p1[sp]?\b|creality|ender|artillery|prusa|anycubic|elegoo)\b/i.test(n) ||
    /cable\s*(para|de)\s*(cama|heated[\s-]?bed)/i.test(n) ||
    // Limpiador de purga (sistemas multimaterial como Bambu AMS)
    /limpiador\s*(de|para)?\s*purga\b/i.test(n) ||
    // Partes del motor alimentador AMS (Bambu Lab multi-material)
    /partes?\s*(del?\s*)?motor\s*(alimentador)?\s*(ams|bambu\s*lab?|lite)\b/i.test(n) ||
    /motor\s+alimentador\s+(ams|bambu|lite)\b/i.test(n) ||
    // Conjunto de calefacción para impresoras 3D
    /conjunto\s*(de\s*)?calefacci[oó]n\s*(para\s*)?(a1|x1|p1|bambu|creality|ender|prusa|anycubic)\b/i.test(n) ||
    // Abrazaderas y bloques de marca (piezas estructurales de impresora)
    /(abrazadera|bloque)\s*(para\s*)?(bambu|bambulab|bambu\s+lab\b|a1\b|x1\b|p1[sp]?\b)/i.test(n) ||
    // Cámara para impresora 3D
    /c[aá]mara\s*(para|de)\s*(bambu|bambulab|a1|x1|p1|impresora|3d)\b/i.test(n) ||
    // Ruedas de carruaje genéricas (POM, precisión, V-slot)
    /ruedas?\s+(pom\b|de\s*carruaje|de\s*precisi[oó]n|v[\s-]?slot)\b/i.test(n) ||
    /\bpom\b.*\brueda|rueda.*\bpom\b/i.test(n) ||
    // Cortadores de tubo PTFE/teflón (herramienta de mantenimiento)
    /cortador.*(tubo|teflo|ptfe)|cort.*teflo/i.test(n) ||
    // Pinzas de precisión para impresión 3D
    /\bpinzas?\s+(punta|de\s*precisi[oó]n|para\s*(impresi|soport|3d))/i.test(n) ||
    // Cepillo de limpieza (para impresoras 3D, mantenimiento)
    /cepillo\s+(para|de)\s*(limpieza|nozzle|boquilla|extrusor)/i.test(n) ||
    // Bolsas de sellado al vacío para almacenamiento de filamento (categorizan como repuesto para evitar el bloque de filamentos)
    /bolsas?\s*(para|de)\s*(sellado|vac[ií]o)|sellado.*vac[ií]o.*filament/i.test(n) ||
    // Aceite lubricante / grasa de mantenimiento para impresoras
    /\baceite\s+lubricante\b/i.test(n) ||
    /\bgrasa\s+lubricante\b|\bgrasa\s*(para\s*(impresoras?|impresi[oó]n|3d)\b)/i.test(n) ||
    // Bomba de sellado al vacío (manual o eléctrica)
    /bomba\s*(de\s*)?(sellado|vac[ií]o)/i.test(n) ||
    // Resortes para cama de impresora (bed springs)
    /resortes?\s*(para\s*)?(cama|impresora)\b/i.test(n) ||
    // Kit de resortes de nivelación de cama
    /kit\s*\d*\s*resortes?\s*(de\s*)?(nivelaci[oó]n|cama)\b/i.test(n) ||
    // Alicate / alicates de corte (herramienta de remoción de soportes)
    /alicates?\s*(de\s*corte|diagonal|precision)/i.test(n) ||
    // Gomitas de nivelación / almohadillas de esquinas de cama
    /gomitas?\s*(para\s*)?(nivelaci[oó]n|cama)\b/i.test(n) ||
    // Cama / pad de aislamiento térmico
    /\baislamiento\s*t[eé]rmico\b/i.test(n) ||
    // Disipador heatsink para hotend — E3D V6, Volcano, etc. o marca de impresora
    /\bdisipador\b.*(e3d|v6|hotend|cold[\s-]?end|volcano|artillery|creality|ender|bambu|prusa|anycubic)/i.test(n) ||
    /\bdisipador\s+(artillery|creality|ender|bambu|prusa|anycubic)\b/i.test(n) ||
    // Producto marcado explícitamente con "Repuesto" al inicio del nombre
    /^repuesto\b/i.test(n) ||
    // Placa carruaje de eje X/Y/Z
    /placa\s+(de\s+)?eje\s+[xyz]\b/i.test(n) ||
    // Cable flex / flexible para ejes de impresoras
    /cable\s*(flex|flexible)\b.*(eje|artillery|ender|creality|prusa|bambu|anycubic|elegoo)\b/i.test(n) ||
    /(eje|artillery|ender|creality|prusa|anycubic).*cable\s*(flex|flexible)\b/i.test(n) ||
    // Cable gold finger (conector FFC específico de impresoras Artillery)
    /cable\s*gold[\s-]?finger/i.test(n) ||
    // Teflón (tubo PTFE) para modelo/marca específica de impresora
    /tefl[oó]n\s+(para|de)\s*(ace\b|kobra\b|photon\b|mega\b|bambu\b|ender\b|creality\b|anycubic\b|artillery\b|prusa\b|3d\b)/i.test(n) ||
    // Hub de filamento para impresoras específicas
    /\bhub\s+(para|de)\s*(anycubic|bambu|bambulab|creality|ender|prusa|artillery|kobra|impresora)\b/i.test(n) ||
    // Protector de silicona para bloque calefactor (hotend)
    /protector\s*(de\s*)?silicona\s*(creality|artillery|bambu|ender|prusa|anycubic|k1\b|serie)/i.test(n) ||
    /protector\s*(de\s*)?silicona\s*(para\s*)?(hotend|bloque|impresora)/i.test(n) ||
    // Espátula de despegue para impresión 3D
    /esp[aá]tula\s*(de\s*)?(despegue|remoci[oó]n)\b/i.test(n) ||
    // Espiral / recubrimiento de cables (nombrado con marca o mm)
    /espiral\s*(negro|blanco|cable|mm|mts?|para|impresora)/i.test(n) ||
    // Placa de vidrio / carborundum (superficie de impresión reemplazable)
    /placa\s*(de\s*)?vidrio\s*(carborundum|templado|borosilicato)?\s*(anet|creality|ender|bambu|artillery|prusa|\d+[xX]\d+)/i.test(n) ||
    /placa\s*de\s*vidrio\b/i.test(n) ||
    // Filtro de aire (carbón activado, HEPA, malla) para impresoras
    /filtro\s*(de\s*)?aire\s*(de\s*)?(carbon|carbón|activado|hepa|creality|bambu|x1|p1|ender)/i.test(n) ||
    /(bambu|creality|ender|artillery).*filtro\s*(de\s*)?aire/i.test(n) ||
    // Antena WiFi para impresoras 3D por marca
    /antena\s*(wifi|wi-fi)\s*(para\s*)?(bambu|creality|ender|anycubic|elegoo|artillery|prusa)\b/i.test(n) ||
    // Adaptador de tubo PTFE (Bambu 4-en-1, etc.)
    /adaptador\s*(de\s*tubo|tubo)\s*(de\s*)?(tefl[oó]n|ptfe)/i.test(n) ||
    /(bambu|creality|ender)\s*adaptador.*tubo/i.test(n) ||
    // Bus cable / cable de bus para impresoras Bambu
    /\bbus\s*cable\b|\bcable\s*bus\b/i.test(n) ||
    // Cable USB específico para impresoras (Bambu USB-C, etc.)
    /(bambu|creality|ender|artillery|anycubic)\s*.*usb[\s-]?c?\s*cable/i.test(n) ||
    /cable\s*usb[\s-]?c?\s*(para|de)\s*(bambu|creality|ender|impresora)/i.test(n) ||
    // Cama magnética / flexible (superficie de impresión)
    /cama\s*magn[eé]tica\s*\d+[xX]\d+/i.test(n) ||
    // Base antivibración para impresoras
    /base\s*antivibrac[ií][oó]n\b/i.test(n) ||
    // Driver TMC, A4988, DRV genérico sin marca de placa controladora
    /driver\s*silencioso\s*(tmc|a4988|drv)\d*/i.test(n) ||
    /\btmc\s*22[01]\d\b|\btmc\s*25\d\d\b/i.test(n) ||
    // Kit de pantalla / LCD para modelos Ender/Artillery/Bambu
    /kit\s*pantalla\s*(ender|bambu|artillery|creality|prusa|anycubic)\b/i.test(n) ||
    /kit\s*pantalla\s*ender\b/i.test(n) ||
    // Pantalla táctil / LCD para impresoras (por modelo)
    /pantalla\s*(touch|lcd|tft|t[aá]ctil|original)\s*(bambu|creality|ender|anet|prusa|artillery|anycubic)\b/i.test(n) ||
    /(bambu|creality|ender|anet|prusa|artillery|anycubic)\s*.*pantalla\s*(touch|lcd|tft|t[aá]ctil)/i.test(n) ||
    // Motor XY / motor de eje para impresoras Bambu/Ender/Artillery
    /(bambu|ender|creality|artillery|prusa)\s*(lab\s*)?(motor|motor\s*(xy|x|y|z)\b)/i.test(n) ||
    /motor\s*(xy|nema)\s*(artillery|ender|bambu|creality|prusa)\b/i.test(n) ||
    // Cubierta de vidrio superior para Bambu Lab
    /(bambu|creality|ender)\s*(lab\s*)?cubierta\s*(de\s*)?(vidrio|cristal)/i.test(n) ||
    /cubierta\s*(de\s*)?(vidrio|cristal)\s*(bambu|creality|ender)/i.test(n) ||
    // Kit de extrusión directa / upgrade de extrusor para Ender/Artillery
    /kit\s*extrusi[oó]n\s*(directa|dual|bmg)?\s*(ender|artillery|creality|prusa|bambu)/i.test(n) ||
    // Set de extrusión para impresoras específicas
    /set\s*(de\s*)?extrusi[oó]n\s*(para\s*)?(impresora|ender|anet|creality|artillery)/i.test(n) ||
    // Cabezal de impresión completo (hotend assembly) para impresoras
    /cabezal\s*(completo|de\s*impresi[oó]n)\s*(anycubic|bambu|creality|ender|artillery|prusa)/i.test(n) ||
    /(anycubic|bambu|creality|ender|artillery|prusa)\s*cabezal\s*(completo)?/i.test(n) ||
    // Ensamblaje de varillas / eje de carbono para impresoras
    /ensamblaje\s*(de\s*)?(varillas|eje)\s*(carbono|x|y|z)?\s*(bambu|creality|ender|artillery|prusa)/i.test(n) ||
    // Kit de nivelación automática ABL (sensor + soporte) para impresoras
    // Soporta "Kit de nivelación automática ABL para Artillery" (ABL puede ir entre automática y para)
    /kit\s*(de\s*)?nivelaci[oó]n\s*(autom[aá]tica\s*)?(abl\s*)?(para\s*)?(artillery|creality|ender|bambu|prusa)/i.test(n) ||
    // Aguja / punta de repuesto para sistema de nivelación ABL
    /aguja\s*(de\s*)?repuesto\s*(para\s*)?(nivelaci[oó]n|abl)\b/i.test(n) ||
    /\baguja\b.*(nivelaci[oó]n|abl|artillery|creality|ender)\b/i.test(n) ||
    // Arduino UNO (electrónica de propósito general, no impresora)
    /\barduino\s*(uno|nano|mega|r3)\b/i.test(n) ||
    // Servicios / cursos / mantenimiento preventivo (no productos físicos)
    /\bcurso\s*(impresi[oó]n|3d|impresora)/i.test(n) ||
    /\baprende\s*(a\s*)?(usar|imprimir)\b/i.test(n) ||
    /\barmado\s*y\s*puesta\s*a\s*punto\b/i.test(n) ||
    /\bmantenimiento\s*(preventivo|correctivo)\s*(de\s*)?(ender|bambu|creality|artillery|prusa|impresora)\b/i.test(n) ||
    // Caja de herramientas para impresoras
    /caja\s*(de\s*)?herramientas\s*(para\s*)?(impresora|3d|impresi[oó]n)/i.test(n) ||
    // Kit de herramientas + limpieza genérico para impresión 3D
    /kit\s*(de\s*)?(herramientas|limpieza)\s*(y\s*(limpieza|herramientas))?\s*(para\s*)?(impresoras?|impresi[oó]n\s*3d|3d)\b/i.test(n) ||
    // Conjunto/kit de relé sólido para impresoras
    /conjunto.*rel[eé]\s*(s[oó]lido|solido)\b/i.test(n) ||
    // Lápiz de impresión 3D (en nombre con "impresión" no "impresora")
    /l[aá]piz\s*(de\s*)?impresi[oó]n\s*3d/i.test(n) ||
    // Cámara para impresoras 3D (por marca — distinto de cámara genérica)
    /c[aá]mara\s*(para|de|bambu|bambulab|x1|a1|p1|impresora|3d)\b/i.test(n) ||
    /(bambu|creality|ender|artillery)\s*(lab\s*)?c[aá]mara\b/i.test(n) ||
    // Ensamblaje de varillas / ejes de carbono (repuesto estructural de impresoras)
    /ensamblaje\s*(de\s*)?(varillas?|ejes?)\s*(de\s*)?(carbono|carbon|x\b|y\b|z\b)\s*(bambu|creality|ender|artillery|prusa|de\s*bambu|del\s*eje)?/i.test(n) ||
    // Kit de mantenimiento y upgrade por marca (Artillery, Creality, etc.)
    /kit\s*(de\s*)?(mantenimiento|upgrade|reparaci[oó]n)\s*(y\s*(upgrade|mantenimiento))?\s*(artillery|bambu|creality|ender|prusa|anycubic)\b/i.test(n) ||
    /\bkit\s+mantenimiento\b|\bkit\s+upgrade\s+(artillery|bambu|creality|ender)\b/i.test(n) ||
    // Relé de estado sólido SSR para impresoras
    /rel[eé]\s*(estado\s*)?s[oó]lido\s*(ssr|dc|ac)?\b/i.test(n) ||
    /\bssr\s*(dc|ac|[\s-]\d+[av])\b/i.test(n) ||
    // Hub de filamento para impresoras específicas
    /\bhub\s+(para|de)\s*(anycubic|bambu|bambulab|creality|ender|prusa|artillery|kobra|impresora)\b/i.test(n) ||
    // Catch-all sistémico: «Kit/Set [componente] para [marca conocida]» → siempre repuesto
    // Evita que nuevos accesorios no cubiertos caigan en impresoras-fdm
    /^(kit|set)\b.{3,60}\bpara\s+(artillery|creality|ender\b|bambu|bambulab|prusa|anycubic|elegoo|anet|qidi|voron)\b/i.test(n);

  if (isRepuesto) return 'repuestos';

  // ── 1b. Secadores de filamento ─────────────────────────────────────────
  // Antes de filamentos, para que "Secador de Filamento" no caiga en filamentos-pla
  if (
    /secador[a]?.*filament|filament.*secador[a]?/i.test(n) ||
    /dry[\s-]?box|drybox\b|filament[\s-]?dryer|dryer.*filament/i.test(n) ||
    /\bsunlu\s*s[12]\b|\bpolymaker\s*polydryer\b|\badu\b.*filament/i.test(n) ||
    /\besun\s*lite\b.*secar|secar.*\besun/i.test(n)
  ) return 'secadores';

  // ── 1c. Scanners 3D ────────────────────────────────────────────────────
  if (
    /scanner[\s-]?3d|esc[aá]ner[\s-]?3d|3d[\s-]?scanner/i.test(n) ||
    /\brevopoint\b|\bshining[\s-]?3d\b.*scan|scan.*\bshining[\s-]?3d\b/i.test(n)
  ) return 'scanner-3d';

  // ── 1d. Lápices 3D ────────────────────────────────────────────────────
  if (
    /l[aá]piz[\s-]?3d|pen[\s-]?3d|3d[\s-]?pen\b/i.test(n) ||
    /\b3doodler\b|\bmynt3d\b|\bscribbler\b/i.test(n)
  ) return 'lapices-3d';

  // ── 1e-bis. Grabadoras / cortadoras láser (máquinas completas) ─────────
  // Deben detectarse ANTES de impresoras-fdm porque Creality Falcon, TwoTrees TTC, etc.
  // son grabadoras láser aunque la tienda los ponga en categoría de impresoras.
  // isRepuesto ya capturó módulos láser y placa madre de grabadora.
  if (
    // Nombres que describen la máquina grabadora + láser directamente
    /m[aá]quina\s+(grab[a]+dora|cortadora)[\s-](?:y\s*(?:cortadora|grab[a]+dora)[\s-])?l[aá]ser/i.test(n) ||
    /grab[a]+dora[\s-]+(?:y\s*cortadora[\s-]+)?l[aá]ser\b/i.test(n) ||
    /(cnc\s+)?grab(?:ado|adora)\s+y\s+corte\s+l[aá]ser/i.test(n) ||
    // Creality Falcon (línea grabadora — distinto de impresoras Creality K/CR)
    /creality\s+(?:cr[\s-]?laser\s+)?falcon\b/i.test(n) ||
    /\bcr[\s-]?laser\s+falcon\b/i.test(n) ||
    // TwoTrees modelos láser TTC series
    /\bttc\s*\d{2,4}\b|\bttc\d{2,4}\b/i.test(n) ||
    /\btwotrees\b.*(?:ttc|l[aá]ser|grabador[a]?)/i.test(n) ||
    // Marcas especialistas de grabadoras láser
    /\bxtool\b(?!.*filament)/i.test(n) ||
    /\bsculpfun\b/i.test(n) ||
    /\batomstack\b/i.test(n) ||
    /\bortur\s+(laser|master)\b/i.test(n)
  ) return 'grabadoras-laser';

  // ── 1e. Accesorios de resina (Wash & Cure, UV, PPE, herramientas) ───────
  // Detección ANTES de filamentos para capturar "filtro resina" y similares.
  if (
    /wash\s*[&y]\s*cure|wash[\s-]cure|cure[\s-]wash|lavad[ao][\s&y+]+curad[ao]|curad[ao][\s&y+]+lavad[ao]/i.test(n) ||
    /lavadora\s*ultra|washing\s*(station|machine)|curing\s*(station|unit|machine)|m[aá]quina\s*(de\s*)?curado/i.test(n) ||
    /\bmercury\s*(plus|2|v\d|wash|cure|station)?\b/i.test(n) ||
    /l[aá]mpara\s*(de\s*)?(uv|ultravioleta)|uv\s*lamp|uv\s*light|uv\s*curing\s*light|flash\s*cure|curing\s*lamp/i.test(n) ||
    /filtro.*resina|resina.*filtro|embudo.*resina|resina.*embudo/i.test(n) ||
    /guantes?\s*(de\s*)?(l[aá]tex|nitrilo|vinilo).*resina|guantes?.*resina|resina.*guantes/i.test(n) ||
    /mascarilla.*resina|gafas.*uv|kit.*seguridad.*resina/i.test(n) ||
    /bandeja.*resina|resina.*bandeja|cubeta.*lavado|tina.*resina|resina.*tina/i.test(n) ||
    /esp[aá]tula.*resina|rasqueta.*resina|herramienta.*resina|resina.*herramienta/i.test(n) ||
    // Curadoras UV / lavadoras de resina (incluso con HTML entities como &#038; en lugar de &)
    /\bcuradora\b/i.test(n)
  ) return 'accesorios-resina';

  // ── 1. Filamentos ──────────────────────────────────────────────────────
  // Resinas líquidas — detectar ANTES de keywords de filamento para evitar
  // que "Resina ABS Like" o similar caiga en filamentos-abs.
  if (/^resina\b/i.test(n)) return 'resinas';

  const filamentByPath = /filament/i.test(p);
  // Un producto es filamento si su nombre contiene keywords de material
  // SIN mencionar "impresora/printer" (evita "Filamento compatible con impresora X")
  // filamentByName: detecta nombres con material de filamento; incluye plural "Filamentos"
  const filamentByName = /\bpla\b|polil[aá]ctico|\bpetg\b|\babs\b|\basa\b|\btpu\b|\btpe\b|\bpa\s*nylon\b|\bfilamentos?\b|\bfilament\b/i.test(n);
  const isPrinterWord  = /\bimpresora\b|\bprinter\b/i.test(n);

  // Detectar si el producto es claramente una impresora FDM por nombre (marca+modelo conocidos)
  // aunque venga bajo path /filamentos/ (ej. Imperio3D categoriza impresoras Bambu bajo filamentos)
  // isClearlyPrinterFDM: verdadero sólo cuando el nombre incluye marca + modelo explícito de impresora.
  // IMPORTANTE: no usar sólo la marca (ej. "bambu lab") porque "Filamentos Bambu Lab PPA-CF"
  // también tiene la marca pero es un filamento, no una impresora.
  const isClearlyPrinterFDM =
    // Bambu Lab/Bambulab/Bambu + modelo de impresora específico
    // bambu[\s.]*lab cubre "Bambu Lab", "BambuLab", "Bambu.Lab" y "Bambulab"
    /bambu[\s.]*lab\s*(a1\b|a1\s*mini\b|a1\s*max\b|p1[sp]?\b|x1[ce]?\b|h2[sd]?\b|p2s\b|h2d\b)/i.test(n) ||
    /\bbambulab\s*(a1\b|a1\s*mini\b|a1\s*max\b|p1[sp]?\b|x1[ce]?\b|h2[sd]?\b|p2s\b)/i.test(n) ||
    /\bbambu\s+(a1\b|a1\s*mini\b|p1[sp]?\b|x1[ce]?\b)/i.test(n) ||
    /\bartillery\s+(sidewinder|genius|hornet)/i.test(n) ||
    /\bprusa\s+(mk\d|xl\b|mini|core)/i.test(n) ||
    /elegoo\s*(neptune|centauri|saturn(?!\s*wash))/i.test(n) ||
    /\bams\s*(lite|combo)?\s*(bambu|bambulab|a1\b|x1\b|p1\b|a1\s*series)/i.test(n) ||
    /(bambu|bambulab).*\bams\s*(lite|combo)?\b/i.test(n);

  // Excluir accesorios que mencionan filamento en su nombre pero NO son filamento
  const isFilamentoAccessory =
    /soporte.*(carrete|bobina|spool)|carrete.*(soporte|holder)|spool\s*holder/i.test(n) ||   // soportes de carrete
    /filtro.*resina|resina.*filtro|filtro.*impresi/i.test(n) ||                               // filtros de resina
    /guia.*filament|filament.*guia|guia.*ptfe/i.test(n);                                      // guías/tubos

  if (!isFilamentoAccessory && !isPrinterWord && !isClearlyPrinterFDM && (filamentByPath || filamentByName)) {
    // Si el nombre contiene "resina" junto con keywords de material (p.ej. "Resina ABS Like")
    // → es una resina líquida, no un filamento
    if (/\bresina\b|\bresin\b/i.test(n)) return 'resinas';
    if (/\bpetg\b/i.test(n) || /petg/i.test(p))                   return 'filamentos-petg';
    if (/\babs\b|\basa\b/i.test(n) || /\babs\b|\basa\b/i.test(p)) return 'filamentos-abs';
    if (/\btpu\b|\btpe\b/i.test(n) || /tpu|tpe/i.test(p))         return 'filamentos-tpu';
    if (/\bnylon\b|\bpa12\b|\bpa6\b|\bpa\b(?=[\s-]?\d)|policarbonato|\bpc\b(?![\s-]*factory)|-cf\b|-gf\b|fibra[\s-]*(carbono|vidrio)|\bhips\b|\bpva\b|\bpeek\b|\bepeek\b|\bpei\b|\bultem\b|\bppa\b|\bpps\b|\bpeba\b|\bpcl\b|\bpc[-\s]?ht\b/i.test(n))
      return 'filamentos-especiales';
    return 'filamentos-pla';
  }

  // ── 2. Resinas líquidas (SLA/MSLA) ────────────────────────────────────
  // Si el NOMBRE empieza con "Resina" → siempre es un material líquido, nunca una impresora
  if (/^resina\b/i.test(n)) return 'resinas';

  // isLiquidResin: tiene "resina" en nombre Y (hay cantidad en g/ml o marcadores de resina líquida)
  const hasResinaWord   = /\bresina\b|\bresin\b/i.test(n);
  const hasLiquidMarker = /\d+\s*(g|ml|kg|litro)\b/i.test(n)
    || /\bliquida?\b|\best[aá]ndar\b|\bstandard\b|\bmodeling\b|\bnormal\b|\btranspar|\bwater[\s-]?wash|\babs[\s-]?like/i.test(n)
    || /\bpack\b.*\d+\s*unidades?|\d+\s*unidades?.*\bpack\b/i.test(n);

  if (/resina|resin/i.test(p) && !/impresora.*resina|impresoras-resina/i.test(p)) return 'resinas';
  if (hasResinaWord && hasLiquidMarker && !isPrinterWord) return 'resinas';

  // ── 3. Impresoras de resina y estaciones wash & cure ──────────────────
  if (/impresora.*resina|resina.*impresora|impresoras-resina/i.test(p)) return 'impresoras-resina';
  // Modelos conocidos de impresoras resina
  if (/\bsaturn\b|\bmars\s*\d|\bphoton\b|\bhalot\b|mono\s*x|\bphrozen\b|anycubic\s*m\d|elegoo\s*saturn|sonic\s*mini/i.test(n)) return 'impresoras-resina';
  if (isPrinterWord && /\bresina\b|\bresin\b|\bsla\b|\bmsla\b|\bdlp\b/i.test(n)) return 'impresoras-resina';

  // ── 4. Impresoras FDM ─────────────────────────────────────────────────
  // NO usar "fdm" sólo: "Filamento FDM" es filamento, no impresora
  if (/impresora|printer|impresion-3d|impresoras-3d|impresoras-fdm/i.test(p) && !/resina|resin/i.test(p)) return 'impresoras-fdm';
  // AMS / AMS Lite (sistema multi-material Bambu Lab) → accesorios, no impresora FDM
  // DEBE ir antes de los checks de modelos para que "Ams Lite Bambulab A1" no caiga en FDM
  if (/\bams\s*(lite|combo)?\s*(bambu|bambulab|a1\b|x1\b|p1\b|a1\s*series)/i.test(n) ||
      /(bambu|bambulab).*\bams\s*(lite|combo)?\b/i.test(n)) return 'accesorios';
  if (/\bartillery\b|\bender\b|\bneptune\b|\bkobra\b|\baquila\b|\bvoxelab\b|adventurer|flashforge|\bprusa\b|\bvoron\b|bambu\s*lab?\s*(a1|p1|x1|a1\s*mini|p1s|p1p|p2s|x1c|h2s|h2d)|\bbambulab\s*(a1|p1|x1|p2s|h2s|h2d|a1\s*mini)|elegoo\s*(neptune|centauri)|\bqidi\b/i.test(n)) return 'impresoras-fdm';
  // Modelos Creality FDM adicionales (K-series, CR-series, etc. — NO Falcon que es láser)
  if (/\bcreality\b.*\b(k1|k2|cr[\s-]?\d+|sonic\s*pad|nebula)/i.test(n)) return 'impresoras-fdm';
  // TwoTrees FDM (Sapphire, Bluer, SP series)
  if (/\btwotrees\b.*\b(sapphire|bluer|sp[\s-]?\d)|(?:sapphire|bluer).*\btwotrees\b/i.test(n)) return 'impresoras-fdm';
  // Eazao (impresoras de cerámica/arcilla — tipo FDM extrusión)
  if (/\beazao\b/i.test(n)) return 'impresoras-fdm';
  // Sovol (SV series FDM printers)
  if (/\bsovol\b.*\bsv\s*\d|\bsv\s*\d.*\bsovol\b/i.test(n)) return 'impresoras-fdm';
  // Kingroon FDM
  if (/\bkingroon\b.*(?:kp3s|kp5l|kp\d)|kp3s|kp5l/i.test(n)) return 'impresoras-fdm';
  // Bambu Lab con nombre de modelo sin "bambu" inmediatamente antes (e.g. "Bambu Lab A1C", "Bambulab")
  if (/bambu\.?lab\b|\bbambulab\b|\bbambu\s+lab\b/i.test(n) && !filamentByName) return 'impresoras-fdm';
  // Only classify as FDM if it's not "para impresora" (accessory description) or a repuesto
  if (isPrinterWord
    && !/resina|resin|sla|msla|dlp/i.test(n)
    && !/para\s+(impresora|impresi[oó]n)|repuesto|accesorio|pieza|componente|upgrade|compatible\s+(con|para)/i.test(n)
  ) return 'impresoras-fdm';

  // ── 5. Repuestos generales (por path o nombre) ─────────────────────────────
  if (/repuesto|accesorio|spare|upgrade|hotend|nozzle|extrusor|accesorios/i.test(p)) return 'repuestos';
  if (/\bnozzle\b|\bhotend\b|\bextrusor\b|\bbowden\b|\bptfe\b|motor\s*nema|\brodamiento\b|cama\s*caliente|rail/i.test(n)) return 'repuestos';
  // Poleas y sistemas de movimiento (español)
  if (/\bpolea\b|gt2\s*(\d+\s*dientes|pulley|belt)|correa\s*gt2/i.test(n)) return 'repuestos';
  // Fuentes de poder / switching power supplies genéricas
  if (/fuente\s+(de\s+)?poder|fuente\s+switching|switching\s+power\s+supply/i.test(n)) return 'repuestos';
  // Motores paso a paso / stepper motors genéricos
  if (/motor\s+paso\s+a\s+paso|\bnema\s*\d+\b|stepper\s+motor/i.test(n)) return 'repuestos';
  // Placas madre y electrónica 3D genérica
  if (/\bplaca\s+madre\b|placa\s+pcb\b|relé\s+estado|rel[eé].*s[oó]lido|solid\s+state\s+relay|\bssr\s+dc/i.test(n)) return 'repuestos';

  // ── 5b. Insumos y herramientas de tienda → accesorios ─────────────────
  if (/\/insumos\/|\/herramientas/i.test(p)) {
    // Sub-items que caen en repuestos aunque vengan de insumos
    // (las boquillas ya fueron capturadas por isRepuesto arriba)
    return 'accesorios';
  }

  // ── 6. Accesorios generales ─────────────────────────────────────────────
  if (
    // Enclosures / gabinetes / cubiertas de impresora (incluye eEnclosure de eSUN)
    /enclosure|\bcubierta\s*impresora\b|\bcaja\s*impresora\b|\bgabinete.*impresi|\bgabinete.*3d\b/i.test(n) ||
    // Adhesivos y lacas para impresión 3D
    /\bglue\s*stick\b|\bpegamento.*impr|\bspray.*impr|\badhesivo.*impr|laca.*impresi|impresi.*laca|\b3dlac\b|\blaca\s+3d\b/i.test(n) ||
    // Superficies de impresión
    /\bsuperficie\s*de\s*impresi[oó]n\b|\bbuild\s*surface\b|\balfombrilla\s*magn/i.test(n) ||
    // Tubos PTFE y accesorios de extrusión genéricos
    /\bcapricorn\b|\bptfe\s*tube\b|\btube\s*ptfe\b/i.test(n) ||
    // Almacenamiento de filamentos
    /\bevacuum\b|\bespool\b|vacupack.*filament|filament.*vacuum|almacen.*filament|contenedor.*filament/i.test(n) ||
    // Carrete reutilizable / spool
    /carrete\s*reutilizable|\brespoolable\b|refill\s*spool|\bespool\b/i.test(n) ||
    // Soporte de carrete de filamento (spool holder, friedless stand)
    /soporte\s*(sin\s*fricci[oó]n\s*)?(para\s*)?(carrete|bobina|spool)\b/i.test(n)
  ) return 'accesorios';

  // ── 7. Path-based fallbacks ────────────────────────────────────────────
  if (/mantenimiento/i.test(p)) return 'accesorios';

  return 'general';
}

// ── Clave canónica para comparar el MISMO producto entre tiendas ──────────
//
// Problema: "Filamento PLA Blanco para impresión 3D marca eSUN 1.75mm 1Kg" (cimech3d)
//            vs "PLA Blanco eSUN" (evstore) son el mismo producto → no deben crear
//            fichas separadas en el catálogo.
//
// Solución: derivar la clave de atributos estructurales (brand, material, weight…)
// en vez de del nombre completo slugificado.
//
// Se llama DESPUÉS de extractSpecs para disponer de los specs ya parseados.
// Si no hay suficiente info estructurada se devuelve el slug de nombre como fallback.
export function buildCanonicalKey(
  categoryId:    string,
  specs:         Record<string, string | number>,
  normalizedName: string,
): string {
  const fallback = slugify(normalizedName);

  // ── Filamentos ──────────────────────────────────────────────────────────
  if (categoryId.startsWith('filamento')) {
    const brand    = specs['brand']    as string | undefined;
    const material = specs['material'] as string | undefined;
    const weight   = specs['weight']   as string | undefined;   // gramos
    const diameter = specs['diameter'] as string | undefined;   // "1.75" | "2.85"
    const color    = specs['color']    as string | undefined;

    // Necesitamos al menos marca + material para una clave útil
    if (brand && material) {
      // "1.75" → "175mm"  |  "2.85" → "285mm"
      const diamStr   = diameter ? diameter.replace('.', '') + 'mm' : '175mm';
      // peso en gramos, o 1000g por defecto (el 90% del mercado es 1kg)
      const weightStr = weight ? weight + 'g' : '1000g';
      // color normalizado o "sc" (sin color) si no se detectó
      const colorStr  = color ? slugify(color) : 'sc';
      return `fil-${slugify(brand)}-${slugify(material)}-${weightStr}-${diamStr}-${colorStr}`;
    }
  }

  // ── Impresoras FDM / Resina ─────────────────────────────────────────────
  if (categoryId === 'impresoras-fdm' || categoryId === 'impresoras-resina') {
    const brand = specs['brand'] as string | undefined;
    if (brand) {
      const brandSlug = slugify(brand);
      // Eliminar marca y palabras genéricas de categoría para aislar el modelo
      const modelStr = normalizedName
        .toLowerCase()
        .replace(/\b(impresora|impresion|printer|3d|fdm|sla|msla|dlp|de\s+resina|resina)\b/g, ' ')
        .replace(new RegExp(`\\b${brandSlug.replace(/-/g, '[\\s\\-]+')}\\b`, 'gi'), ' ')
        // Capturar variante sin separador: "bambulab" cuando brand slug es "bambu-lab"
        .replace(new RegExp(`\\b${brandSlug.replace(/-/g, '')}\\b`, 'gi'), ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const modelSlug = slugify(modelStr);
      if (modelSlug.length >= 3) {
        const prefix = categoryId === 'impresoras-fdm' ? 'fdm' : 'rsp';
        return `${prefix}-${brandSlug}-${modelSlug}`;
      }
    }
  }

  // ── Repuestos ──────────────────────────────────────────────────────────
  if (categoryId === 'repuestos') {
    const partType  = specs['partType']       as string | undefined;
    const compat    = specs['compatibleWith']  as string | undefined;
    const nozzleDia = specs['nozzleDiameter']  as string | undefined;
    // No fusionar kits/sets — son productos distintos con precio diferente
    const isKit = /\bkit\b|\bpack\b|\bx\s*[2-9]\b|\d+\s*unidades?\b/i.test(normalizedName);
    if (partType && compat && !isKit) {
      const diaStr = (partType === 'Nozzle' && nozzleDia)
        ? `-${nozzleDia.replace('.', '')}mm`
        : '';
      return `rsp-${slugify(partType)}-${slugify(compat)}${diaStr}`;
    }
  }

  // ── Resinas líquidas ─────────────────────────────────────────────────────
  if (categoryId === 'resinas') {
    const brand  = specs['brand']  as string | undefined;
    const type   = specs['type']   as string | undefined;
    const volume = specs['volume'] as string | undefined;  // ml

    if (brand && volume) {
      const typeSlug = type ? slugify(type) : 'estandar';
      return `res-${slugify(brand)}-${typeSlug}-${volume}ml`;
    }
  }

  return fallback;
}

// ── Extrae specs estructurados desde el nombre del producto ───────────────
// Permite que los filtros del catálogo funcionen con datos reales de Firestore.
export function extractSpecs(name: string, categorySlug: string): Record<string, string> {
  const specs: Record<string, string> = {};

  // ── Marcas por categoría ───────────────────────────────────────────────
  const FILAMENT_BRANDS: [RegExp, string][] = [
    // Globales dominantes
    // \bbambu\b cubre "Bambu Lab", "BambuLab", "Bambu" solos (en contexto filamento siempre = Bambu Lab)
    [/\bbambu\b/i, 'Bambu Lab'],
    [/\bcreality\b/i, 'Creality'],
    [/\besun\b|\be-sun\b/i, 'eSUN'],
    [/\belegoo\b/i, 'Elegoo'],
    [/\bsunlu\b/i, 'Sunlu'],
    [/\banycubic\b/i, 'Anycubic'],
    [/\bisanmate\b/i, 'iSANMATE'],
    // Alta gama y rendimiento
    [/\bpolymaker\b/i, 'Polymaker'],
    [/\bprusament\b|\bprusa\b.*filament/i, 'Prusament'],
    [/\bflashforge\b/i, 'Flashforge'],
    [/\bformfutura\b|\bforma\s*futura\b/i, 'FormFutura'],
    [/\bfiberlogy\b/i, 'Fiberlogy'],
    [/\bhatchbox\b/i, 'Hatchbox'],
    [/\boverture\b/i, 'Overture'],
    [/\bazure[\s-]?film\b/i, 'AzureFilm'],
    // Especializadas
    [/\bspectrum\b(?:\s*filament)?\b/i, 'Spectrum'],
    [/\bcolorfabb\b/i, 'Colorfabb'],
    [/\bninjaflex\b|\bninjatec\b|\bninjatk\b/i, 'NinjaTek'],
    [/\bproto[\s-]?pasta\b|\bprotopasta\b/i, 'Proto-Pasta'],
    [/\bsmartfil\b|\bsmart\s*materials\b/i, 'Smartfil'],
    [/\btaulman\b/i, 'Taulman3D'],
    // Económicas
    [/\bjayo\b/i, 'Jayo'],
    [/\bkingroon\b/i, 'Kingroon'],
    [/\bvoxelab\b/i, 'Voxelab'],
    [/\bgeetech\b|\bgee\s*tech\b/i, 'GeeeTech'],
    [/\banet\b/i, 'Anet'],
    [/\bzaxe\b/i, 'Zaxe'],
    // Regionales
    [/\bgrilon3?\b|\bgrilon\s*3\b/i, 'Grilon3'],
    [/\bprintalot\b/i, 'Printalot'],
    [/\bpopbit\b/i, 'PopBit'],
    [/\bsunhokey\b/i, 'Sunhokey'],
    [/\bhello3d\b/i, 'Hello3D'],
    // Otras
    [/\b3dl[aá]c\b|3d\s*lac/i, '3DLac'],
    [/\braiser3d\b|\braise3d\b/i, 'Raise3D'],
    [/\bprimavalue\b|\bprima\s*value\b/i, 'PrimaValue'],
    [/\bantinsky\b/i, 'Antinsky'],
    // Marcas locales/regionales adicionales
    [/\bjamg[-\s]?he\b/i, 'Jamg He'],
    [/\bplast\.?ar\b/i, 'Plastar'],  // cubre "Plastar" y "Plast.ar"
    [/\bmakers[-\s]?chile\b|\bmakersch\b/i, 'MakersChile'],
    [/\bwinkle\b/i, 'Winkle'],
    [/\bpanchroma\b/i, 'Panchroma'],
    [/\btodotoner\b|\btodo[-\s]?toner\b/i, 'Todotoner'],
    [/\bsoleyin\b/i, 'Soleyin'],
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
    [/\banet\b/i, 'Anet'],
    [/\bankermake\b|\banker\s*make\b/i, 'AnkerMake'],
    [/\bsnapmake[rr]?\b/i, 'Snapmaker'],
    [/\bshining\s*3d\b/i, 'Shining 3D'],
    [/\buniz\b/i, 'Uniz'],
    [/\btwotrees\b|two[\s-]trees/i, 'TwoTrees'],
    [/\beazao\b/i, 'Eazao'],
    [/\bsovol\b/i, 'Sovol'],
    [/\bkingroon\b/i, 'Kingroon'],
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
    [/\bshining\s*3d\b/i, 'Shining 3D'],
    [/\buniz\b/i, 'Uniz'],
    [/\bflashforge\b/i, 'Flashforge'],
  ];

  // ── Filamentos ────────────────────────────────────────────────────────
  if (categorySlug.startsWith('filamento')) {
    // Marca
    for (const [re, brand] of FILAMENT_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }

    // Material específico
    if (/\bpetg[-\s]?cf\b|petg.*(?:carbono|carbon)\b/i.test(name))    specs['material'] = 'PETG-CF';
    else if (/\bpetg[-\s]?hf\b|petg.*high[\s-]?speed/i.test(name))    specs['material'] = 'PETG-HF';
    else if (/\bpetg\b/i.test(name))                                   specs['material'] = 'PETG';
    else if (/\basa[-\s]?cf\b/i.test(name))                            specs['material'] = 'ASA-CF';
    else if (/\basa\b/i.test(name))                                    specs['material'] = 'ASA';
    else if (/\btpu\b/i.test(name))                                    specs['material'] = 'TPU';
    else if (/\btpe\b/i.test(name))                                    specs['material'] = 'TPE';
    else if (/\bnylon[-\s]?cf\b|pa.*(?:carbono|carbon)\b/i.test(name)) specs['material'] = 'Nylon-CF';
    else if (/\bpa12\b/i.test(name))                                   specs['material'] = 'PA12';
    else if (/\bnylon\b|\bpa[\s-]?\d/i.test(name))                    specs['material'] = 'Nylon';
    else if (/policarbonato|\bpc\b(?![\s-]*factory)/i.test(name))     specs['material'] = 'PC';
    else if (/\bhips\b/i.test(name))                                   specs['material'] = 'HIPS';
    else if (/\bpva\b/i.test(name))                                    specs['material'] = 'PVA';
    else if (/\bepeek\b/i.test(name))                                  specs['material'] = 'ePEEK';
    else if (/\bpeek\b/i.test(name))                                   specs['material'] = 'PEEK';
    else if (/\bpei\b|\bultem\b/i.test(name))                         specs['material'] = 'PEI';
    else if (/\bpeba\b/i.test(name))                                   specs['material'] = 'PEBA';
    else if (/\bpcl\b/i.test(name))                                    specs['material'] = 'PCL';
    else if (/\bpc[-\s]?ht\b/i.test(name))                            specs['material'] = 'PC-HT';
    else if (/\babs\b/i.test(name))                                    specs['material'] = 'ABS';
    else if (/\bpla\b/i.test(name)) {
      if (/-cf\b|carbono/i.test(name))                                 specs['material'] = 'PLA-CF';
      else if (/\bsilk\b|\bseda\b/i.test(name))                       specs['material'] = 'PLA Silk';
      else if (/\bmatte\b|\bmate\b/i.test(name))                      specs['material'] = 'PLA Matte';
      else if (/high.?speed|\bhs\b/i.test(name))                      specs['material'] = 'PLA HF';
      else if (/\bplus\b|\+/i.test(name))                             specs['material'] = 'PLA+';
      else                                                              specs['material'] = 'PLA';
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
      // Order matters: more specific patterns first
      [/azul\s*oscuro|dark\s*blue|\bnavy\b|\bazul\s*marino\b/i, 'Azul Oscuro'],
      [/\bblanco\b|\bwhite\b|\bnatural\b/i, 'Blanco'],
      [/\bcrema\b|\bcream\b/i, 'Crema'],
      [/\bhueso\b|\bbone\b/i, 'Hueso'],
      [/\bmarfil\b|\bivory\b/i, 'Marfil'],
      [/\bchampagne\b|\bchampán\b/i, 'Champagne'],
      [/\bnegro\b|\bblack\b/i, 'Negro'],
      [/\bantracita\b|anthrac/i, 'Antracita'],
      [/\bgris\b|\bgray\b|\bgrey\b/i, 'Gris'],
      [/\brojo\b|\bred\b/i, 'Rojo'],
      [/\bborgona\b|\bborgon\w*\b|\bvino\b|\bwine\b|\bburgund/i, 'Borgoña'],
      [/\bcoral\b/i, 'Coral'],
      [/\bterracota\b|\bterr[ae]\s*cot/i, 'Terracota'],
      [/\bnaranja\b|\bnaranjo\b|\borange\b/i, 'Naranja'],
      [/\bamarillo\b|\byellow\b/i, 'Amarillo'],
      [/\bdorado\b|\bgold\b/i, 'Dorado'],
      [/\bverde\b|\bgreen\b/i, 'Verde'],
      [/\blima\b|\blime\b/i, 'Lima'],
      [/\bmenta\b|\bmint\b/i, 'Menta'],
      [/\bceleste\b|\bsky[\s-]?blue\b/i, 'Celeste'],
      [/\bazul\b|\bblue\b/i, 'Azul'],
      [/\bmorado\b|\bvioleta\b|\bpurple\b|\bviolet\b/i, 'Morado'],
      [/\blavanda\b|\blavender\b|\blilac\b/i, 'Lavanda'],
      [/\brosa\b|\bpink\b|\bfucs\w*\b/i, 'Rosa'],
      [/\bcaf[eé]\b|\bbrown\b|\bmarrón\b/i, 'Café'],
      [/\bcobre\b|\bcopper\b|\bbronc[eo]\b/i, 'Cobre'],
      [/\bplateado\b|\bsilver\b/i, 'Plateado'],
      [/\btransparente\b|\btransparent\b|\bclear\b/i, 'Transparente'],
    ];
    for (const [re, color] of COLOR_MAP) {
      if (re.test(name)) { specs['color'] = color; break; }
    }
  }

  // ── Grabadoras láser: marca, potencia, área de trabajo ────────────────
  if (categorySlug === 'grabadoras-laser') {
    const LASER_BRANDS: [RegExp, string][] = [
      [/\bxtool\b/i, 'xTool'],
      [/\bsculpfun\b/i, 'Sculpfun'],
      [/\bortur\b/i, 'Ortur'],
      [/\batomstack\b/i, 'Atomstack'],
      [/\btwotrees\b|two[\s-]trees/i, 'TwoTrees'],
      [/\bcreality\b/i, 'Creality'],
      [/\banycubic\b/i, 'Anycubic'],
      [/\bcomgrow\b/i, 'Comgrow'],
    ];
    for (const [re, brand] of LASER_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }
    // Potencia: "10W", "20W Pro", "40W Ultra"
    const wattMatch = name.match(/(\d+(?:[.,]\d+)?)\s*w(?:\s*pro|\s*ultra)?\b/i);
    if (wattMatch) {
      const wVal = wattMatch[1].replace(',', '.');
      const wSuffix = /pro/i.test(wattMatch[0]) ? 'W Pro' : /ultra/i.test(wattMatch[0]) ? 'W Ultra' : 'W';
      specs['watt'] = wVal + wSuffix;
    }
    // Área de trabajo
    const areaMatch = name.match(/(\d{2,4})\s*[xX×]\s*(\d{2,4})\s*mm/i);
    if (areaMatch) specs['workArea'] = `${areaMatch[1]}x${areaMatch[2]}mm`;
  }

  // ── Impresoras FDM / Resina ────────────────────────────────────────────
  if (categorySlug === 'impresoras-fdm' || categorySlug === 'impresoras-resina') {
    for (const [re, brand] of PRINTER_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }
  }

  // ── Impresoras FDM: volumen de construcción ───────────────────────────
  if (categorySlug === 'impresoras-fdm') {
    const waMatch = name.match(/(\d{2,4})\s*[xX×]\s*(\d{2,4})\s*[xX×]\s*(\d{2,4})/);
    if (waMatch) {
      specs['workArea'] = `${waMatch[1]}×${waMatch[2]}×${waMatch[3]}mm`;
      // Rango de volumen de impresión
      const minDim = Math.min(parseInt(waMatch[1]), parseInt(waMatch[2]));
      if (minDim >= 400)       specs['buildVolume'] = 'Industrial / XL (400mm+)';
      else if (minDim >= 300)  specs['buildVolume'] = 'Grande (300mm+)';
      else if (minDim >= 220)  specs['buildVolume'] = 'Estándar (220-299mm)';
      else                     specs['buildVolume'] = 'Pequeño (hasta 220mm)';
    }

    // Cinemática
    if (/\bcorexY\b|core[\s-]?xy/i.test(name))              specs['kinematics'] = 'CoreXY';
    else if (/\bdelta\b|\bflsun\b|kossel/i.test(name))       specs['kinematics'] = 'Delta';
    else if (/bed[\s-]?slinger|cartesian|cartesiana/i.test(name)) specs['kinematics'] = 'Cartesiana';
    // Inferir por modelos conocidos
    else if (/bambu\s*(lab\s*)?(a1|p1|x1|h2)|voron|k[12]\b|prusa\s*core|ratrig/i.test(name)) specs['kinematics'] = 'CoreXY';
    else if (/\bender\b|\bneptune\b|\bartillery\b|aquila|cr[\s-]?\d+/i.test(name))            specs['kinematics'] = 'Cartesiana';

    // Tipo de extrusión
    if (/direct[\s-]?drive|extrusi[oó]n\s*directa/i.test(name))  specs['extruderType'] = 'Directa';
    else if (/bowden/i.test(name))                                  specs['extruderType'] = 'Bowden';
    // Inferir por modelos
    else if (/bambu|prusa\s*(mk4|xl)|k[12]\b|voron|ender[\s-]?3\s*(s1|pro\+)|artist/i.test(name)) specs['extruderType'] = 'Directa';
    else if (/ender[\s-]?3\s*(v2|pro\b)|neptune[\s-]?2/i.test(name)) specs['extruderType'] = 'Bowden';

    // Cerramiento
    if (/enclosure|cerrada|enclosed|cerra[dm]/i.test(name))      specs['enclosure'] = 'Cerrada';
    else if (/abierta|open[\s-]?frame/i.test(name))               specs['enclosure'] = 'Abierta';
    // Inferir por modelos
    else if (/bambu\s*(lab\s*)?(p1s|x1c|x1e|h2)|qidi.*speed|voron.*v[23]/i.test(name)) specs['enclosure'] = 'Cerrada';
    else if (/bambu\s*(lab\s*)?(a1\b|p1p)/i.test(name))           specs['enclosure'] = 'Abierta';

    // Velocidad de impresión
    if (/\b[3-9]\d{2}\s*mm\/s|\b[1-9]\d{3}\s*mm\/s/i.test(name))    specs['maxSpeed'] = 'Ultra (300+mm/s)';
    else if (/\b[1-2]\d{2}\s*mm\/s/i.test(name))                      specs['maxSpeed'] = 'Alta (100-299mm/s)';
    // Inferir por modelos
    else if (/bambu|k[12]\b|voron|ender[\s-]?3\s*s1\s*pro|neptune[\s-]?4\s*pro/i.test(name)) specs['maxSpeed'] = 'Ultra (300+mm/s)';

    // Nivelación automática
    if (/auto[\s-]?level|nivelaci[oó]n\s*autom[aá]tica|abl\b|crtouch|bltouch|cr[\s-]?touch/i.test(name))
      specs['autoLevel'] = 'Sí';

    // Multimaterial / multicolor
    if (/ams\b|mmu\b|multi[\s-]?material|multi[\s-]?color|multicolor|combo/i.test(name))
      specs['multiMaterial'] = 'Sí';
  }

  // ── Impresoras de Resina: resolución UV y tecnología ─────────────────
  if (categorySlug === 'impresoras-resina') {
    if (/\b16k\b/i.test(name))      specs['resolution'] = '16K';
    else if (/\b14k\b/i.test(name)) specs['resolution'] = '14K';
    else if (/\b12k\b/i.test(name)) specs['resolution'] = '12K';
    else if (/\b10k\b/i.test(name)) specs['resolution'] = '10K';
    else if (/\b8k\b/i.test(name))  specs['resolution'] = '8K';
    else if (/\b4k\b/i.test(name))  specs['resolution'] = '4K';

    if (/\bdlp\b/i.test(name))                       specs['technology'] = 'DLP';
    else if (/\bsla\b/i.test(name))                   specs['technology'] = 'SLA';
    else if (/\bmsla\b|\blcd\b|mono\s*x/i.test(name)) specs['technology'] = 'MSLA / LCD';
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

  // ── Accesorios de Resina ──────────────────────────────────────────────
  if (categorySlug === 'accesorios-resina') {
    for (const [re, brand] of RESIN_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }
    if (/wash\s*[&y]\s*cure|wash[\s-]cure|cure[\s-]wash|curing\s*(station|unit|machine)|lavad[ao].*curad[ao]|curad[ao].*lavad[ao]|lavadora\s*ultra|\bmercury\b/i.test(name))
      specs['type'] = 'Wash & Cure';
    else if (/l[aá]mpara\s*(uv|ultravioleta)|uv\s*lamp|uv\s*light|uv\s*curing|flash\s*cure/i.test(name))
      specs['type'] = 'Lámpara UV';
    else if (/guantes?|mascarilla|gafas\s*(uv|seguridad)|ppe/i.test(name))
      specs['type'] = 'PPE / Seguridad';
    else if (/filtro|embudo|esp[aá]tula|rasqueta/i.test(name))
      specs['type'] = 'Herramienta';
    else if (/bandeja|cubeta|tina|contenedor/i.test(name))
      specs['type'] = 'Contenedor';
  }

  // ── Repuestos ─────────────────────────────────────────────────────────
  if (categorySlug === 'repuestos') {
    // Brand (printer compatibility)
    for (const [re, brand] of PRINTER_BRANDS) {
      if (re.test(name)) { specs['brand'] = brand; break; }
    }

    // Part type classification
    if (/\bnozzle\b|\bboquilla\b/i.test(name)) {
      specs['partType'] = 'Nozzle';
      // Nozzle diameter (0.2, 0.25, 0.3, 0.4, 0.6, 0.8, 1.0, 1.2)
      const ndMatch = name.match(/\b(\d[.,]\d{1,2})\s*mm/);
      if (ndMatch) {
        const d = parseFloat(ndMatch[1].replace(',', '.'));
        const std    = [0.2, 0.25, 0.3, 0.4, 0.6, 0.8, 1.0, 1.2];
        const stdStr = ['0.2', '0.25', '0.3', '0.4', '0.6', '0.8', '1.0', '1.2'];
        const idx = std.reduce((best, v, i) => Math.abs(v - d) < Math.abs(std[best] - d) ? i : best, 0);
        if (Math.abs(std[idx] - d) < 0.05) specs['nozzleDiameter'] = stdStr[idx];
      }
    }
    else if (/\bhotend\b|heatbreak|heat\s*break|\bcalefactor\b|heater[\s-]?block|\btermistor\b/i.test(name)) specs['partType'] = 'Hotend';
    else if (/\bextrusor\b|\bextruder\b|\bengranaje\b|\bmk8\b|\bdual\s*drive\b/i.test(name)) specs['partType'] = 'Extrusor';
    else if (/\bsensor\b|endstop|final\s*de\s*carrera|\bprobe\b|bltouch|cr[\s-]?touch|modulo\s*detecci[oó]n/i.test(name)) specs['partType'] = 'Sensor';
    else if (/\bcorrea\b|\bpulley\b|\bpolea\b|gt2.*belt|belt.*gt2/i.test(name)) specs['partType'] = 'Correa / Polea';
    else if (/motor\s+paso|stepper|\bnema\s*\d+/i.test(name)) specs['partType'] = 'Motor';
    else if (/\bmainboard\b|placa\s*(madre|pcb|controladora)|bigtreetech|\bbtt\b|\bmks\b|skr\s*(mini|pro)/i.test(name)) specs['partType'] = 'Placa';
    else if (/cama\s*caliente|heated\s*bed|vidrio\s*templado|placa.*construcci|spring\s*steel|\bpei\b|build\s*plate/i.test(name)) specs['partType'] = 'Cama / Superficie';
    else if (/fuente\s*(de\s*)?poder|power\s*supply|\bmeanwell\b/i.test(name)) specs['partType'] = 'Fuente de Poder';
    else if (/ventilador|fan/i.test(name)) specs['partType'] = 'Ventilador';
    else if (/\bfep\b|\bnfep\b|release\s*film|pantalla\s*fep|tanque\s*resina|resin\s*vat/i.test(name)) specs['partType'] = 'Accesorio Resina';
    else if (/pantalla\s*(lcd|tft)|lcd\s*screen/i.test(name)) specs['partType'] = 'Pantalla LCD';
    else if (/\btermistor\b|thermocouple|termopar/i.test(name)) specs['partType'] = 'Termistor';
    else if (/\brodamiento\b|\bbearing\b|rail\s*lineal|eccentric|espaciador/i.test(name)) specs['partType'] = 'Rodamiento / Riel';
    else if (/driver\s+(fs|tmc|a4988|drv)/i.test(name)) specs['partType'] = 'Driver Motor';
    else if (/silicona|garganta|throat/i.test(name)) specs['partType'] = 'Piezas Hotend';
    else if (/correa|varilla\s*roscada|lead[\s-]?screw|husillo|trapezoidal/i.test(name)) specs['partType'] = 'Sistema de Movimiento';

    // Compatible model family
    const MODEL_FAMILIES: [RegExp, string][] = [
      // Creality Ender — specific variants before generic
      [/\bender\s*3\s*v3\s*se\b/i, 'Ender 3 V3 SE'],
      [/\bender\s*3\s*v3\s*(plus|pro)?\b/i, 'Ender 3 V3'],
      [/\bender\s*3\s*s1\s*pro\b|\be3s1\s*pro\b/i, 'Ender 3 S1 Pro'],
      [/\bender\s*3\s*s1\b|\be3s1\b/i, 'Ender 3 S1'],
      [/\bender\s*3\s*(neo|v2|pro|plus|max)?\b/i, 'Ender 3'],
      [/\bender\s*5\b/i, 'Ender 5'],
      [/\bender\s*6\b/i, 'Ender 6'],
      [/\bcr[\s-]?10\b/i, 'CR-10'],
      [/\bcr[\s-]?6\b/i, 'CR-6'],
      // Creality K-series
      [/\bk1\s*max\b/i, 'K1 Max'],
      [/\bk1[c]\b/i, 'K1C'],
      [/\bk1\b/i, 'K1'],
      [/\bk2\s*plus\b/i, 'K2 Plus'],
      // Artillery
      [/\bartillery\s*(x1|sidewinder)/i, 'Artillery Sidewinder'],
      [/\bartillery\s*(x2|genius)/i, 'Artillery Genius'],
      [/\bartillery\s*(hornet|x3)/i, 'Artillery Hornet'],
      [/\bartillery\b/i, 'Artillery'],
      // Bambu Lab
      [/\ba1\s*mini\b/i, 'Bambu A1 Mini'],
      [/\bbambu\b.*\ba1\b|\ba1\b.*\bbambu\b/i, 'Bambu A1'],
      [/\bp1[sp]\b/i, 'Bambu P1'],
      [/\bx1\s*(carbon|combo|c)?\b/i, 'Bambu X1'],
      // Others
      [/\bprusa\s*(mk3|mk4|xl|mini)/i, 'Prusa'],
      [/\banycubic\s*(kobra|i3)/i, 'Anycubic Kobra / i3'],
      [/\bkossel\b/i, 'Kossel'],
      [/\bdelta\b.*\bimpresora\b|\bimpresora.*\bdelta\b/i, 'Delta genérica'],
    ];
    for (const [re, model] of MODEL_FAMILIES) {
      if (re.test(name)) { specs['compatibleWith'] = model; break; }
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

