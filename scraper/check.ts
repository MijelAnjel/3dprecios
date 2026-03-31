import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { inferCategory, extractSpecs, normalizeProductName, slugify } from './src/utils';
import { exportCatalog } from './src/export';

const sa = require('./dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json');
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Tiendas cuyas entries son basura del seed (scraper nunca corrió)
const SEED_ONLY_STORES = ['falabella', 'ripley', 'paris', 'sodimac', 'lider', 'easy'];

async function diagnose(verbose = false) {
  const productsSnap = await db.collection('products').get();
  const catCount: Record<string, number> = {};
  const storeCount: Record<string, number> = {};

  for (const productDoc of productsSnap.docs) {
    const data = productDoc.data();
    const cat = data['categoryId'] ?? 'undefined';
    catCount[cat] = (catCount[cat] ?? 0) + 1;
  }

  console.log('\n=== PRODUCTOS POR CATEGORÍA ===');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // Detectar slugs duplicados (solo heurística local, sin lecturas extra)
  const dupSlugs = productsSnap.docs.filter(doc => {
    const name: string = doc.data()['name'] ?? '';
    const correctSlug = slugify(normalizeProductName(name));
    return correctSlug !== doc.id && correctSlug.length >= 5;
  });
  if (dupSlugs.length > 0) {
    console.log(`\n⚠️  Slugs incorrectos detectados: ${dupSlugs.length} (ejecutar --fix-dupes para corregir)`);
    dupSlugs.slice(0, 5).forEach(d => {
      const name: string = d.data()['name'] ?? '';
      console.log(`  "${d.id}" → "${slugify(normalizeProductName(name))}"`);
    });
    if (dupSlugs.length > 5) console.log(`  ... y ${dupSlugs.length - 5} más`);
  }

  console.log('\nTotal productos:', productsSnap.size);

  // Con --verbose también muestra desglose por tienda (requiere leer todas las entries)
  if (verbose) {
    console.log('\n=== PRODUCTOS POR TIENDA (verbose) ===');
    const entriesSnap = await db.collectionGroup('entries').get();
    const byStore: Record<string, Set<string>> = {};
    entriesSnap.docs.forEach(d => {
      const data = d.data();
      const sid = data['storeId'] as string;
      if (!byStore[sid]) byStore[sid] = new Set();
      byStore[sid].add(data['productId']);
    });
    Object.entries(byStore)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([store, products]) => {
        console.log(`  ${store}: ${products.size} productos`);
      });
  }
}

async function cleanSeedEntries() {
  console.log('=== ELIMINANDO ENTRIES DE SEED (retail general sin scraper real) ===');
  const productsSnap = await db.collection('products').get();
  let deletedEntries = 0;
  const affectedProducts = new Set<string>();

  for (const productDoc of productsSnap.docs) {
    const entriesSnap = await db
      .collection('products').doc(productDoc.id)
      .collection('entries')
      .get();

    for (const entryDoc of entriesSnap.docs) {
      const storeId = entryDoc.data()['storeId'];
      if (SEED_ONLY_STORES.includes(storeId)) {
        await entryDoc.ref.delete();
        deletedEntries++;
        affectedProducts.add(productDoc.id);
        console.log(`  [DELETE entry] ${productDoc.id} / ${storeId}`);
      }
    }
  }

  console.log(`\nEntries seed borradas: ${deletedEntries}`);

  // Recalcular / borrar productos afectados
  let updated = 0;
  let deleted = 0;
  for (const productId of affectedProducts) {
    const remaining = await db
      .collection('products').doc(productId)
      .collection('entries')
      .where('isActive', '==', true)
      .get();

    if (remaining.empty) {
      await db.collection('products').doc(productId).delete();
      deleted++;
      console.log(`  [DELETE product] ${productId}`);
    } else {
      const prices = remaining.docs.map(d => d.data()['price'] as number);
      const storeCount = new Set(remaining.docs.map(d => d.data()['storeId'])).size;
      await db.collection('products').doc(productId).update({
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        storeCount,
        updatedAt: Timestamp.now(),
      });
      updated++;
    }
  }

  console.log(`Productos actualizados: ${updated} | Borrados: ${deleted}`);
}

