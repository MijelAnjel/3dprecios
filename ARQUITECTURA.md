# 3DPrecios — Documentación Técnica

> Comparador de precios de productos de impresión 3D en Chile.
> Sitio live: **https://3dprecios.cl** · Repo: **https://github.com/MijelAnjel/3dprecios**

---

## Índice

1. [Visión general](#1-visión-general)
2. [Zero-Cost Architecture](#2-zero-cost-architecture)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura de carpetas](#4-estructura-de-carpetas)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Pipeline de scraping](#6-pipeline-de-scraping)
7. [Cómo añadir una tienda nueva](#7-cómo-añadir-una-tienda-nueva)
8. [Sistema de categorías e inferencia](#8-sistema-de-categorías-e-inferencia)
9. [Matching de productos entre tiendas](#9-matching-de-productos-entre-tiendas)
10. [Frontend Angular](#10-frontend-angular)
11. [CI/CD y Deploys](#11-cicd-y-deploys)
12. [Comandos de diagnóstico y mantención](#12-comandos-de-diagnóstico-y-mantención)
13. [Problemas conocidos y soluciones aplicadas](#13-problemas-conocidos-y-soluciones-aplicadas)
14. [Tiendas activas y método de scraping](#14-tiendas-activas-y-método-de-scraping)
15. [Pendientes y roadmap](#15-pendientes-y-roadmap)

---

## 1. Visión general

**3DPrecios** automatiza la comparación de precios de productos de impresión 3D vendidos en tiendas chilenas. El sistema:

1. El **scraper local** (`run-direct.ts`) se ejecuta desde PowerShell y visita cada tienda activa
2. Los productos y precios se guardan directamente en **`catalog.json`** — sin base de datos intermedia
3. `catalog.json` se despliega en Firebase Hosting CDN y se sirve como asset estático
4. El sitio **Angular SSR** lee `catalog.json` una sola vez vía HTTP (cacheado en **IndexedDB 30 min**, sin bloquear el hilo principal)
5. **0 lecturas Firestore** desde el navegador del usuario — todo opera sobre datos en memoria
6. **Excepción:** `AlertFormComponent` escribe alertas de precio en Firestore (`priceAlerts`) — única operación de escritura iniciada por el usuario

Funcionalidades actuales:
- Navegación por **17 categorías** (filamentos por material, impresoras FDM/resina, resinas, repuestos, accesorios, secadores, escáneres, lápices 3D)
- **Comparativa de precios** por tienda en la ficha de cada producto
- **Historial de precios** (gráfico de línea con evolución)
- **Búsqueda con autocompletado** (0 Firestore — filtra catalog.json en memoria)
- Filtros por categoría, specs, precio y ordenamiento — con **URL params compartibles**
- **Paginación** (24 productos/página, ellipsis, sincronizada con URL)
- **Comentarios Disqus** en la ficha de cada producto
- **Página /recursos** — directorios, modelos 3D, tutoriales y comunidades
- PWA installable (service worker, manifest)
- **SEO completo**: SSR, JSON-LD, meta tags dinámicos, sitemap auto-generado

---

## 2. Zero-Cost Architecture

El proyecto corre completamente **gratis** usando los tiers gratuitos de cada servicio.

### Flujo de datos actual

```
PowerShell local
    │
    └── scraper/src/run-direct.ts  →  cada tienda activa
            │  (scrapers + classify + deduplica)
            ▼
        src/assets/data/catalog.json  (~3 MB JSON estático)
            │
            ├── --reprocess  ← aplica nuevas reglas sin internet
            ├── --purge-non3d ← limpia productos non-3D
            │
            ↓  git commit + npm run build + firebase deploy
        Firebase Hosting / CDN
            ↓  HTTP GET (1x por sesión)
        CatalogService (Angular)
            ↓  in-memory, 0 lecturas DB
        ProductService / PriceService / StoreService
            ↓
        Usuario (0 lecturas Firestore)
```

### Por qué funciona

- **0 base de datos en producción** — `catalog.json` es el único origen de datos del frontend
- **`catalog.json` en CDN** — ~50 ms inicial desde Firebase Hosting, luego service worker NGSW
- **IndexedDB 30 min TTL** — segunda carga es instantánea (caché async, sin bloquear el hilo principal)
- **Firestore** — solo escribe alertas de precio (`priceAlerts`); no se usa para leer catálogo

### Servicios de Firebase y sus límites gratuitos

| Servicio | Uso | Tier gratuito |
|---|---|---|
| **Firebase Hosting** | Sitio + `catalog.json` + assets | 10 GB transfer/mes, 1 GB storage |
| **GitHub Actions** | CI/CD de deploy (push → build → deploy) | Ilimitado en repos públicos |

---

## 3. Stack tecnológico

### Frontend
- **Angular 21** — Standalone components, zoneless (`provideZonelessChangeDetection`), Signals, OnPush
- **Angular SSR** (`@angular/ssr`) — Server-Side Rendering en Firebase Hosting
- **AngularFire 20** — SDK oficial Firebase para Angular
- **SCSS** puro — sin Tailwind ni frameworks externos
- **Chart.js** — Gráficos de historial de precios (lazy loaded con `@defer`)
- **PWA** — `@angular/pwa` con Service Worker NGSW

### Scraper
- **Node.js + TypeScript** — proyecto independiente en `/scraper/`
- **Cheerio** — parsing HTML para sitios SSR
- **Firebase Admin SDK** — legado (check.ts de diagnóstico); ya no se usa en el pipeline activo
- **fetch nativo** — para llamadas HTTP y APIs REST

### Infraestructura
- **Firebase** (Hosting + Firestore + Auth)
- **GitHub Actions** — CI/CD de deploy automático (push a `master` → `ng build` → `firebase deploy`)
- **Cloudflare** — DNS + regla de redirección www → apex (`3dprecios.cl`)
- **Resend.com** — emails transaccionales (futuro)

---

## 4. Estructura de carpetas

```
print3d-web/
├── src/
│   ├── index.html
│   ├── main.ts                    ← bootstrap Angular (browser)
│   ├── main.server.ts             ← bootstrap Angular (SSR)
│   ├── server.ts                  ← Express server para SSR
│   ├── styles.scss                ← estilos globales + reset
│   ├── styles/
│   │   ├── _variables.scss        ← tokens: colores, espaciado, tipografía
│   │   ├── _mixins.scss           ← mixins responsive, btn-primary, etc.
│   │   └── _animations.scss
│   ├── environments/
│   │   ├── environment.ts         ← Firebase config (dev)
│   │   └── environment.prod.ts    ← Firebase config (prod)
│   └── app/
│       ├── app.config.ts          ← providers globales
│       ├── app.routes.ts          ← rutas lazy
│       ├── app.ts                 ← componente raíz
│       ├── core/
│       │   ├── models/index.ts    ← interfaces TypeScript
│       │   └── services/
│       │       ├── catalog.service.ts    ← carga catalog.json, cache IndexedDB 30min (async)
│       │       ├── category.service.ts   ← categorías estáticas
│       │       ├── store.service.ts      ← tiendas desde CatalogService (0 Firestore)
│       │       ├── product.service.ts    ← productos desde CatalogService (0 Firestore)
│       │       └── price.service.ts      ← entries e historial desde CatalogService
│       ├── shared/
│       │   ├── components/
│       │   │   ├── header/
│       │   │   ├── footer/
│       │   │   ├── product-card/
│       │   │   ├── breadcrumb/
│       │   │   └── skeleton/
│       │   └── pipes/
│       │       └── clp.pipe.ts    ← formateo de precios CLP
│       └── pages/
│           ├── home/              ← landing, buscador, categorías, stats
│           ├── catalog/           ← listado con filtros y sort
│           ├── category/          ← hub de categoría
│           ├── product-detail/    ← ficha, tabla de precios, gráfico
│           │   └── components/
│           │       ├── price-table/
│           │       ├── price-chart/
│           │       └── alert-form/
│           ├── store/             ← perfil de tienda
│           └── legal/             ← privacy, terms
│
├── scraper/
│   ├── package.json               ← dependencias separadas del frontend
│   ├── tsconfig.json
│   ├── check.ts                   ← herramienta de diagnóstico (lee Firestore legado)
│   └── src/
│       ├── models.ts              ← ScraperResult, StoreConfig, STORES[]
│       ├── run-direct.ts          ← punto de entrada principal; escribe catalog.json directamente
│       ├── run.ts                 ← legado (usa Firestore + export.ts); no se usa en el pipeline activo
│       ├── export.ts              ← legado (Admin SDK → Firestore); no se usa en el pipeline activo
│       ├── firebase.ts            ← legado (upsert a Firestore); no se usa en el pipeline activo
│       └── utils.ts               ← fetchHtml, fetchJson, fetchWcStoreProducts,
│           │                         parsePriceCLP, inferCategory, slugify,
│           │                         normalizeProductName
│       └── stores/
│           ├── imperio3d.ts       ← WooCommerce HTML
│           ├── maxi3d.ts          ← WooCommerce HTML
│           ├── horus3d.ts         ← WooCommerce Store API
│           ├── makerschile.ts     ← WooCommerce Store API
│           ├── evstore.ts         ← WooCommerce Store API
│           ├── capital3d.ts       ← WooCommerce Store API
│           ├── todotoner.ts       ← Jumpseller SSR
│           ├── make3d.ts          ← Jumpseller JS-rendered (limitado)
│           ├── falabella.ts       ← API JSON propia
│           ├── pcfactory.ts       ← JS-rendered (limitado)
│           └── ...
│
├── public/
│   ├── manifest.webmanifest
│   ├── robots.txt
│   └── sitemap.xml
│
├── .github/workflows/
│   ├── deploy.yml                 ← auto-deploy en cada push a master
│
├── firebase.json
├── ngsw-config.json               ← Service Worker config
├── ARQUITECTURA.md                ← este archivo
├── MANTENCION.md                  ← guía de operación básica
└── instrucciones.md               ← especificaciones y convenciones
```

---

## 5. Modelo de datos

### `catalog.json` — único origen de datos del frontend

Generado por `scraper/src/run-direct.ts` y servido como asset estático desde CDN (`/assets/data/catalog.json`, `Cache-Control: max-age=1800, stale-while-revalidate=86400`).

```typescript
interface CatalogData {
  version:    number;           // incrementa con cada scrape
  exportedAt: string;           // ISO timestamp del último scrape
  stores:     CatalogStore[];
  products:   CatalogProduct[]; // entries inline por producto
}

interface CatalogStore {
  id:       string;   // "imperio3d"
  name:     string;   // "Imperio 3D"
  logo:     string;
  baseUrl:  string;
  isActive: boolean;
}

interface CatalogProduct {
  id:          string;  // slug canónico (clave de dedup)
  name:        string;  // nombre normalizado
  categoryId:  string;  // 'filamentos-pla', 'repuestos', etc.
  brand:       string;
  imageUrl:    string;
  minPrice:    number;  // CLP
  maxPrice:    number;  // CLP
  storeCount:  number;  // cuántas tiendas lo venden
  specs:       Record<string, string | number>;
  entries:     CatalogEntry[];  // precios por tienda (inline, no subcolección)
}

interface CatalogEntry {
  storeId:     string;
  price:       number;
  stock:       'available' | 'out';
  url:         string;
  lastChecked: string;  // ISO timestamp
}
```

### Firestore (write-only — solo `priceAlerts`)

Firestore solo recibe alertas de precio desde `AlertFormComponent`. No se usa para leer el catálogo.

```
/priceAlerts/{alertId}
    productId:   string
    productName: string
    targetPrice: number
    email:       string
    createdAt:   Timestamp
```

> **Nota histórica:** La arquitectura anterior usaba Firestore como base de datos activa
> (`/products/`, `/entries/`, `/history/`) y `export.ts` para generar `catalog.json`.
> Ese pipeline fue reemplazado por `run-direct.ts` que escribe directamente a `catalog.json`.

---

## 6. Pipeline de scraping

### Flujo actual (run-direct.ts)

```
PowerShell local
    ↓
scraper/src/run-direct.ts
    ├── Lee STORES[] de models.ts
    ├── Filtra tiendas con isActive: true
    ├── Para cada tienda llama su scraper (STORE_SCRAPERS[store.id])
    │     ↓
    │   scraper/src/stores/{tienda}.ts
    │     ├── Visita URLs de categoría (o llama WC Store API)
    │     ├── Extrae: nombre, URL, precio, stock, imagen
    │     ├── Llama inferCategory(nombre, urlPath) → categorySlug
    │     └── Devuelve ScraperResult[]
    │
    ├── normalizeProductName(nombre) → quita ruido tipográfico
    ├── inferCategory(nombre, '') → categorySlug definitivo
    ├── extractSpecs(nombre, categorySlug) → specs estructuradas
    ├── buildCanonicalKey(categorySlug, specs, nombre) → slug de dedup
    │
    ├── Si slug ya existe → merge entries / actualiza precio mínimo
    ├── Si slug nuevo → crea nuevo CatalogProduct
    │
    └── Escribe src/assets/data/catalog.json
         ├── Genera sitemap.xml en public/
         └── Muestra distribución de categorías en consola
```

**Flags disponibles:**

| Flag | Descripción | Cuándo usar |
|------|-------------|------------|
| `--store=ID` | Scrapea solo esa tienda | Debug, tienda nueva |
| `--reprocess` | Re-clasifica catálogo existente sin internet | Tras mejorar `inferCategory` |
| `--purge-non3d` | Elimina productos non-3D de `general` | Limpiar legacy de tiendas mixtas |

> **⚠️ Nota:** `--store dream3d` (con espacio) ignora el argumento y corre TODAS las tiendas. Siempre usar `--store=ID`.

### Utilidades del scraper (`scraper/src/utils.ts`)

#### `fetchHtml(url, options)`
Descarga HTML con Cheerio. Incluye:
- Rotación de User-Agent (Chrome/Safari/Linux)
- Rate limiting configurable (`rateDelay`)
- Reintentos con backoff exponencial (3 intentos por defecto)

```typescript
const $ = await fetchHtml('https://tienda.cl/filamentos/', { rateDelay: 2000 });
```

#### `fetchJson<T>(url, options)`
Descarga JSON de APIs REST. Mismas funcionalidades que `fetchHtml`.

#### `fetchWcStoreProducts(storeUrl, categoryIds, options)`
Cliente completo para la **WooCommerce Store API**:
- Pagina automáticamente (100 productos por página)
- Desduplicación por permalink
- Soporte para filtrar por `category_ids[]`
- `categoryIds = []` → trae todos los productos sin filtro

```typescript
// Todos los productos de una tienda WooCommerce
const products = await fetchWcStoreProducts('https://horus3d.cl', [], { rateDelay: 2500 });

// Solo categorías específicas
const products = await fetchWcStoreProducts('https://capital3d.cl', [54, 43, 49], { rateDelay: 1500 });
```

**Estructura de respuesta WC Store API:**
```typescript
interface WcStoreProduct {
  name: string;
  permalink: string;
  prices: { price: string; currency_code: string; };  // precio en centavos (CLP = sin decimales)
  images: Array<{ id: number; src: string; thumbnail: string; name: string; alt: string }>;
  is_in_stock: boolean;
  categories: Array<{ id: number; name: string; slug: string }>;
}
```

> **Importante:** `images` es un array de objetos (no de strings). Para obtener la URL usar `p.images?.[0]?.src ?? ''`.

#### `parsePriceCLP(texto)`
Convierte texto de precio a número entero CLP.
```typescript
parsePriceCLP('$12.990')   // → 12990
parsePriceCLP('12990 CLP') // → 12990
parsePriceCLP('')          // → 0
```

#### `inferCategory(nombre, pathOSlug)`
Ver sección 8.

#### `normalizeProductName(nombre)`
Ver sección 9.

#### `slugify(texto)`
Convierte nombre a slug URL-friendly (ID de Firestore):
```typescript
slugify('Filamento PLA 1Kg — Blanco')  // → "filamento-pla-1kg-blanco"
slugify('Boquilla Mk8 0.4mm (Pack 5)') // → "boquilla-mk8-04mm-pack-5"
```

---

## 7. Cómo añadir una tienda nueva

### Paso 1 — Registrar la tienda en `models.ts`

Añadir al array `STORES` en `scraper/src/models.ts`:

```typescript
{ 
  id: 'nueva-tienda',           // ID único, sin espacios, minúsculas con guiones
  name: 'Nueva Tienda',         // Nombre legible para mostrar en la UI
  slug: 'nueva-tienda',         // Mismo que id
  baseUrl: 'https://nueva-tienda.cl',
  logo: 'https://nueva-tienda.cl/favicon.ico',
  isActive: true
}
```

### Paso 2 — Investigar cómo carga la tienda

Abrir el sitio en Chrome DevTools > Network y ver si:

| Comportamiento | Técnica | Qué usar |
|---|---|---|
| HTML viene con productos en el source | SSR / HTML estático | `fetchHtml` + Cheerio |
| Fuente vacía, productos aparecen después | JS-rendered (React/Vue) | API REST del backend (ver DevTools > XHR) |
| Tiene `/wp-json/wc/store/v1/` | WooCommerce | `fetchWcStoreProducts` |
| Tiene `/wp-json/wc/v3/` | WooCommerce v3 | `fetchJson` directo |
| Tiene dominio `jumpseller.com` en CDN | Jumpseller | `fetchHtml` (SSR nativo) |

**Cómo verificar WooCommerce Store API:**
```
GET https://[tienda.cl]/wp-json/wc/store/v1/products?per_page=1
```
Si responde con JSON → usar `fetchWcStoreProducts`.

### Paso 3 — Crear el scraper

**Plantilla para WooCommerce Store API (recomendado para tiendas WooCommerce):**

```typescript
// scraper/src/stores/nueva-tienda.ts
import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

export async function scrapeNuevaTienda(store: StoreConfig): Promise<ScraperResult[]> {
  // Si la tienda es 100% de impresión 3D, dejar categoryIds vacío
  // Si mezcla con otros productos, buscar los IDs de las categorías 3D:
  // GET https://tienda.cl/wp-json/wc/store/v1/products/categories?per_page=100
  const products = await fetchWcStoreProducts(store.baseUrl, [], { rateDelay: 2000 });

  const results: ScraperResult[] = products
    .filter(p => {
      if (!p.prices?.price || parseInt(p.prices.price, 10) <= 0) return false;
      // Si la tienda mezcla productos, filtrar solo los 3D:
      const cat = inferCategory(p.name, p.categories?.[0]?.slug ?? '');
      return cat !== 'general';
    })
    .map(p => ({
      storeId:      store.id,
      storeName:    store.name,
      productName:  p.name,
      productUrl:   p.permalink,
      price:        parseInt(p.prices.price, 10),
      currency:     'CLP' as const,
      stock:        p.is_in_stock ? 'available' : 'out',
      imageUrl:     p.images?.[0] ?? '',
      categorySlug: inferCategory(p.name, p.categories?.[0]?.slug ?? ''),
      scrapedAt:    new Date(),
    }));

  console.log(`[NuevaTienda] Total productos: ${results.length}`);
  return results;
}
```

**Plantilla para sitio HTML/SSR (Cheerio):**

```typescript
// scraper/src/stores/nueva-tienda.ts
import { ScraperResult, StoreConfig } from '../models';
import { fetchHtml, parsePriceCLP, inferCategory } from '../utils';

const CATEGORY_PATHS = [
  '/filamentos/',
  '/impresoras-3d/',
  '/resinas/',
  '/repuestos/',
];

export async function scrapeNuevaTienda(store: StoreConfig): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const seen = new Set<string>();

  for (const path of CATEGORY_PATHS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${store.baseUrl}${path}?page=${page}`;
      const $ = await fetchHtml(url, { rateDelay: 2000 });

      // Ajustar selector según la estructura HTML de la tienda:
      $('SELECTOR_DE_PRODUCTO').each((_, el) => {
        const name     = $(el).find('SELECTOR_NOMBRE').text().trim();
        const href     = $(el).find('a').attr('href') ?? '';
        const priceRaw = $(el).find('SELECTOR_PRECIO').text().trim();
        const imgSrc   = $(el).find('img').attr('src') ?? '';
        const price    = parsePriceCLP(priceRaw);

        if (!name || !href || price === 0) return;
        if (seen.has(href)) return;
        seen.add(href);

        const productUrl = href.startsWith('http') ? href : `${store.baseUrl}${href}`;

        results.push({
          storeId:      store.id,
          storeName:    store.name,
          productName:  name,
          productUrl,
          price,
          currency:     'CLP',
          stock:        'available',
          imageUrl:     imgSrc,
          categorySlug: inferCategory(name, path),
          scrapedAt:    new Date(),
        });
      });

      hasMore = $('a[rel="next"], .next.page-numbers').length > 0;
      page++;
      if (page > 20) break; // seguro contra loops infinitos
    }
  }

  console.log(`[NuevaTienda] Total productos: ${results.length}`);
  return results;
}
```

### Paso 4 — Registrar el scraper en `run-direct.ts`

```typescript
// scraper/src/run-direct.ts
import { scrapeNuevaTienda } from './stores/nueva-tienda';

const STORE_SCRAPERS = {
  ...
  'nueva-tienda': scrapeNuevaTienda,
};
```

### Paso 5 — Probar localmente

```powershell
cd scraper
npx ts-node --project tsconfig.json src/run-direct.ts --store=nueva-tienda
```

### Paso 6 — Verificar resultados

```powershell
npx ts-node check.ts
```

Verificar que:
- El conteo de productos es razonable (no 0, no 10.000)
- Las categorías son correctas (no todo en `general`)
- Las URLs de productos son válidas

---

## 8. Sistema de categorías e inferencia

### Categorías disponibles

| ID / Slug | Nombre UI | Descripción |
|---|---|---|
| `filamentos-pla` | Filamentos PLA | PLA, PLA+, PLA Silk, PLA Matte, PLA HF |
| `filamentos-abs` | Filamentos ABS/ASA | ABS, ABS+, ASA |
| `filamentos-petg` | Filamentos PETG | PETG, PETG-CF, PETG-HF |
| `filamentos-tpu` | Filamentos TPU/TPE | Flexibles — TPU, TPE |
| `filamentos-especiales` | Filamentos Especiales | Nylon, PC, PA12, PA-CF, PEEK, PEI, HIPS, PVA, ASA-CF, Nylon-CF, fibra carbono |
| `impresoras-fdm` | Impresoras FDM | Bambu Lab, Creality, Prusa, Elegoo Neptune, Anycubic, Anet, AnkerMake, Snapmaker |
| `impresoras-resina` | Impresoras Resina | Elegoo Saturn/Mars, Anycubic, Phrozen, Shining 3D, Uniz |
| `resinas` | Resinas | Resina estándar, ABS-like, 8K, agua-lavable |
| `accesorios-resina` | Accesorios Resina | FEP, náilons de impresión, tápers, guantes, funnels, pantallas |`
| `repuestos` | Repuestos | Boquillas, hotends, camas, extrusores, BTT, Creality K-series |
| `accesorios` | Accesorios | Herramientas, insumos, adhesivos, eVacuum, eSpool, enclosures |
| `secadores` | Secadores de Filamento | Secadores, cajas de almacenamiento con calefacción |
| `scanner-3d` | Escáneres 3D | Escáneres de escritorio y portátiles |
| `lapices-3d` | Lápices 3D | Lápices 3D con filamento |
| `grabadoras-laser` | Grabadoras Láser | Grabadoras y cortadoras láser de escritorio |
| `general` | General | Fallback — productos sin categoría clara |

### `inferCategory(nombre, pathOSlug)` — lógica de clasificación

La función está en `scraper/src/utils.ts` y sigue este orden **estrictamente**:

```
0. ¿El slug tiene keywords de repuesto/BTT/Creality K? → repuestos  (prioridad máxima)
1. ¿El path/slug contiene "filament"?  → filamento (sub-tipo por nombre)
2. ¿El nombre contiene keyword de filamento SIN mencionar "impresora"? → filamento
3. ¿El path/slug menciona "resina" sin "impresora"? → resinas
4. ¿El nombre menciona resina sin impresora? → resinas
5. ¿El path/slug menciona "impresora…resina" o modelos conocidos resina? → impresoras-resina
6. ¿El nombre coincide con modelo conocido de impresora resina? → impresoras-resina
7. ¿El path/slug menciona "impresora" (sin resina)? → impresoras-fdm
8. ¿El nombre coincide con modelo conocido de impresora FDM? → impresoras-fdm
9. ¿El nombre/path menciona secador/dryer? → secadores
10. ¿El path menciona /insumos/, /herramientas/, /accesorios/? → accesorios
11. ¿El nombre tiene keywords de accesorio (eVacuum, eSpool, CryoGrip, enclosure)? → accesorios
12. ¿El path/slug menciona "repuesto", "accesorio", "nozzle"? → repuestos
13. ¿El nombre tiene keywords de repuesto? → repuestos
14. Fallback → general
```

**Regla crítica: los filamentos se detectan ANTES que las impresoras.**

El bug anterior causaba que `"Filamento FDM PLA 1.75mm"` → `impresoras-fdm` porque el regex `/fdm/` se chequeaba antes que `/filament/`. Con el orden correcto, si el nombre o path contiene `"filament"` se clasifica inmediatamente como filamento, sin llegar al check de impresoras.

### Cuándo usar el path vs. el nombre

- **Path de URL** (ej. `/categoria-producto/filamentos/`) → señal más confiable para tiendas HTML
- **Slug de categoría WooCommerce API** (ej. `"filamentos-pla"`, `"impresoras-fdm"`) → señal confiable para WC Store API
- **Nombre del producto** → señal de respaldo — útil cuando el path es ambiguo

### Añadir una nueva categoría

1. Editar `src/app/core/services/category.service.ts` — añadir al array `CATEGORIES`:
```typescript
{
  id: 'filamentos-tpu',
  slug: 'filamentos-tpu',
  name: 'Filamentos TPU/TPE',
  icon: '🟣',
  specFields: [
    { key: 'diameter', label: 'Diámetro', unit: 'mm', type: 'select', options: ['1.75', '2.85'], filterable: true },
  ],
},
```
2. Verificar que `inferCategory` ya la detecta (TPU está implementado)
3. Hacer push → deploy automático

---

## 9. Matching de productos entre tiendas

### El problema

Si Imperio 3D vende `"Filamento PLA 1Kg - Blanco"` y MakersChile vende `"Filament PLA 1KG Blanco"`, son el mismo producto pero el slug generaría IDs distintos → dos documentos separados → **0 comparativas**.

### La solución: `normalizeProductName`

Antes de generar el slug, se normaliza el nombre para eliminar ruido que varía entre tiendas:

```typescript
export function normalizeProductName(name: string): string {
  return name
    // Quitar paréntesis de variante al final: "(Negro)", "(2 Pack)"
    .replace(/\s*\([^)]{0,30}\)\s*$/, '')
    // Normalizar pesos: "1 Kg", "1KG", "1000 G" → tokens consistentes
    .replace(/(\d)\s*kg\b/gi, '$1kg')
    .replace(/(\d)\s*g\b(?!r)/gi, '$1g')
    // Quitar suffijos de marketing
    .replace(/\s*[-–|]\s*(importado|oferta|sale|nuevo|stock)[\w\s]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Flujo completo en `firebase.ts`:
```typescript
const normalizedName = normalizeProductName(result.productName);
const productSlug    = slugify(normalizedName);
// productSlug es el ID del documento en Firestore
```

### Limitación actual

La normalización elimina ruido tipográfico pero no puede igualar nombres semánticamente distintos:
- `"Bambu Lab PLA Basic"` ≠ `"PLA Basic Bambu"`
- Estos siguen generando 2 documentos separados

Para una solución completa se requeriría matching por embedding (NLP) — fuera del scope actual.

---

## 10. Frontend Angular

### Convenciones obligatorias

- **Standalone** siempre — sin `NgModules`, sin `standalone: true` (default en v20+)
- **Signals** para todo estado local — NO RxJS para estado de componente
- **`computed()`** para estado derivado
- **`inject()`** en vez de constructor injection
- **`input()` / `output()`** en vez de `@Input()` / `@Output()`
- **`OnPush`** en todos los componentes
- **`@defer (on viewport)`** para secciones below-the-fold
- **`@if` / `@for` / `@switch`** — NUNCA `*ngIf` / `*ngFor`
- **`NgOptimizedImage`** para imágenes estáticas
- Sin `ngClass` / `ngStyle` — usar `[class]` y `[style]`

### Servicios de datos

```typescript
// CatalogService — núcleo Zero Cost (catalog.json, cache IndexedDB 30min, async)
// Todos los demás servicios dependen de este
readonly catalog: Signal<CatalogData | null>;
getProducts(): CatalogProduct[]
getEntries(productId: string): CatalogEntry[]
getHistory(productId: string): CatalogHistoryPoint[]
getStores(): CatalogStore[]

// CategoryService — datos estáticos, sin red
readonly categories = CATEGORIES; // array en memoria

// StoreService — lee CatalogService (0 Firestore)
readonly stores: Signal<CatalogStore[]>;

// ProductService — lee CatalogService (0 Firestore)
getByCategory(slug: string): CatalogProduct[]
getBySlug(slug: string): CatalogProduct | null
getTopProducts(limit: number): CatalogProduct[]
getSimilar(product: CatalogProduct, limit: number): CatalogProduct[]

// PriceService — lee CatalogService (0 Firestore)
getEntries(productSlug: string): CatalogEntry[]
getHistory(productSlug: string): CatalogHistoryPoint[]
```

> **Excepción:** `AlertFormComponent` escribe alertas de precio directamente en Firestore
> via AngularFire — es la única operación Firestore iniciada por el usuario.

---

## 11. CI/CD y Deploys

### Deploy del sitio (`.github/workflows/deploy.yml`)
- **Trigger:** push a `master`
- **Acción:** `ng build` → `firebase deploy --only hosting`
- **Tiempo:** ~3-4 minutos

### Scraping (manual — local PowerShell)
- **Cómo ejecutar:** `npx ts-node --project tsconfig.json src/run-direct.ts` desde `scraper/`
- **No hay cron automático** — correr manualmente cuando se quiera actualizar el catálogo
- **Tras el scrape:** `git commit + npm run build + firebase deploy --only hosting`
- **Tiempo:** ~15-30 minutos según tiendas activas

#### Secrets de GitHub (solo para deploy.yml)

| Secret | Descripción |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio Firebase (para `firebase deploy`) |
| `FIREBASE_PROJECT_ID` | `dprecios` |

---

## 12. Comandos de diagnóstico y mantención

### `check.ts` — herramienta de diagnóstico

```powershell
cd scraper
# Requiere la variable de entorno del service account:
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json" -Raw

# Solo diagnóstico — lee SOLO la colección products (~396 lecturas)
npx ts-node check.ts

# Diagnóstico extendido + desglose por tienda (lee collectionGroup entries)
npx ts-node check.ts --verbose

# Generar catalog.json manualmente sin correr el scraper completo
npx ts-node check.ts --export

# Ver qué productos tienen slug duplicado sin modificar nada
npx ts-node check.ts --fix-dupes --dry-run

# Migrar productos con slug duplicado (añade sufijo -[storeId] al slug antiguo)
npx ts-node check.ts --fix-dupes

# Re-categorizar todos los productos con el inferCategory actualizado
npx ts-node check.ts --recategorize

# Borrar entries de tiendas sin scraper real (falabella, ripley, etc.)
npx ts-node check.ts --clean
```

**Salida de diagnóstico básico (`check.ts`):**
```
=== PRODUCTOS POR CATEGORÍA ===
  repuestos:           228
  filamentos-pla:       74
  impresoras-fdm:       45
  ...
  TOTAL: 396

=== PRODUCTOS SIN ENTRIES ACTIVAS ===
  Ninguno (todo limpio)
```

**`--verbose` añade:**
```
=== PRODUCTOS POR TIENDA ===
  imperio3d: 305 productos
  makerschile: 147 productos
  ...
```

### Scraper local de una tienda específica

```powershell
cd scraper
npx ts-node --project tsconfig.json src/run-direct.ts --store=horus3d
```

### Servidore de desarrollo

```powershell
cd print3d-web
npm start    # http://localhost:4200
```

---

## 13. Problemas conocidos y soluciones aplicadas

### 13.1 — WooCommerce JS-rendering (RESUELTO)

**Problema:** Tiendas como Horus3D, MakersChile, eVStore y Capital3D renderizan los productos con JavaScript. Cheerio solo ve HTML vacío → 0 productos.

**Solución:** Todas son WooCommerce → tienen disponible la **WooCommerce Store API** en `/wp-json/wc/store/v1/products`. Se reescribieron 4 scrapers para usar `fetchWcStoreProducts()` en vez de Cheerio.

**Cómo verificar si una tienda tiene WC Store API:**
```
GET https://tienda.cl/wp-json/wc/store/v1/products?per_page=1
```
Si responde JSON → usar WC Store API.

### 13.2 — Productos stuck en categoría `general` (RESUELTO)

**Problema:** `scrapeImperio3d` extraía 305 productos pero nunca llamaba `inferCategory()`. Todos quedaban en `general`.

**Solución:** Añadir `categorySlug: inferCategory(name, path)` a cada `results.push()`. El campo `path` debe ser la URL de categoría actual, no la URL del producto.

### 13.3 — `inferCategory` clasificaba filamentos como impresoras (RESUELTO)

**Problema:** El regex `/fdm/i` chequeaba nombres antes que `/filament/`. `"Filamento FDM PLA"` → `impresoras-fdm`.

**Solución:** Reescribir `inferCategory` con **filamentos primero**. Un producto solo puede ser impresora si no contiene keywords de filamento. Orden del check: filamento → resina → impresora resina → impresora FDM → repuesto → general.

### 13.4 — Categorías erróneas no se corregían en re-scrape (RESUELTO)

**Problema:** `firebase.ts` solo actualizaba el `categoryId` si el existente era `'general'`. Un producto mal clasificado como `impresoras-fdm` se quedaba así para siempre.

**Solución:** Cambiar la condición: actualizar siempre que `newCategory !== 'general' && newCategory !== existingCategory`.

### 13.5 — Seed entries de tiendas sin scraper (RESUELTO)

**Problema:** Falabella, Ripley, Paris y Sodimac tenían entries con URLs falsas (ej. `https://falabella.com/bambu-a1-mini`) del seed de prueba. Aparecían como comparativas pero los links estaban rotos.

**Solución:** `check.ts --clean` borra las entries de `SEED_ONLY_STORES` y elimina los productos que queden sin entries.

### 13.6 — MakersChile traía productos de arriendo de oficinas (RESUELTO)

**Problema:** Los `category_ids` hardcodeados incluían categorías no-3D.

**Solución:** Traer TODOS los productos sin filtro de categoría y aplicar `inferCategory` como filtro, descartando los que devuelvan `'general'`.

### 13.7 — Jumpseller JS-rendered (RESUELTO)

**Plataforma:** Make3D y TodoToner usan Jumpseller. El HTML SSR SÍ incluye los productos con el selector correcto.

**Solución:** Selector `button[data-product-name]` (Jumpseller SSR). Desde el botón, subir con `.parents('[data-product-id]')` para encontrar el contenedor con precio e imagen. Implementado en `todotoner.ts` y `make3d.ts`.

```typescript
$('button[data-product-name]').each((_, el) => {
  const name  = $(el).attr('data-product-name')!;
  const container = $(el).parents('[data-product-id]');
  const price = parsePriceCLP(container.find('.price').text());
  const href  = container.find('a').attr('href') ?? '';
  const img   = container.find('img').attr('src') ?? '';
  ...
});
```

### 13.8 — `WcStoreProduct.images` era `string[]` (RESUELTO)

**Problema:** 4 scrapers WC API (horus3d, evstore, capital3d, makerschile) usaban `p.images?.[0]` como string, pero la API devuelve objetos `{id, src, thumbnail, name, alt}`.

**Solución:** Actualizar el tipo en `utils.ts` y corregir todos los scrapers:
```typescript
imageUrl: p.images?.[0]?.src ?? '',
```

### 13.9 — maxi3d traía solo 15 productos (RESUELTO)

**Problema:** paginación usaba `/page/N/` (WordPress estándar) pero maxi3d.cl usa el parámetro WooCommerce `?product-page=N`.

**Solución:** Cambiar patrón de paginación en `maxi3d.ts` → ahora obtiene 280+ productos.

### 13.10 — JSON-LD eliminado por Angular (RESUELTO)

**Problema:** `<script type="application/ld+json">` dentro de plantillas Angular es eliminado por el sanitizador HTML de seguridad.

**Solución:** Inyectar el tag `<script>` directamente via `DOCUMENT` en el constructor del componente:
```typescript
constructor() {
  const script = this.document.createElement('script');
  script.type = 'application/ld+json';
  script.innerHTML = JSON.stringify(schema);
  this.document.head.appendChild(script);
}
```

---

## 14. Tiendas activas y método de scraping

### Tiendas con productos en el catálogo (Abril 2026)

| ID | Nombre | Método | Productos | Estado |
|---|---|---|---|---|
| `horus3d` | Horus3D | WC Store API | ~600 | ✅ Activo |
| `makerschile` | Makers Chile | WC Store API (filtrado) | ~400 | ✅ Activo |
| `evstore` | eVStore | WC Store API | ~300 | ✅ Activo |
| `capital3d` | Capital 3D | WC Store API (categorías) | ~250 | ✅ Activo |
| `cimech3d` | Cimech 3D | WC Store API (filtrado) | ~300 | ✅ Activo — mezcla no-3D |
| `maxi3d` | Maxi3D | WooCommerce HTML | ~300 | ✅ Activo |
| `imperio3d` | Imperio 3D | WooCommerce HTML | ~200 | ✅ Activo |
| `dream3d` | Dream 3D | WooCommerce HTML | ~120 | ✅ Activo |
| `make3d` | Make 3D | Jumpseller SSR | ~100 | ✅ Activo |
| `3dworks` | 3DWorks | WooCommerce HTML | ~100 | ⚠️ Variable |
| `mcielectronics` | MCI Electronics | WC Store API (filtrado) | ~50 | ✅ Activo — mezcla no-3D |

### Tiendas inactivas (dominio caído)

| ID | Nombre | Razón |
|---|---|---|
| `filamento` | Filamento.cl | Dominio caído |
| `crealitychile` | Creality Chile | Dominio caído |
| `artillerychile` | Artillery Chile | Dominio caído |
| `tresd` | 3D.cl | Dominio caído |

### Tiendas registradas con scraper pero sin datos aún

Hay ~30 tiendas más en `models.ts` con `isActive: true` que aún retornan 0 productos (scraper pendiente de ajuste o tienda sin stock 3D activo). Ver `scraper/src/models.ts` para la lista completa.

---

## 15. Roadmap

### Alta prioridad

| Tarea | Descripción |
|---|---|
| **Ajustar scrapers que retornan 0** | Para cada tienda en models.ts con `isActive: true` y 0 productos, investigar el DOM/API y actualizar CATEGORY_PATHS o categoryIds |
| **Deduplicación de repuestos** | `buildCanonicalKey` para repuestos: `rep-{partType}-{brand}-{modelo}-{specs}` — actualmente solo el 3% de repuestos se comparten entre tiendas |
| **`nozzleDiameter` en specs** | El diámetro de boquilla (0.2-1.2mm) es el filtro más buscado; extraer de regex `(\d+[.,]\d+)\s*mm` en `extractSpecs` |

### Media prioridad

| Tarea | Descripción |
|---|---|
| **Specs para impresoras FDM** | Agregar `workArea` (`\d+x\d+x\d+`) y `extruderCount` |
| **Historial de precios en frontend** | El campo `history[]` existe en el modelo; falta el gráfico de línea en product-detail |
| **Más tiendas activas** | pcfactory (investigar API), bambulab.com/es-cl, todoclick.cl |
| **Sistema de alertas** | `AlertFormComponent` existe; falta Firebase Auth + Resend trigger |

### Baja prioridad

| Tarea | Descripción |
|---|---|
| **Colores adicionales** | Marfil, Hueso, Champagne, Terracota, Borgoña, Coral no capturados |
| **Comparador lado a lado** | Seleccionar 2-3 productos y comparar specs/precios en tabla |
| **Exportar CSV** | Botón de descarga en ficha de producto |
