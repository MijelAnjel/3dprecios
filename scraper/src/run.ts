import * as dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { ScraperResult, STORES } from './models';
import { saveResults, syncStores, checkPriceAlerts } from './firebase';
import { exportCatalog } from './export';
// ── Tiendas especializadas ────────────────────────────────────
import { scrapeHorus3d }          from './stores/horus3d';
import { scrapeImperio3d }        from './stores/imperio3d';
import { scrapeMakerschile }      from './stores/makerschile';
import { scrapeEvstore }          from './stores/evstore';
import { scrapeMake3d }           from './stores/make3d';
import { scrapeMaxi3d }           from './stores/maxi3d';
import { scrapeCapital3d }        from './stores/capital3d';
import { scrape3dworks }          from './stores/3dworks';
import { scrapeCimech3d }         from './stores/cimech3d';
import { scrapeDream3d }          from './stores/dream3d';
import { scrapeTriangulab }       from './stores/triangulab';
import { scrapePrintalot }        from './stores/printalot';
import { scrape3dinsumos }        from './stores/3dinsumos';
import { scrapeNebula3d }         from './stores/nebula3d';
import { scrapeRed3d }            from './stores/red3d';
import { scrapeMundo3d }          from './stores/mundo3d';
import { scrapeMekano3d }         from './stores/mekano3d';
import { scrapeOpen3d }           from './stores/open3d';
import { scrapeFilamento }        from './stores/filamento';
import { scrapeCrealityChile }    from './stores/crealitychile';
import { scrapeArtilleryChile }   from './stores/artillerychile';
import { scrapeDeskfab }          from './stores/deskfab';
import { scrapeImpakt }           from './stores/impakt';
import { scrapeMakershop }        from './stores/makershop';
import { scrapeFilamentosMaxi }   from './stores/filamentosmaxi';
import { scrapeTodoTorner }       from './stores/todotorner';
import { scrapeTresD }            from './stores/tresd';
// ── Repuestos y electrónica ───────────────────────────────────
import { scrapeAfel }             from './stores/afel';
import { scrapeTecnosistec }      from './stores/tecnosistec';
import { scrapeMciElectronics }   from './stores/mcielectronics';
import { scrapeElectronicat }     from './stores/electronicat';
import { scrapeEinsumos }         from './stores/einsumos';
// ── Retail técnico ────────────────────────────────────────────
import { scrapeTodotoner }        from './stores/todotoner';
import { scrapePcfactory }        from './stores/pcfactory';
// ── Retail general ────────────────────────────────────────────
import { scrapeFalabella }        from './stores/falabella';
import { scrapeSodimac }          from './stores/sodimac';
import { scrapeParis }            from './stores/paris';
import { scrapeRipley }           from './stores/ripley';

// ──────────────────────────────────────────────
// Punto de entrada — 3DPrecios Scraper
// ──────────────────────────────────────────────

type StoreScraperFn = typeof scrapeHorus3d;

const STORE_SCRAPERS: Record<string, StoreScraperFn> = {
  // Especializadas
  horus3d:          scrapeHorus3d,
  imperio3d:        scrapeImperio3d,
  makerschile:      scrapeMakerschile,
  evstore:          scrapeEvstore,
  make3d:           scrapeMake3d,
  maxi3d:           scrapeMaxi3d,
  capital3d:        scrapeCapital3d,
  '3dworks':        scrape3dworks,
  cimech3d:         scrapeCimech3d,
  dream3d:          scrapeDream3d,
  triangulab:       scrapeTriangulab,
  printalot:        scrapePrintalot,
  '3dinsumos':      scrape3dinsumos,
  nebula3d:         scrapeNebula3d,
  red3d:            scrapeRed3d,
  mundo3d:          scrapeMundo3d,
  mekano3d:         scrapeMekano3d,
  open3d:           scrapeOpen3d,
  filamento:        scrapeFilamento,
  crealitychile:    scrapeCrealityChile,
  artillerychile:   scrapeArtilleryChile,
  deskfab:          scrapeDeskfab,
  impakt:           scrapeImpakt,
  makershop:        scrapeMakershop,
  filamentosmaxi:   scrapeFilamentosMaxi,
  todotorner:       scrapeTodoTorner,
  tresd:            scrapeTresD,
  // Repuestos y electrónica
  afel:             scrapeAfel,
  tecnosistec:      scrapeTecnosistec,
  mcielectronics:   scrapeMciElectronics,
  electronicat:     scrapeElectronicat,
  einsumos:         scrapeEinsumos,
  // Retail técnico
  todotoner:        scrapeTodotoner,
  pcfactory:        scrapePcfactory,
  // Retail general
  falabella:        scrapeFalabella,
  sodimac:          scrapeSodimac,
  paris:            scrapeParis,
  ripley:           scrapeRipley,
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
  // ── Exportar catálogo estático — Zero Cost ─────────────────────────────────
  // Genera src/assets/data/catalog.json con todos los productos + entries.
  // El frontend Angular lee este archivo desde CDN (0 lecturas a Firestore).
  await exportCatalog(db);
  console.log('\n[3DPrecios Scraper] ✓ Completado exitosamente.');
}

main().catch((err: unknown) => {
  console.error('[3DPrecios Scraper] Error fatal:', err);
  process.exit(1);
});
