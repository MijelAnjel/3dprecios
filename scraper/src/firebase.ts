import {
  Firestore,
  Timestamp,
  FieldValue,
  WriteBatch,
} from 'firebase-admin/firestore';
import { ScraperResult, STORES } from './models';
import { slugify, normalizeProductName } from './utils';

// ─────────────────────────────────────────────────────────────
// Firebase upsert — productos, entradas e historial de precios
// ─────────────────────────────────────────────────────────────

/**
 * Persiste los resultados de scraping en Firestore.
 * Estrategia:
 *  1. Para cada resultado busca si existe un producto con ese slug
 *  2. Si no existe, lo crea (producto canónico mínimo)
 *  3. Upsert de la ProductEntry (entrada por tienda)
 *  4. Si el precio cambió → agrega punto de PriceHistory
 *  5. Actualiza minPrice/maxPrice/storeCount del producto
 */
export async function saveResults(
  db: Firestore,
  results: ScraperResult[],
): Promise<void> {
  if (results.length === 0) return;

  console.log(`[Firebase] Procesando ${results.length} resultados...`);

  let upserted = 0;
  let priceChanges = 0;

  for (const result of results) {
    try {
      // Normalizar nombre antes de slugificar para mejorar matching entre tiendas.
      // Ej: "Filamento PLA 1Kg - Blanco (Pack 2)" y "Filamento PLA 1KG Blanco"
      // apuntan al mismo producto → mismo slug → se comparten en la comparativa.
      const normalizedName = normalizeProductName(result.productName);
      const productSlug = slugify(normalizedName);
      const productRef  = db.collection('products').doc(productSlug);
      const productSnap = await productRef.get();

      // Limpiar nombre duplicado (algunos WooCommerce repiten el texto)
      const rawName = result.productName;
      const halfLen = Math.ceil(rawName.length / 2);
      const cleanName = rawName.length > 10 && rawName.slice(0, halfLen) === rawName.slice(halfLen)
        ? rawName.slice(0, halfLen).trim()
        : rawName;

      const validImageUrl = result.imageUrl && !result.imageUrl.startsWith('data:') ? result.imageUrl : null;
      const newCategory   = result.categorySlug ?? 'general';

      // ── 1. Crear producto si no existe ──────────────────────────
      if (!productSnap.exists) {
        await productRef.set({
          id:          productSlug,
          slug:        productSlug,
          name:        cleanName,
          brand:       result.brand ?? '',
          categoryId:  newCategory,
          description: '',
          images:      validImageUrl ? [validImageUrl] : [],
          specs:       result.specs ?? {},
          minPrice:    result.price,
          maxPrice:    result.price,
          storeCount:  1,
          createdAt:   Timestamp.now(),
          updatedAt:   Timestamp.now(),
        });
      } else {
        // Actualizar categoría si la nueva clasificación es más específica que la existente.
        // "general" siempre se sobreescribe. Categorías equivocadas (ej. filamento en impresoras)
        // se corrigen en cada re-scrape gracias al inferCategory mejorado.
        const existingCategory: string  = productSnap.data()?.['categoryId'] ?? 'general';
        const existingImages: string[]  = productSnap.data()?.['images'] ?? [];
        const hasValidImage = existingImages.some(img => !img.startsWith('data:') && img.length > 0);

        const updates: Record<string, unknown> = {};
        // Actualizar si: tenemos categoría concreta Y es distinta a la actual
        if (newCategory !== 'general' && newCategory !== existingCategory) updates['categoryId'] = newCategory;
        if (!hasValidImage && validImageUrl) updates['images'] = [validImageUrl];
        if (Object.keys(updates).length > 0) await productRef.update(updates);
      }

      // ── 2. Upsert ProductEntry ──────────────────────────────────
      const entryId  = `${result.storeId}_${productSlug}`;
      const entryRef = productRef.collection('entries').doc(entryId);
      const entrySnap = await entryRef.get();
      const prevPrice: number = entrySnap.exists ? (entrySnap.data()?.['price'] ?? 0) : 0;

      await entryRef.set({
        id:          entryId,
        productId:   productSlug,
        storeId:     result.storeId,
        url:         result.productUrl,
        price:       result.price,
        currency:    'CLP',
        stock:       result.stock,
        sku:         result.sku ?? null,
        lastChecked: Timestamp.fromDate(result.scrapedAt),
        isActive:    true,
      }, { merge: true });

      // ── 3. Registrar historial si el precio cambió ───────────────
      if (prevPrice !== result.price) {
        priceChanges++;
        const historyRef = productRef.collection('history').doc();
        await historyRef.set({
          productId:  productSlug,
          storeId:    result.storeId,
          price:      result.price,
          recordedAt: Timestamp.fromDate(result.scrapedAt),
        });
      }

      // ── 4. Recalcular minPrice / maxPrice / storeCount ───────────
      await recalcProduct(db, productSlug);

      upserted++;
    } catch (err) {
      console.error(`[Firebase] Error al guardar "${result.productName}":`, err);
    }
  }

  console.log(`[Firebase] Upserted: ${upserted} | Cambios de precio: ${priceChanges}`);
}

