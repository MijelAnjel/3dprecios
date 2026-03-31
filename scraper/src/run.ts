import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { ScraperResult, STORES } from './models';
import { saveResults, syncStores, checkPriceAlerts } from './firebase';
// ── Tiendas especializadas en impresión 3D ────────────────────
import { scrapeImpresalta }    from './stores/impresalta';
import { scrapeFormageo }      from './stores/formageo';
import { scrapeTresD }         from './stores/tresd';
import { scrapeAhi3d }         from './stores/ahi3d';
import { scrapeFilamento }     from './stores/filamento';
import { scrapeMakershop }     from './stores/makershop';
import { scrapeImperio3d }     from './stores/imperio3d';
import { scrapeImpakt }        from './stores/impakt';
import { scrapeTodoTorner }    from './stores/todotorner';
import { scrapeDeskfab }       from './stores/deskfab';
import { scrapeFilamentosMaxi } from './stores/filamentosmaxi';
// ── Retail general ────────────────────────────────────────────
import { scrapeFalabella }     from './stores/falabella';
import { scrapeSodimac }       from './stores/sodimac';
import { scrapeParis }         from './stores/paris';
import { scrapeRipley }        from './stores/ripley';

// ──────────────────────────────────────────────
// Punto de entrada — 3DPrecios Scraper
// ──────────────────────────────────────────────

type StoreScraperFn = typeof scrapeImpresalta;

const STORE_SCRAPERS: Record<string, StoreScraperFn> = {
  // Especializadas
  impresalta:     scrapeImpresalta,
  formageo:       scrapeFormageo,
  tresd:          scrapeTresD,
  ahi3d:          scrapeAhi3d,
  filamento:      scrapeFilamento,
  makershop:      scrapeMakershop,
  imperio3d:      scrapeImperio3d,
  impakt:         scrapeImpakt,
  todotorner:     scrapeTodoTorner,
  deskfab:        scrapeDeskfab,
  filamentosmaxi: scrapeFilamentosMaxi,
  // Retail
  falabella:      scrapeFalabella,
  sodimac:        scrapeSodimac,
  paris:          scrapeParis,
  ripley:         scrapeRipley,
};

async function runAllScrapers(db: Firestore): Promise<ScraperResult[]> {
  const allResults: ScraperResult[] = [];

  // Solo tiendas activas
  const activeStores = STORES.filter(s => s.isActive);

  // Si se pasa --store=<id> solo corre ese scraper
  const storeArg = process.argv.find(a => a.startsWith('--store='))?.split('=')[1];

  const storesToRun = storeArg
    ? activeStores.filter(s => s.id === storeArg)
    : activeStores;

  if (storeArg && storesToRun.length === 0) {
    throw new Error(`Tienda no encontrada: "${storeArg}". Disponibles: ${activeStores.map(s => s.id).join(', ')}`);
  }

  for (const store of storesToRun) {
    const scraper = STORE_SCRAPERS[store.id];
    if (!scraper) {
      console.warn(`[Scraper] Sin implementación para: ${store.id}`);
      continue;
    }

    console.log(`\n━━━ Iniciando ${store.name} ━━━`);
    const start = Date.now();

    try {
      const results = await scraper(store);
      allResults.push(...results);
      console.log(`[${store.name}] ✓ ${results.length} productos en ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`[${store.name}] ✗ Error:`, err);
      // Continúa con las demás tiendas
    }
  }

  return allResults;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[3DPrecios Scraper] Iniciando...');
  console.log(`[3DPrecios Scraper] ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── Firebase Admin init ────────────────────────────────────
  const serviceAccount = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!serviceAccount) {
    throw new Error('Variable FIREBASE_SERVICE_ACCOUNT no configurada');
  }

  const app: App = initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });
  const db: Firestore = getFirestore(app);
  console.log('[Firebase] Conectado a Firestore (proyecto: dprecios)');

  // ── Sincronizar tiendas ────────────────────────────────────
  await syncStores(db);

  // ── Ejecutar scrapers ──────────────────────────────────────
  const results = await runAllScrapers(db);
  console.log(`\n[Scraper] Total resultados: ${results.length}`);

  // ── Guardar en Firestore ───────────────────────────────────
  await saveResults(db, results);

  // ── Trigger alertas de precio ──────────────────────────────
  const changedProducts = [...new Set(results.map(r => {
    const { slugify } = require('./utils');
    return slugify(r.productName) as string;
  }))];
  await checkPriceAlerts(db, changedProducts);

  console.log('\n[3DPrecios Scraper] ✓ Completado exitosamente.');
}

main().catch((err: unknown) => {
  console.error('[3DPrecios Scraper] Error fatal:', err);
  process.exit(1);
});
