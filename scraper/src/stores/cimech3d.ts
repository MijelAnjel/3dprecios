import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

// ──────────────────────────────────────────────────────────────
// Cimech 3D — cimech3d.cl — WooCommerce Store API
// Tienda especializada en impresión 3D
// ──────────────────────────────────────────────────────────────

// Cimech también vende electrónica general (Arduino, CNC Mach3, brocas CNC, etc.)
// que NO corresponde a impresión 3D. Este filtro elimina ese ruido.
const NON_3D_RE = /\barduino\b|\batmega\b|\bgrbl\b|\bmach3\b|fluid\s*cnc|spring\s+collet|er\s*\d+\s+collet|kit\s+de\s+brocas\s+cnc|kit\s+capacitor|kit\s+transistor|kit\s+diod|kit\s+boton|kit\s+potenci|shield.*cnc|cnc.*shield|\bUNO\s+R3\b|\bNANO\s+33\b|\bMEGA\s+2560\b|controlador.*mach3|mach3.*controlador|fluid\s*nc\b|microcontrolador\s+arduino/i;

const KEYWORDS_3D = [
  'impresora', 'impresion 3d', 'filamento', 'resina', 'pla', 'petg', 'abs', 'tpu', 'tpe',
  'bambu', 'creality', 'ender', 'prusa', 'anycubic', 'elegoo', 'flashforge', 'artillery',
  'extrusor', 'hotend', 'nozzle', 'boquilla', 'cama caliente', 'heatbed', 'bowden',
  'correa gt2', 'polea gt2', 'motor paso a paso eje', 'secador', 'drybox', 'esun', 'sunlu',
  'fep', 'placa madre artillery', 'placa pcb', 'sensor filamento', 'final de carrera',
];

function is3DRelated(name: string): boolean {
  if (NON_3D_RE.test(name)) return false;
  const lower = name.toLowerCase();
  return KEYWORDS_3D.some(kw => lower.includes(kw));
}

export async function scrapeCimech3d(store: StoreConfig): Promise<ScraperResult[]> {
  const products = await fetchWcStoreProducts(store.baseUrl, [], { rateDelay: 1500 });

  const results: ScraperResult[] = products
    .filter(p => p.prices?.price && parseInt(p.prices.price, 10) > 0)
    .filter(p => is3DRelated(p.name))
    .map(p => ({
      storeId:      store.id,
      storeName:    store.name,
      productName:  p.name,
      productUrl:   p.permalink,
      price:        parseInt(p.prices.price, 10),
      currency:     'CLP' as const,
      stock:        p.is_in_stock ? 'available' : 'out',
      imageUrl:     p.images?.[0]?.src ?? '',
      categorySlug: inferCategory(p.name, p.categories?.[0]?.slug ?? ''),
      scrapedAt:    new Date(),
    }));

  console.log(`[Cimech3D] Total productos (filtrados): ${results.length}`);
  return results;
}
