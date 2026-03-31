import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const sa = require('./dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json');
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

// Tiendas que no tienen scraper activo — sus entries son basura del seed
const DEAD_STORE_IDS = [
  'impresalta', 'ahi3d', 'formageo', '3dstore', 'deskfab',
  'tresd', 'todotorner', 'makershop', 'filamento', 'filamentosmaxi',
  'impakt', 'mercadolibre',
];

async function main() {
  console.log('=== LIMPIANDO ENTRIES DE TIENDAS MUERTAS ===');

  // 1. Marcar tiendas muertas como isActive: false en Firestore
  for (const storeId of DEAD_STORE_IDS) {
    await db.collection('stores').doc(storeId).set({ isActive: false }, { merge: true });
    console.log(`  [stores] ${storeId} → isActive: false`);
  }

  // 2. Buscar y borrar entries de tiendas muertas, recalcular producto afectados
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
      if (DEAD_STORE_IDS.includes(storeId)) {
        await entryDoc.ref.delete();
        deletedEntries++;
        affectedProducts.add(productDoc.id);
      }
    }
  }

  console.log(`\nEntries borradas: ${deletedEntries}`);
  console.log(`Productos afectados: ${affectedProducts.size}`);

  // 3. Recalcular minPrice / maxPrice / storeCount para productos afectados
  console.log('\nRecalculando productos...');
  let updated = 0;
  let deleted = 0;

  for (const productId of affectedProducts) {
    const entriesSnap = await db
      .collection('products').doc(productId)
      .collection('entries')
      .where('isActive', '==', true)
      .get();

    if (entriesSnap.empty) {
      // Sin entries activas → borrar el producto (era solo del seed)
      await db.collection('products').doc(productId).delete();
      deleted++;
      console.log(`  [DELETE] ${productId}`);
    } else {
      const prices = entriesSnap.docs.map(d => d.data()['price'] as number);
      const storeCount = new Set(entriesSnap.docs.map(d => d.data()['storeId'])).size;
      await db.collection('products').doc(productId).update({
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        storeCount,
        updatedAt: Timestamp.now(),
      });
      updated++;
    }
  }

  console.log(`\nProductos actualizados: ${updated} | Productos borrados: ${deleted}`);

  const total = await db.collection('products').count().get();
  console.log('Total productos restantes en BD:', total.data().count);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