async function recategorize() {
  console.log('=== RE-CATEGORIZANDO PRODUCTOS CON inferCategory + extractSpecs ACTUALIZADO ===');
  const productsSnap = await db.collection('products').get();
  let changed = 0;
  let specsUpdated = 0;
  let skipped = 0;

  for (const productDoc of productsSnap.docs) {
    const data      = productDoc.data();
    const name: string = data['name'] ?? '';
    const existing: string = data['categoryId'] ?? 'general';
    const existingSpecs: Record<string, string> = data['specs'] ?? {};

    // Obtener URL de la primera entry para tener el path
    const entrySnap = await db
      .collection('products').doc(productDoc.id)
      .collection('entries')
      .limit(1)
      .get();
    const entryUrl: string = entrySnap.docs[0]?.data()['url'] ?? '';

    const newCat = inferCategory(name, entryUrl);
    // La categoría efectiva para extraer specs: preferir la nueva si es concreta,
    // de lo contrario usar la existente
    const effectiveCat = (newCat !== 'general') ? newCat : existing;
    const newSpecs = extractSpecs(name, effectiveCat);
    const mergedSpecs = { ...existingSpecs, ...newSpecs };

    const catChanged  = newCat !== 'general' && newCat !== existing;
    const specsChanged = JSON.stringify(mergedSpecs) !== JSON.stringify(existingSpecs);

    if (catChanged || specsChanged) {
      const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
      if (catChanged)   { updates['categoryId'] = newCat;    changed++; }
      if (specsChanged) { updates['specs'] = mergedSpecs; specsUpdated++; }
      await productDoc.ref.update(updates);
      if (catChanged) console.log(`  [CAT] ${productDoc.id}: ${existing} → ${newCat}`);
    } else {
      skipped++;
    }
  }

  console.log(`\nProductos re-categorizados: ${changed} | Specs actualizadas: ${specsUpdated} | Sin cambios: ${skipped}`);
}

async function fixDuplicateSlugs(dryRun = false) {
  console.log(`=== CORRIGIENDO SLUGS DUPLICADOS${dryRun ? ' (DRY-RUN)' : ''} ===`);
  const productsSnap = await db.collection('products').get();

  // Fase 1: identificar qué productos necesitan fix (sin lecturas extra)
  const toFix: Array<{ docId: string; correctSlug: string; name: string }> = [];
  for (const doc of productsSnap.docs) {
    const name: string = doc.data()['name'] ?? '';
    const correctSlug = slugify(normalizeProductName(name));
    if (correctSlug && correctSlug !== doc.id && correctSlug.length >= 5) {
      toFix.push({ docId: doc.id, correctSlug, name });
    }
  }

  console.log(`Productos a corregir: ${toFix.length} / ${productsSnap.size}`);
  toFix.forEach(({ docId, correctSlug }) =>
    console.log(`  "${docId}" → "${correctSlug}"`)
  );

  if (dryRun || toFix.length === 0) {
    if (toFix.length === 0) console.log('  Nada que corregir.');
    return;
  }

  let fixed = 0;
  let merged = 0;

  // Fase 2: corregir cada uno con delay para no agotar quota
  for (const { docId, correctSlug } of toFix) {
    console.log(`\n  [FIX] "${docId}" → "${correctSlug}"`);
    await sleep(300); // throttle

    const sourceRef = db.collection('products').doc(docId);
    const targetRef = db.collection('products').doc(correctSlug);
    const [sourceSnap, targetSnap, oldEntriesSnap] = await Promise.all([
      sourceRef.get(),
      targetRef.get(),
      sourceRef.collection('entries').get(),
    ]);
    if (!sourceSnap.exists) { console.log(`    → (ya eliminado, skip)`); continue; }

    const sourceData = sourceSnap.data()!;

    // Copiar entries al doc destino
    for (const entry of oldEntriesSnap.docs) {
      await targetRef.collection('entries').doc(entry.id).set({
        ...entry.data(),
        productId: correctSlug,
      });
      await sleep(50);
    }

    if (targetSnap.exists) {
      // Merge: recalcular precios/storeCount del destino
      const allActive = await targetRef.collection('entries')
        .where('isActive', '==', true).get();
      if (!allActive.empty) {
        const prices = allActive.docs.map(d => d.data()['price'] as number);
        const storeCount = new Set(allActive.docs.map(d => d.data()['storeId'])).size;
        await targetRef.update({ minPrice: Math.min(...prices), maxPrice: Math.max(...prices), storeCount, updatedAt: Timestamp.now() });
      }
      merged++;
    } else {
      // Rename: crear nuevo doc con datos del original
      await targetRef.set({ ...sourceData, updatedAt: Timestamp.now() });
      fixed++;
    }

    // Eliminar entries y doc viejo
    for (const entry of oldEntriesSnap.docs) {
      await entry.ref.delete();
      await sleep(50);
    }
    await sourceRef.delete();
  }

  console.log(`\nProductos renombrados: ${fixed} | Mergeados: ${merged}`);
}

async function main() {
  const doClean        = process.argv.includes('--clean');
  const doRecategorize = process.argv.includes('--recategorize');
  const doFixDupes     = process.argv.includes('--fix-dupes');
  const doExport       = process.argv.includes('--export');
  const dryRun         = process.argv.includes('--dry-run');
  const verbose        = process.argv.includes('--verbose');

  if (doClean) {
    await cleanSeedEntries();
    console.log('\n--- diagnóstico post-cleanup ---');
  }
  if (doFixDupes) {
    await fixDuplicateSlugs(dryRun);
    console.log('\n--- diagnóstico post-fix-dupes ---');
  }
  if (doRecategorize) {
    await recategorize();
    console.log('\n--- diagnóstico post-recategorización ---');
  }
  if (doExport) {
    // Exporta catalog.json a src/assets/data/ sin diagnóstico extra.
    await exportCatalog(db);
    process.exit(0);
  }
  // diagnose() básico solo lee 'products' (396 reads).
  // Con --verbose también lee collectionGroup('entries') para desglose por tienda.
  await diagnose(verbose);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

