/**
 * scripts/seed-firestore.ts
 *
 * Puebla Firestore con datos de muestra realistas para 3DPrecios.
 * Uso: npx ts-node --esm scripts/seed-firestore.ts
 *
 * Requiere: FIREBASE_SERVICE_ACCOUNT (path al JSON de cuenta de servicio)
 *   o GOOGLE_APPLICATION_CREDENTIALS apuntando al mismo archivo.
 *
 * Ejemplo:
 *   set FIREBASE_SERVICE_ACCOUNT=C:\path\to\serviceAccount.json
 *   npx ts-node scripts/seed-firestore.ts
 */

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Inicialización ────────────────────────────────────────────────────────

const saPath = process.env['FIREBASE_SERVICE_ACCOUNT'];
if (!saPath) {
  console.error('ERROR: Define la variable FIREBASE_SERVICE_ACCOUNT con la ruta al JSON de cuenta de servicio.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(resolve(saPath), 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const now = admin.firestore.Timestamp.now;

// ── Datos de tiendas ──────────────────────────────────────────────────────

const STORES = [
  { id: 'impresalta',     name: 'Impresalta',       slug: 'impresalta',     url: 'https://impresalta.cl',         logo: 'https://impresalta.cl/favicon.ico',         country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'formageo',       name: 'Formageo',          slug: 'formageo',       url: 'https://formageo.cl',           logo: 'https://formageo.cl/favicon.ico',           country: 'CL', isActive: true, shippingInfo: 'Retiro en tienda / despacho' },
  { id: 'tresd',          name: '3D Chile',          slug: 'tresd',          url: 'https://3d.cl',                 logo: 'https://3d.cl/favicon.ico',                 country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'ahi3d',          name: 'AHI 3D',            slug: 'ahi3d',          url: 'https://ahi3d.cl',              logo: 'https://ahi3d.cl/favicon.ico',              country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'filamento',      name: 'Filamento.cl',      slug: 'filamento',      url: 'https://filamento.cl',          logo: 'https://filamento.cl/favicon.ico',          country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: '3dstore',        name: '3D Store Chile',    slug: '3dstore',        url: 'https://3dstore.cl',            logo: 'https://3dstore.cl/favicon.ico',            country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'makershop',      name: 'MakerShop',         slug: 'makershop',      url: 'https://makershop.cl',          logo: 'https://makershop.cl/favicon.ico',          country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'imperio3d',      name: 'Imperio 3D',        slug: 'imperio3d',      url: 'https://imperio3d.com',         logo: 'https://imperio3d.com/favicon.ico',         country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'impakt',         name: 'Impakt',            slug: 'impakt',         url: 'https://www.impakt.cl',         logo: 'https://www.impakt.cl/favicon.ico',         country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'todotorner',     name: 'Todo Torner',       slug: 'todotorner',     url: 'https://todotorner.cl',         logo: 'https://todotorner.cl/favicon.ico',         country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'deskfab',        name: 'DeskFab',           slug: 'deskfab',        url: 'https://deskfab.cl',            logo: 'https://deskfab.cl/favicon.ico',            country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'filamentosmaxi', name: 'Filamentos Maxi',   slug: 'filamentosmaxi', url: 'https://filamentosmaxi.cl',     logo: 'https://filamentosmaxi.cl/favicon.ico',     country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'falabella',      name: 'Falabella',         slug: 'falabella',      url: 'https://www.falabella.com',     logo: 'https://www.falabella.com/favicon.ico',     country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'sodimac',        name: 'Sodimac',           slug: 'sodimac',        url: 'https://www.sodimac.cl',        logo: 'https://www.sodimac.cl/favicon.ico',        country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'paris',          name: 'Paris',             slug: 'paris',          url: 'https://www.paris.cl',          logo: 'https://www.paris.cl/favicon.ico',          country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
  { id: 'ripley',         name: 'Ripley',            slug: 'ripley',         url: 'https://simple.ripley.cl',      logo: 'https://simple.ripley.cl/favicon.ico',      country: 'CL', isActive: true, shippingInfo: 'Despacho a todo Chile' },
];

// ── Productos de muestra ──────────────────────────────────────────────────
// categoryId == slug de categoría (tal como lo guarda el scraper)

interface SeedProduct {
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  images: string[];
  specs: Record<string, string | number>;
  entries: Array<{ storeId: string; price: number; url: string; stock: 'available' | 'low' | 'out' }>;
}

const PRODUCTS: SeedProduct[] = [
  // ── Filamentos PLA ────────────────────────────────────────────────────
  {
    slug: 'bambu-lab-pla-basic-blanco-1kg',
    name: 'Bambu Lab PLA Basic Blanco 1kg',
    brand: 'Bambu Lab',
    categoryId: 'filamentos-pla',
    description: 'Filamento PLA de alta calidad compatible con cualquier impresora FDM. Excelente adherencia entre capas y mínimo warping.',
    images: [],
    specs: { color: 'Blanco', diametro: '1.75', peso: '1000', temperatura: '180-220°C' },
    entries: [
      { storeId: 'impresalta',  price: 14990, url: 'https://impresalta.cl/bambu-pla-basic-blanco', stock: 'available' },
      { storeId: 'filamento',   price: 15990, url: 'https://filamento.cl/bambu-pla-basic-blanco',  stock: 'available' },
      { storeId: 'makershop',   price: 16490, url: 'https://makershop.cl/bambu-pla-basic-blanco',  stock: 'low' },
    ],
  },
  {
    slug: 'esun-pla-plus-blanco-1kg',
    name: 'eSUN PLA+ Blanco 1kg',
    brand: 'eSUN',
    categoryId: 'filamentos-pla',
    description: 'PLA+ con mayor resistencia al impacto y menor fragilidad que el PLA estándar. Ideal para piezas funcionales.',
    images: [],
    specs: { color: 'Blanco', diametro: '1.75', peso: '1000', temperatura: '200-230°C' },
    entries: [
      { storeId: 'impresalta',  price: 11990, url: 'https://impresalta.cl/esun-pla-plus-blanco', stock: 'available' },
      { storeId: '3dstore',     price: 12490, url: 'https://3dstore.cl/esun-pla-plus-blanco',    stock: 'available' },
    ],
  },
  {
    slug: 'polymaker-polylite-pla-negro-1kg',
    name: 'Polymaker PolyLite PLA Negro 1kg',
    brand: 'Polymaker',
    categoryId: 'filamentos-pla',
    description: 'PLA de alta pureza con bajo encogimiento. Fórmula Warp-Free para impresión sin deformaciones.',
    images: [],
    specs: { color: 'Negro', diametro: '1.75', peso: '1000', temperatura: '190-230°C' },
    entries: [
      { storeId: 'formageo',    price: 13990, url: 'https://formageo.cl/polymaker-polylite-negro', stock: 'available' },
      { storeId: 'ahi3d',       price: 14490, url: 'https://ahi3d.cl/polymaker-polylite-negro',    stock: 'available' },
      { storeId: 'filamentosmaxi', price: 13490, url: 'https://filamentosmaxi.cl/polymaker-polylite-negro', stock: 'low' },
    ],
  },

  // ── Filamentos PETG ────────────────────────────────────────────────────
  {
    slug: 'overture-petg-transparente-1kg',
    name: 'Overture PETG Transparente 1kg',
    brand: 'Overture',
    categoryId: 'filamentos-petg',
    description: 'PETG con excelente resistencia química y a la humedad. Ideal para contenedores y piezas mecánicas.',
    images: [],
    specs: { color: 'Transparente', diametro: '1.75', peso: '1000', temperatura: '220-250°C' },
    entries: [
      { storeId: 'impresalta',  price: 9990,  url: 'https://impresalta.cl/overture-petg-transparente', stock: 'available' },
      { storeId: 'tresd',       price: 10490, url: 'https://3d.cl/overture-petg-transparente',         stock: 'available' },
    ],
  },
  {
    slug: 'bambu-lab-petg-basic-negro-1kg',
    name: 'Bambu Lab PETG Basic Negro 1kg',
    brand: 'Bambu Lab',
    categoryId: 'filamentos-petg',
    description: 'PETG de Bambu Lab con alta resistencia UV y al impacto. Compatible con AMS.',
    images: [],
    specs: { color: 'Negro', diametro: '1.75', peso: '1000', temperatura: '230-250°C' },
    entries: [
      { storeId: 'filamento',   price: 15490, url: 'https://filamento.cl/bambu-petg-negro',  stock: 'available' },
      { storeId: 'makershop',   price: 16990, url: 'https://makershop.cl/bambu-petg-negro',  stock: 'available' },
      { storeId: 'deskfab',     price: 15990, url: 'https://deskfab.cl/bambu-petg-negro',    stock: 'low' },
    ],
  },

  // ── Filamentos ABS ────────────────────────────────────────────────────
  {
    slug: 'esun-abs-plus-negro-1kg',
    name: 'eSUN ABS+ Negro 1kg',
    brand: 'eSUN',
    categoryId: 'filamentos-abs',
    description: 'ABS mejorado con menor warping y olor reducido respecto al ABS convencional.',
    images: [],
    specs: { color: 'Negro', diametro: '1.75', peso: '1000', temperatura: '230-260°C' },
    entries: [
      { storeId: 'impresalta',  price: 12490, url: 'https://impresalta.cl/esun-abs-plus-negro', stock: 'available' },
      { storeId: 'formageo',    price: 13490, url: 'https://formageo.cl/esun-abs-plus-negro',   stock: 'available' },
    ],
  },

  // ── Impresoras FDM ────────────────────────────────────────────────────
  {
    slug: 'bambu-lab-a1-mini',
    name: 'Bambu Lab A1 Mini',
    brand: 'Bambu Lab',
    categoryId: 'impresoras-fdm',
    description: 'Impresora FDM multi-material de escritorio. Velocidad de hasta 500 mm/s, auto-calibración y soporte AMS Lite.',
    images: [],
    specs: { velocidad: '500mm/s', volumen: '180x180x180mm', tipo: 'cartesiana', multicolor: 'Sí' },
    entries: [
      { storeId: 'impakt',      price: 449990, url: 'https://www.impakt.cl/bambu-a1-mini',    stock: 'available' },
      { storeId: 'todotorner',  price: 469990, url: 'https://todotorner.cl/bambu-a1-mini',    stock: 'available' },
      { storeId: 'falabella',   price: 489990, url: 'https://falabella.com/bambu-a1-mini',    stock: 'available' },
    ],
  },
  {
    slug: 'creality-ender-3-v3-se',
    name: 'Creality Ender-3 V3 SE',
    brand: 'Creality',
    categoryId: 'impresoras-fdm',
    description: 'Impresora FDM de entrada con nivelación automática CR Touch, pantalla táctil y estructura mejorada.',
    images: [],
    specs: { velocidad: '250mm/s', volumen: '220x220x250mm', tipo: 'cartesiana', nivelacion: 'Automática' },
    entries: [
      { storeId: 'impresalta',  price: 169990, url: 'https://impresalta.cl/creality-ender3-v3-se', stock: 'available' },
      { storeId: 'tresd',       price: 174990, url: 'https://3d.cl/creality-ender3-v3-se',         stock: 'available' },
      { storeId: 'sodimac',     price: 179990, url: 'https://sodimac.cl/creality-ender3-v3-se',     stock: 'low' },
      { storeId: 'paris',       price: 183990, url: 'https://paris.cl/creality-ender3-v3-se',       stock: 'available' },
    ],
  },
  {
    slug: 'bambu-lab-p1s',
    name: 'Bambu Lab P1S',
    brand: 'Bambu Lab',
    categoryId: 'impresoras-fdm',
    description: 'Impresora FDM cerrada de alta velocidad con cámara integrada, filtro HEPA y soporte AMS.',
    images: [],
    specs: { velocidad: '500mm/s', volumen: '256x256x256mm', tipo: 'CoreXY', material: 'Todo tipo' },
    entries: [
      { storeId: 'impakt',      price: 1099990, url: 'https://www.impakt.cl/bambu-p1s',    stock: 'available' },
      { storeId: 'ripley',      price: 1149990, url: 'https://simple.ripley.cl/bambu-p1s', stock: 'low' },
    ],
  },

  // ── Impresoras Resina ────────────────────────────────────────────────
  {
    slug: 'elegoo-saturn-4-ultra-12k',
    name: 'Elegoo Saturn 4 Ultra 12K',
    brand: 'Elegoo',
    categoryId: 'impresoras-resina',
    description: 'Impresora de resina MSLA 12K con pantalla LCD monocromática de gran formato y sistema de inclinación inteligente.',
    images: [],
    specs: { resolucion: '12K', pantalla: '10.1"', velocidad: '150mm/h', volumen: '218x123x220mm' },
    entries: [
      { storeId: 'impresalta',  price: 399990, url: 'https://impresalta.cl/elegoo-saturn4-ultra', stock: 'available' },
      { storeId: 'ahi3d',       price: 419990, url: 'https://ahi3d.cl/elegoo-saturn4-ultra',      stock: 'available' },
      { storeId: 'falabella',   price: 439990, url: 'https://falabella.com/elegoo-saturn4-ultra',  stock: 'out' },
    ],
  },
  {
    slug: 'anycubic-photon-mono-m5s',
    name: 'Anycubic Photon Mono M5s',
    brand: 'Anycubic',
    categoryId: 'impresoras-resina',
    description: 'Impresora de resina con pantalla 12K, nivelación inteligente y una velocidad de impresión de 100mm/h.',
    images: [],
    specs: { resolucion: '12K', pantalla: '10.1"', velocidad: '100mm/h', volumen: '218x123x200mm' },
    entries: [
      { storeId: 'makershop',   price: 349990, url: 'https://makershop.cl/anycubic-m5s',  stock: 'available' },
      { storeId: 'deskfab',     price: 359990, url: 'https://deskfab.cl/anycubic-m5s',    stock: 'available' },
    ],
  },

  // ── Resinas ───────────────────────────────────────────────────────────
  {
    slug: 'elegoo-standard-resina-gris-1kg',
    name: 'Elegoo Standard Resina Gris 1kg',
    brand: 'Elegoo',
    categoryId: 'resinas',
    description: 'Resina estándar para impresoras MSLA/DLP. Alta definición de detalles y bajo olor.',
    images: [],
    specs: { color: 'Gris', volumen: '1000', tipo: 'Standard' },
    entries: [
      { storeId: 'impresalta',  price: 18990, url: 'https://impresalta.cl/elegoo-resina-gris-1kg', stock: 'available' },
      { storeId: 'ahi3d',       price: 19490, url: 'https://ahi3d.cl/elegoo-resina-gris-1kg',      stock: 'available' },
      { storeId: 'formageo',    price: 19990, url: 'https://formageo.cl/elegoo-resina-gris-1kg',   stock: 'low' },
    ],
  },

  // ── Repuestos ─────────────────────────────────────────────────────────
  {
    slug: 'nozzle-hardened-steel-0-4mm-bambu',
    name: 'Nozzle Hardened Steel 0.4mm Bambu Lab',
    brand: 'Bambu Lab',
    categoryId: 'repuestos',
    description: 'Nozzle de acero endurecido 0.4mm para impresoras Bambu Lab. Compatible con filamentos abrasivos.',
    images: [],
    specs: { diametro: '0.4mm', material: 'Acero endurecido', compatible: 'Bambu Lab X/P/A Series' },
    entries: [
      { storeId: 'impakt',      price: 14990, url: 'https://www.impakt.cl/nozzle-bambu-hardened-04', stock: 'available' },
      { storeId: 'deskfab',     price: 15990, url: 'https://deskfab.cl/nozzle-bambu-hardened-04',    stock: 'available' },
    ],
  },
];

// ── Función principal ─────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('🌱 Iniciando seed de Firestore...\n');

  // 1. Tiendas
  console.log(`📦 Seeding ${STORES.length} tiendas...`);
  const storeBatch = db.batch();
  for (const store of STORES) {
    storeBatch.set(db.collection('stores').doc(store.id), {
      ...store,
      lastScraped: now(),
    }, { merge: true });
  }
  await storeBatch.commit();
  console.log('   ✅ Tiendas listas\n');

  // 2. Productos con sus entradas
  console.log(`📦 Seeding ${PRODUCTS.length} productos...`);
  for (const p of PRODUCTS) {
    const { entries, ...productData } = p;
    const prices = entries.map((e) => e.price);

    // Documento del producto
    await db.collection('products').doc(p.slug).set({
      id:          p.slug,
      slug:        p.slug,
      name:        p.name,
      brand:       p.brand,
      categoryId:  p.categoryId,
      description: p.description,
      images:      p.images,
      specs:       p.specs,
      minPrice:    Math.min(...prices),
      maxPrice:    Math.max(...prices),
      storeCount:  entries.length,
      createdAt:   now(),
      updatedAt:   now(),
    }, { merge: true });

    // Subcollección entries
    for (const entry of entries) {
      const entryId = `${entry.storeId}_${p.slug}`;
      await db.collection('products').doc(p.slug).collection('entries').doc(entryId).set({
        id:          entryId,
        productId:   p.slug,
        storeId:     entry.storeId,
        url:         entry.url,
        price:       entry.price,
        currency:    'CLP',
        stock:       entry.stock,
        lastChecked: now(),
        isActive:    true,
      }, { merge: true });
    }

    // Historial de precios inicial (entrada única con precio actual)
    for (const entry of entries) {
      await db.collection('products').doc(p.slug).collection('history').add({
        productId:  p.slug,
        storeId:    entry.storeId,
        price:      entry.price,
        recordedAt: now(),
      });
    }

    console.log(`   ✅ ${p.name}`);
  }

  console.log('\n🎉 Seed completado exitosamente.');
  console.log('   Puedes verificar los datos en: https://console.firebase.google.com/project/dprecios/firestore');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error durante el seed:', err);
  process.exit(1);
});
