# 3DPrecios — Documentación Técnica

> Comparador de precios de productos de impresión 3D en Chile.
> Sitio live: **https://dprecios.web.app** · Repo: **https://github.com/MijelAnjel/3dprecios**

---

## Índice

1. [Visión general](#1-visión-general)
2. [Zero-Cost Architecture](#2-zero-cost-architecture)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura de carpetas](#4-estructura-de-carpetas)
5. [Modelo de datos (Firestore)](#5-modelo-de-datos-firestore)
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

1. **Scrapers** corren cada 6 horas en GitHub Actions y visitan cada tienda
2. Los productos y precios se guardan en **Firestore**
3. El sitio **Angular SSR** los muestra con comparativas en tiempo real
4. El usuario ve el precio mínimo de cada producto y puede comparar tienda por tienda

Funcionalidades actuales:
- Navegación por **8 categorías** (filamentos por material, impresoras FDM/resina, resinas, repuestos)
- **Comparativa de precios** por tienda en la ficha de cada producto
- **Historial de precios** (gráfico de línea con evolución)
- **Búsqueda por texto** en el catálogo
- Filtros por categoría y ordenamiento (menor precio, más tiendas)
- PWA installable (service worker, manifest)
- **SEO completo**: SSR, JSON-LD, meta tags dinámicos, sitemap

---

## 2. Zero-Cost Architecture

El proyecto corre completamente **gratis** usando los tiers gratuitos de cada servicio:

| Servicio | Uso | Tier gratuito |
|---|---|---|
| **Firebase Hosting** | Serve del sitio Angular SSR | 10 GB transfer/mes, 1 GB storage |
| **Cloud Firestore** | Base de datos productos/precios | 1 GB datos, 50K reads/día, 20K writes/día |
| **Firebase Auth** | Cuentas usuario (alertas futuras) | 10K users/mes |
| **GitHub Actions** | Scraping cron + CI/CD | Ilimitado en repos públicos |
| **Resend.com** | Emails de alertas de precio | 3.000 emails/mes |

**Por qué no usar un backend tradicional:**
- PostgreSQL + Redis + NestJS en un servidor = mínimo **$10-15/mes** permanentes
- GitHub Actions + Firestore hacen exactamente lo mismo a **$0**
- La única diferencia: no hay WebSockets ni lógica server-side al vuelo — no se necesitan para un comparador de precios

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
- **Firebase Admin SDK** — escritura directa a Firestore
- **fetch nativo** — para llamadas HTTP y APIs REST

### Infraestructura
- **Firebase** (Hosting + Firestore + Auth)
- **GitHub Actions** — cron de scraping (cada 6h) + CI/CD de deploy
- **Resend.com** — emails transaccionales

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
│       │       ├── category.service.ts   ← categorías estáticas
│       │       ├── store.service.ts      ← tiendas desde Firestore
│       │       ├── product.service.ts    ← productos desde Firestore
│       │       └── price.service.ts      ← entries e historial
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
│   ├── check.ts                   ← herramienta de diagnóstico
│   └── src/
│       ├── models.ts              ← ScraperResult, StoreConfig, STORES[]
│       ├── run.ts                 ← punto de entrada del scraper
│       ├── firebase.ts            ← lógica de upsert a Firestore
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
│   └── scrape.yml                 ← cron cada 6h + trigger manual
│
├── firebase.json
├── ngsw-config.json               ← Service Worker config
├── ARQUITECTURA.md                ← este archivo
├── MANTENCION.md                  ← guía de operación básica
└── instrucciones.md               ← especificaciones y convenciones
```

---

## 5. Modelo de datos (Firestore)

### Estructura de colecciones

```
/stores/{storeId}
/products/{productSlug}
    /entries/{storeId}_{productSlug}
    /history/{timestamp}
/users/{userId}
    /alerts/{alertId}
```

### Interfaces TypeScript

```typescript
// Tienda registrada
interface Store {
  id: string;        // "imperio3d"
  name: string;      // "Imperio 3D"
  slug: string;      // "imperio3d"
  url: string;       // "https://imperio3d.com"
  logo: string;      // URL favicon/logo
  country: 'CL';
  isActive: boolean;
  lastScraped: Timestamp;
}

// Producto canónico — uno por producto real, independiente de cuántas tiendas lo vendan
interface Product {
  id: string;        // = slug
  slug: string;      // "filamento-pla-1kg-bambu-lab-blanco"
  name: string;      // nombre normalizado
  brand: string;
  categoryId: string;  // "filamentos-pla"
  description: string;
  images: string[];
  specs: Record<string, string | number>;
  minPrice: number;   // CLP — el más bajo entre todas las entries activas
  maxPrice: number;   // CLP — el más alto
  storeCount: number; // cuántas tiendas lo tienen activo
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Entrada de un producto en una tienda específica
interface ProductEntry {
  id: string;         // "{storeId}_{productSlug}"
  productId: string;  // referencia al producto
  storeId: string;    // "horus3d"
  url: string;        // URL directa a la página del producto en la tienda
  price: number;      // precio actual en CLP
  currency: 'CLP';
  stock: 'available' | 'low' | 'out' | 'unknown';
  lastChecked: Timestamp;
  isActive: boolean;
}

// Punto del historial de precios
interface PriceHistory {
  productId: string;
  storeId: string;
  price: number;
  recordedAt: Timestamp;
}
```

### Cómo funcionan las comparativas

La comparativa de precios en la ficha de un producto funciona porque:
1. Todos los scrapers usan `slugify(normalizeProductName(nombre))` para generar el ID del documento
2. Si dos tiendas venden el mismo producto con nombres similares → mismo slug → mismo documento en Firestore
3. Cada tienda guarda su precio en una subcollección `entries/{storeId}_{slug}`
4. La UI lee todas las entries del producto y las muestra ordenadas por precio

**Ejemplo:**
```
products/filamento-pla-basic-bambu-lab-1kg/
  entries/
    imperio3d_filamento-pla-basic-bambu-lab-1kg   → price: 18990
    horus3d_filamento-pla-basic-bambu-lab-1kg     → price: 19500
    makerschile_filamento-pla-basic-bambu-lab-1kg → price: 17800
```

---

## 6. Pipeline de scraping

### Flujo completo

```
GitHub Actions cron (cada 6h) o trigger manual
    ↓
scraper/src/run.ts
    ├── Lee STORES[] de models.ts
    ├── Filtra tiendas con isActive: true
    ├── Para cada tienda llama su scraper específico
    │     ↓
    │   scraper/src/stores/{tienda}.ts
    │     ├── Visita URLs de categoría
    │     ├── Extrae: nombre, URL, precio, stock, imagen
    │     ├── Llama inferCategory(nombre, urlPath) → categorySlug
    │     └── Devuelve ScraperResult[]
    │
    ├── scraper/src/firebase.ts → saveResults()
    │     ├── normalizeProductName(nombre) → quita ruido
    │     ├── slugify(nombreNormalizado) → productSlug (ID del documento)
    │     ├── Si producto no existe → crea el documento
    │     ├── Si existe → actualiza categoría y/o imagen si mejoró
    │     ├── Upsert entry: /products/{slug}/entries/{storeId}_{slug}
    │     └── Si precio cambió → append /products/{slug}/history/{ts}
    │
    └── syncStores() → actualiza colección /stores/ en Firestore
```

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
  images: string[];
  is_in_stock: boolean;
  categories: Array<{ id: number; name: string; slug: string }>;
}
```

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

### Paso 4 — Registrar el scraper en `run.ts`

```typescript
// scraper/src/run.ts
import { scrapeNuevaTienda } from './stores/nueva-tienda';

const STORE_SCRAPERS = {
  ...
  'nueva-tienda': scrapeNuevaTienda,
};
```

### Paso 5 — Probar localmente

```powershell
cd scraper
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json" -Raw
npx ts-node src/run.ts --store=nueva-tienda
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
| `filamentos-abs` | Filamentos ABS | ABS, ABS+, ASA |
| `filamentos-petg` | Filamentos PETG | PETG, PETG-CF |
| `filamentos-tpu` | Filamentos TPU/TPE | Flexibles |
| `filamentos-especiales` | Filamentos Especiales | Nylon, PC, PA12, PA-CF, fibra carbono |
| `impresoras-fdm` | Impresoras FDM | Bambu Lab, Creality, Prusa, Elegoo Neptune |
| `impresoras-resina` | Impresoras Resina | Elegoo Saturn/Mars, Anycubic, Phrozen |
| `resinas` | Resinas | Resina estándar, ABS-like, 8K, agua-lavable |
| `repuestos` | Repuestos | Boquillas, hotends, camas, extrusores |
| `general` | General | Fallback — productos sin categoría clara |

### `inferCategory(nombre, pathOSlug)` — lógica de clasificación

La función está en `scraper/src/utils.ts` y sigue este orden **estrictamente**:

```
1. ¿El path/slug contiene "filament"?  → filamento (sub-tipo por nombre)
2. ¿El nombre contiene keyword de filamento SIN mencionar "impresora"? → filamento
3. ¿El path/slug menciona "resina" sin "impresora"? → resinas
4. ¿El nombre menciona resina sin impresora? → resinas
5. ¿El path/slug menciona "impresora…resina" o modelos conocidos resina? → impresoras-resina
6. ¿El nombre coincide con modelo conocido de impresora resina? → impresoras-resina
7. ¿El path/slug menciona "impresora" (sin resina)? → impresoras-fdm
8. ¿El nombre coincide con modelo conocido de impresora FDM? → impresoras-fdm
9. ¿El path/slug menciona "repuesto", "accesorio", "nozzle"? → repuestos
10. ¿El nombre tiene keywords de repuesto? → repuestos
11. Fallback → general
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
// CategoryService — datos estáticos, sin Firestore
readonly categories = CATEGORIES; // array estático

// StoreService — signal actualizado desde Firestore
readonly stores = signal<Store[]>([]);
// Se carga una vez en el constructor vía collectionData()

// ProductService — observables (Firestore es reactivo)
getByCategory(slug: string): Observable<Product[]>
getBySlug(slug: string): Observable<Product | null>
getTopProducts(limit: number): Observable<Product[]>

// PriceService — subcollecciones
getEntries(productSlug: string): Observable<ProductEntry[]>
getHistory(productSlug: string): Observable<PriceHistory[]>
```

---

## 11. CI/CD y Deploys

### Deploy del sitio (`.github/workflows/deploy.yml`)
- **Trigger:** push a `master`
- **Acción:** `ng build` → `firebase deploy --only hosting`
- **Tiempo:** ~3-4 minutos

### Scraping (`.github/workflows/scrape.yml`)
- **Trigger:** cron `0 */6 * * *` (00:00, 06:00, 12:00, 18:00 UTC) + `workflow_dispatch` manual
- **Acción:** `npm ci --prefix scraper && npm run scrape --prefix scraper`
- **Tiempo:** ~15-30 minutos según tiendas activas

#### Secrets de GitHub requeridos

| Secret | Descripción |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo de la cuenta de servicio Firebase |
| `FIREBASE_PROJECT_ID` | `dprecios` |
| `RESEND_API_KEY` | Alertas email (futuro) |

**Si `FIREBASE_SERVICE_ACCOUNT` expira:**
1. Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
2. Copiar el JSON completo
3. GitHub → Settings → Secrets → `FIREBASE_SERVICE_ACCOUNT` → Update

---

## 12. Comandos de diagnóstico y mantención

### `check.ts` — herramienta de diagnóstico

```powershell
cd scraper
# Requiere la variable de entorno del service account:
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json" -Raw

# Solo diagnóstico (sin modificar datos)
npx ts-node check.ts

# Borrar entries de tiendas sin scraper real (falabella, ripley, paris, sodimac)
npx ts-node check.ts --clean

# Re-categorizar todos los productos existentes con el inferCategory actualizado
npx ts-node check.ts --recategorize
```

**Salida de diagnóstico:**
```
=== PRODUCTOS POR TIENDA ===
  imperio3d: 305 productos | URL ejemplo: https://imperio3d.com/producto/xyz
  todotoner:  63 productos | URL ejemplo: https://www.todotoner.cl/todo-3d/...

=== PRODUCTOS POR CATEGORÍA ===
  repuestos:           184
  impresoras-fdm:       86
  filamentos-pla:       80
  ...

=== PRODUCTOS SIN ENTRIES ACTIVAS ===
  Ninguno (todo limpio)
```

### Scraper local de una tienda específica

```powershell
cd scraper
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json" -Raw
npx ts-node src/run.ts --store=horus3d
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

### 13.7 — Jumpseller JS-rendered (PARCIALMENTE RESUELTO)

**Plataforma:** Make3D y potencialmente otras usan Jumpseller. Las páginas de categoría devuelven 404 o HTML vacío.

**Solución para Make3D:** Leer el sitemap XML (`/sitemap.xml`) para obtener URLs de productos y scrapear cada página individualmente (JSON-LD tiene nombre e imagen, precio está en el HTML). Pendiente de implementar completo.

**Solución para TodoToner:** Jumpseller SSR — el HTML SÍ incluye los productos. Selector correcto: `button[data-product-name]` con `.parents('[data-product-id]')` para obtener el contenedor con precio e imagen.

---

## 14. Tiendas activas y método de scraping

| ID | Nombre | Método | Estado | Productos esperados |
|---|---|---|---|---|
| `horus3d` | Horus3D | WC Store API | ✅ Activo | ~100+ |
| `imperio3d` | Imperio 3D | WooCommerce HTML + Cheerio | ✅ Activo | ~305 |
| `makerschile` | Makers Chile | WC Store API (todos, filtrado) | ✅ Activo | ~300 |
| `evstore` | eVStore | WC Store API (todos) | ✅ Activo | ~300 |
| `capital3d` | Capital 3D | WC Store API (categorías) | ✅ Activo | ~130 |
| `maxi3d` | Maxi3D | WooCommerce HTML + Cheerio | ✅ Activo | ~23 |
| `make3d` | Make3D | Jumpseller sitemap+JSON-LD | ⚠️ Limitado | ~58 |
| `todotoner` | TodoToner | Jumpseller SSR + Cheerio | ✅ Activo | ~65 |
| `pcfactory` | PC Factory | JS-rendered | ⚠️ Sin datos | 0 |
| `falabella` | Falabella | API JSON | ⚠️ Pocos | ~10 |
| `impresalta` | Impresalta | — | ❌ Inactivo | — |
| `ahi3d` | AHI 3D | — | ❌ Inactivo | — |
| `formageo` | Formageo | — | ❌ Inactivo | — |
| `mercadolibre` | Mercado Libre | — | ❌ Inactivo | — |

**Nota:** Las tiendas `inactivo` están registradas en `STORES` con `isActive: false`. No corren en el scraper pero la UI puede mostrarlas si se activan.

---

## 15. Pendientes y roadmap

### Alta prioridad

| Tarea | Descripción |
|---|---|
| **make3d.ts completo** | Scraper via sitemap + 58 peticiones individuales a páginas de producto con JSON-LD |
| **pcfactory.ts** | JS-rendered; buscar si tiene API interna capturada en DevTools > Network |
| **Paginación virtual** | Con +1000 productos la categoría se carga completa en memoria — implementar cursor-based pagination |
| **URL params en filtros** | Los filtros seleccionados no se reflejan en la URL — imposible compartir búsquedas |

### Media prioridad

| Tarea | Descripción |
|---|---|
| **Sistema de alertas** | `AlertFormComponent` guardó el diseño pero falta Firebase Auth + Resend trigger |
| **filamentos-tpu** | La categoría existe en `inferCategory` pero no está en `category.service.ts` — falta añadirla |
| **filamentos-especiales** | Igual que TPU — falta añadirla |
| **Sitemap dinámico** | Generar `sitemap.xml` desde el scraper con todos los productos y subirlo a Hosting |
| **Más tiendas** | Investigar: 3DStore.cl, Filamento.cl, AHI 3D |

### Baja prioridad / futuro

| Tarea | Descripción |
|---|---|
| **Comparador lado a lado** | Seleccionar 2-3 productos y comparar specs y precios en tabla |
| **Exportar historial CSV** | Botón de descarga en la ficha de producto |
| **Notificaciones push** | Web Push API para alertas sin email |
| **Búsqueda full-text** | Actualmente solo filtra por categoría — añadir Algolia Free o búsqueda en Firestore |
| **Panel admin** | UI para gestionar tiendas, productos y categorías manualmente |
| **Lighthouse CI** | El workflow existe pero falla en GitHub Actions — corregir |