async function recalcProduct(db: Firestore, productSlug: string): Promise<void> {
  const entriesSnap = await db
    .collection('products').doc(productSlug)
    .collection('entries')
    .where('isActive', '==', true)
    .get();

  if (entriesSnap.empty) return;

  const prices     = entriesSnap.docs.map(d => d.data()['price'] as number);
  const minPrice   = Math.min(...prices);
  const maxPrice   = Math.max(...prices);
  const storeCount = new Set(entriesSnap.docs.map(d => d.data()['storeId'])).size;

  await db.collection('products').doc(productSlug).update({
    minPrice,
    maxPrice,
    storeCount,
    updatedAt: Timestamp.now(),
  });
}

// ─────────────────────────────────────────────────────────────
// Store upsert — sincroniza la colección /stores
// ─────────────────────────────────────────────────────────────

export async function syncStores(db: Firestore): Promise<void> {
  console.log('[Firebase] Sincronizando tiendas...');
  const batch = db.batch();

  for (const store of STORES) {
    const ref = db.collection('stores').doc(store.id);
    batch.set(ref, {
      id:          store.id,
      name:        store.name,
      slug:        store.slug,
      url:         store.baseUrl,
      logo:        store.logo,
      country:     'CL',
      isActive:    store.isActive,
      lastScraped: Timestamp.now(),
    }, { merge: true });
  }

  await batch.commit();
  console.log('[Firebase] Tiendas sincronizadas.');
}

// ─────────────────────────────────────────────────────────────
// Alert trigger — envía email si precio <= targetPrice
// ─────────────────────────────────────────────────────────────

interface PriceAlert {
  id: string;
  email: string;
  productId: string;
  targetPrice: number;
  isActive: boolean;
}

export async function checkPriceAlerts(
  db: Firestore,
  changedProductIds: string[],
): Promise<void> {
  if (changedProductIds.length === 0) return;

  console.log(`[Alertas] Verificando alertas para ${changedProductIds.length} productos...`);

  const resendApiKey = process.env['RESEND_API_KEY'];

  for (const productId of changedProductIds) {
    const [alertsSnap, productSnap] = await Promise.all([
      db.collectionGroup('alerts')
        .where('productId', '==', productId)
        .where('isActive', '==', true)
        .get(),
      db.collection('products').doc(productId).get(),
    ]);

    if (alertsSnap.empty || !productSnap.exists) continue;

    const product  = productSnap.data()!;
    const minPrice = product['minPrice'] as number;

    for (const alertDoc of alertsSnap.docs) {
      const alert = alertDoc.data() as PriceAlert;

      if (minPrice <= alert.targetPrice) {
        console.log(`[Alertas] 🔔 ${alert.email} — ${product['name']} bajó a $${minPrice.toLocaleString('es-CL')} (objetivo: $${alert.targetPrice.toLocaleString('es-CL')})`);

        if (resendApiKey) {
          await sendAlertEmail(resendApiKey, alert, product['name'] as string, minPrice);
        }

        // Desactivar la alerta para no reenviar
        await alertDoc.ref.update({ isActive: false });
      }
    }
  }
}

async function sendAlertEmail(
  apiKey: string,
  alert: PriceAlert,
  productName: string,
  currentPrice: number,
): Promise<void> {
  try {
    const body = {
      from:    'alertas@3dprecios.cl',
      to:      [alert.email],
      subject: `🎉 Bajó de precio: ${productName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">¡Tu alerta de precio se activó!</h2>
          <p><strong>${productName}</strong> ahora está en:</p>
          <p style="font-size: 2rem; font-weight: 800; color: #00D4AA;">
            $${currentPrice.toLocaleString('es-CL')}
          </p>
          <p>Tu precio objetivo era: $${alert.targetPrice.toLocaleString('es-CL')}</p>
          <a
            href="https://3dprecios.cl/productos/${alert.productId}"
            style="display:inline-block; padding: 0.75rem 1.5rem; background: #FF6B35; color: white; text-decoration: none; border-radius: 8px; font-weight: 700;"
          >
            Ver producto →
          </a>
          <p style="color: #888; font-size: 0.875rem; margin-top: 2rem;">
            Esta alerta se ha desactivado. Puedes crear una nueva en 3DPrecios.cl
          </p>
        </div>
      `,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Resend] Error al enviar email:', response.status, text);
    } else {
      console.log(`[Resend] Email enviado a ${alert.email}`);
    }
  } catch (err) {
    console.error('[Resend] Error de red:', err);
  }
}
