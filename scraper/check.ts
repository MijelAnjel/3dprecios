import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { inferCategory } from './src/utils';

const sa = require('./dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json');
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

// Tiendas cuyas entries son basura del seed (scraper nunca corrió)
const SEED_ONLY_STORES = ['falabella', 'ripley', 'paris', 'sodimac', 'lider', 'easy'];

async function diagnose() {
  const entriesSnap = await db.collectionGroup('entries').get();
  const byStore: Record<string, Set<string>> = {};
  const urlSamples: Record<string, string> = {};
  entriesSnap.docs.forEach(d => {
    const data = d.data();
    const storeId = data['storeId'];
    if (!byStore[storeId]) byStore[storeId] = new Set();
    byStore[storeId].add(data['productId']);
    if (!urlSamples[storeId]) urlSamples[storeId] = data['url'] ?? '';
  });

  console.log('=== PRODUCTOS POR TIENDA ===');
  Object.entries(byStore)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([store, products]) => {
      console.log(`  ${store}: ${products.size} productos | URL ejemplo: ${urlSamples[store]?.substring(0, 80)}`);
    });

  const productsSnap = await db.collection('products').get();
  const catCount: Record<string, number> = {};
  const noEntryProducts: string[] = [];

  for (const productDoc of productsSnap.docs) {
    const cat = productDoc.data()['categoryId'] ?? 'undefined';
    catCount[cat] = (catCount[cat] ?? 0) + 1;

    // Check if product has no active entries
    const activeEntries = await db
      .collection('products').doc(productDoc.id)
      .collection('entries')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (activeEntries.empty) noEntryProducts.push(productDoc.id);
  }
  console.log('\n=== PRODUCTOS POR CATEGORÍA ===');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\n=== PRODUCTOS SIN ENTRIES ACTIVAS ===');
  if (noEntryProducts.length === 0) {
    console.log('  Ninguno (todo limpio)');
  } else {
    noEntryProducts.forEach(id => console.log(`  ${id}`));
  }

  console.log('\nTotal productos:', productsSnap.size);
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
  console.log('=== RE-CATEGORIZANDO PRODUCTOS CON inferCategory ACTUALIZADO ===');
  const productsSnap = await db.collection('products').get();
  let changed = 0;
  let skipped = 0;

  for (const productDoc of productsSnap.docs) {
    const data      = productDoc.data();
    const name: string = data['name'] ?? '';
    const existing: string = data['categoryId'] ?? 'general';

    // Obtener URL de la primera entry para tener el path
    const entrySnap = await db
      .collection('products').doc(productDoc.id)
      .collection('entries')
      .limit(1)
      .get();
    const entryUrl: string = entrySnap.docs[0]?.data()['url'] ?? '';

    const newCat = inferCategory(name, entryUrl);

    if (newCat !== 'general' && newCat !== existing) {
      await productDoc.ref.update({ categoryId: newCat, updatedAt: Timestamp.now() });
      console.log(`  [FIX] ${productDoc.id}: ${existing} → ${newCat}`);
      changed++;
    } else {
      skipped++;
    }
  }

  console.log(`\nProductos re-categorizados: ${changed} | Sin cambios: ${skipped}`);
}

async function main() {
  const doClean       = process.argv.includes('--clean');
  const doRecategorize = process.argv.includes('--recategorize');

  if (doClean) {
    await cleanSeedEntries();
    console.log('\n--- diagnóstico post-cleanup ---');
  }
  if (doRecategorize) {
    await recategorize();
    console.log('\n--- diagnóstico post-recategorización ---');
  }
  await diagnose();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

