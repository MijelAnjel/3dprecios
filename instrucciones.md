# Print3D Chile — Instrucciones Completas del Proyecto

> **Concepto:** Comparador de precios de productos de impresión 3D en Chile, similar a SoloTodo.cl.
> Lista tiendas, filamentos, impresoras, resinas y repuestos con historial de precios y alertas.
> **Stack:** Angular 21 SSR · Firebase · GitHub Actions scrapers · Zero-cost total.

---

## 1. Stack Tecnológico — Zero-Cost Architecture

### Frontend
| Tecnología | Uso | Tier gratuito |
|---|---|---|
| **Angular 21 SSR** | Framework principal con prerendering | — |
| **Firebase Hosting** | Deploy estático + rewrites CSR | 10 GB/mes, 1 GB storage |
| **Firebase Firestore** | Base de datos productos/precios | 1 GB, 50K reads/día, 20K writes/día |
| **Firebase Auth** | Cuentas de usuario (alertas de precio) | 10K users/mes |
| **Service Worker (NGSW)** | PWA + caché offline | — |

### Backend / Data Pipeline (Serverless)
| Tecnología | Uso | Tier gratuito |
|---|---|---|
| **GitHub Actions** | Scraping periódico (cron cada 6h) | 2000 min/mes (privado) / ilimitado (público) |
| **Node.js + Cheerio/Playwright** | Scrapers de tiendas chilenas | — |
| **Firebase Admin SDK** | Escritura a Firestore desde scrapers | — |
| **Resend.com** | Emails de alertas de precio | 3000 emails/mes gratis |
| **Algolia Free** | Búsqueda instantánea (opcional) | 10K búsquedas/mes |

### Por qué NO usar NestJS + PostgreSQL + Redis (propuesta de Gemini)
- PostgreSQL necesita hosting pago (mínimo $5-7/mes en Railway/Supabase)
- Redis necesita Upstash u otro (pago)
- NestJS en servidor dedicado = costo permanente
- GitHub Actions + Firestore = $0 con la misma funcionalidad

---

## 2. Convenciones Angular 21 — OBLIGATORIAS

### Componentes
- **Standalone SIEMPRE** — NO usar `standalone: true` (es default en v20+)
- `changeDetection: ChangeDetectionStrategy.OnPush` en TODOS los componentes
- `input()` y `output()` en vez de decoradores `@Input()` / `@Output()`
- `inject()` en vez de constructor injection
- `computed()` para estado derivado
- Signals para todo el estado local

### Templates
- Control flow nativo: `@if`, `@for`, `@switch` — NUNCA `*ngIf`, `*ngFor`
- `NgOptimizedImage` para todas las imágenes estáticas
- NUNCA `ngClass` ni `ngStyle` — usar bindings `[class]` y `[style]`
- NUNCA arrow functions en templates

### Estilos
- SCSS puro — sin Tailwind, sin CSS frameworks externos
- Variables en `src/styles/_variables.scss`
- Mixins en `src/styles/_mixins.scss`
- Estilos de componente en archivo `.scss` junto al `.ts`
- Rutas relativas al archivo `.ts` del componente

### Servicios
- `providedIn: 'root'` para singletons
- `inject()` pattern — sin constructors

### Routing
- Lazy loading en TODAS las rutas de feature
- `withPreloading(PreloadAllModules)` en producción

### NO usar
- `@HostBinding` / `@HostListener` (usar `host: {}` en el decorator)
- `zone.js` — proyecto zoneless (`provideZonelessChangeDetection()`)
- `NgModules` — todo standalone
- `any` — usar `unknown` si el tipo es incierto

---

## 3. Arquitectura de Datos

### Modelos TypeScript

```typescript
// Tienda que vende productos
interface Store {
  id: string;
  name: string;
  slug: string;
  url: string;
  logo: string;              // URL CDN/Firebase Storage
  country: 'CL';
  shippingInfo?: string;     // "Envío gratis sobre $X"
  lastScraped: Timestamp;
  isActive: boolean;
}

// Categoría de producto
interface Category {
  id: string;
  slug: string;
  name: string;              // "Filamentos PLA", "Impresoras FDM", etc.
  icon: string;              // emoji o nombre de ícono
  specFields: SpecField[];   // campos dinámicos por categoría
}

// Campo de especificación dinámica por categoría
interface SpecField {
  key: string;               // "diameter", "printVolume", "material"
  label: string;             // "Diámetro", "Volumen de impresión"
  unit?: string;             // "mm", "cm³"
  type: 'number' | 'text' | 'select';
  options?: string[];        // para type: 'select'
  filterable: boolean;
}

// Producto canónico (normalizado, único por producto real)
interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  images: string[];          // URLs
  specs: Record<string, string | number>; // dinámico por categoría
  minPrice: number;          // CLP - actualizado por trigger
  maxPrice: number;          // CLP
  storeCount: number;        // cuántas tiendas lo tienen
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Oferta de un producto en una tienda específica
interface ProductEntry {
  id: string;
  productId: string;
  storeId: string;
  url: string;               // URL directa al producto en la tienda
  price: number;             // CLP
  currency: 'CLP';
  stock: 'available' | 'low' | 'out' | 'unknown';
  sku?: string;
  lastChecked: Timestamp;
  isActive: boolean;
}

// Punto de historial de precio
interface PriceHistory {
  productId: string;
  storeId: string;
  price: number;
  recordedAt: Timestamp;
}

// Alerta de precio (usuario)
interface PriceAlert {
  id: string;
  userId: string;
  productId: string;
  targetPrice: number;
  email: string;
  isActive: boolean;
  createdAt: Timestamp;
}
```

### Estructura Firestore
```
/categories/{categoryId}
/stores/{storeId}
/products/{productId}
  /entries/{entryId}         → ProductEntry
  /history/{timestamp}       → PriceHistory
/users/{userId}
  /alerts/{alertId}          → PriceAlert
```

---

## 4. Estructura de Carpetas

```
src/
├── styles/
│   ├── _variables.scss      ← tokens de diseño (colores, espaciado, tipografía)
│   ├── _mixins.scss         ← mixins responsive, card, btn, etc.
│   └── _animations.scss
├── styles.scss              ← imports globales + reset + utilidades
├── app/
│   ├── app.config.ts        ← provideZonelessChangeDetection, provideFirebase, etc.
│   ├── app.routes.ts        ← rutas lazy
│   ├── core/
│   │   ├── services/
│   │   │   ├── products.service.ts
│   │   │   ├── stores.service.ts
│   │   │   ├── categories.service.ts
│   │   │   ├── price-history.service.ts
│   │   │   └── alerts.service.ts
│   │   ├── store/           ← signal stores globales
│   │   │   └── platform.store.ts
│   │   └── models/          ← interfaces TypeScript
│   │       └── index.ts
│   ├── shared/
│   │   └── components/
│   │       ├── header/
│   │       ├── footer/
│   │       ├── product-card/
│   │       ├── price-badge/
│   │       ├── store-chip/
│   │       └── skeleton/    ← loading states
│   └── pages/
│       ├── home/            ← landing + search hero
│       ├── catalog/         ← listado con filtros
│       │   └── components/
│       │       ├── filter-panel/
│       │       ├── product-grid/
│       │       └── sort-bar/
│       ├── product-detail/  ← ficha de producto
│       │   └── components/
│       │       ├── price-table/
│       │       ├── price-chart/
│       │       └── alert-form/
│       ├── category/        ← hub de categoría
│       ├── store/           ← perfil de tienda
│       └── legal/
│           ├── privacy/
│           └── terms/
```

---

## 5. Tiendas Chilenas a Scrapear

| Tienda | URL | Prioridad |
|---|---|---|
| Impresalta | impresalta.cl | Alta |
| Formageo | formageo.cl | Alta |
| 3D Chile (TresD) | 3d.cl | Alta |
| AHI 3D | ahi3d.cl | Media |
| Filamento | filamento.cl | Media |
| 3D Store Chile | 3dstore.cl | Media |
| Makershop | makershop.cl | Media |
| Mercado Libre CL | mercadolibre.cl | Baja (anti-scraping) |

**Estrategia de scraping:**
- Cheerio para sitios estáticos (HTML simple)
- Playwright en modo headless para sitios con JS rendering
- Rate limiting: 1 request cada 2 segundos por tienda
- Rotación de User-Agent
- Scraping cada 6 horas vía GitHub Actions cron

---

## 6. Arquitectura del Pipeline de Datos

```
GitHub Actions Cron (cada 6h)
    ↓
scraper/run.ts
    ├── Scrapea cada tienda activa en Firestore
    ├── Normaliza datos (nombre, precio, stock)
    ├── Upsert en /products/{id}/entries/{storeId}
    ├── Append en /products/{id}/history/{timestamp}
    └── Actualiza minPrice/maxPrice en /products/{id}
    ↓
Firestore actualizado
    ↓
Angular lee Firestore en tiempo real (onSnapshot) o build SSR
```

### GitHub Actions Workflow (`.github/workflows/scrape.yml`)
```yaml
on:
  schedule:
    - cron: '0 */6 * * *'   # cada 6 horas
  workflow_dispatch:          # manual trigger
jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci --prefix scraper
      - run: npm run scrape --prefix scraper
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

---

## 7. SEO — Estrategia Completa

### Prerendering (build-time)
Páginas prerenderizadas estáticamente:
- `/` — Home
- `/categorias` — Listado categorías
- `/categorias/[slug]` — Cada categoría (PLA, ABS, etc.)
- `/tiendas` — Listado tiendas
- Top 100 productos por tráfico esperado

### SSR dinámico (runtime) — Firebase Cloud Functions
- `/productos/[slug]` — Ficha de producto (precio cambia frecuentemente)
- `/tiendas/[slug]` — Perfil de tienda

### Meta tags (por página)
```typescript
// product-detail.component.ts
injectTitle.setTitle(`${product.name} - Mejor precio en Chile | Print3D`);
injectMeta.updateTag({ property: 'og:title', content: ... });
injectMeta.updateTag({ name: 'description', content: `Compara precios de ${product.name} en ${product.storeCount} tiendas. Desde $${product.minPrice.toLocaleString('es-CL')} CLP.` });
```

### JSON-LD Schemas obligatorios
- `Product` + `AggregateOffer` en fichas de producto
- `BreadcrumbList` en todas las páginas interiores
- `WebSite` + `SearchAction` en el home
- `Organization` en el home

### Sitemap dinámico
- Generado por GitHub Actions junto al scraping
- Subido a Firebase Hosting como `/sitemap.xml`
- Incluye todos los productos, categorías y tiendas

---

## 8. Core Web Vitals — Objetivos

| Métrica | Objetivo | Técnica |
|---|---|---|
| LCP | < 2.5s | SSR/prerender, imágenes optimizadas, CDN |
| FID/INP | < 200ms | Zoneless, OnPush, no bloquear main thread |
| CLS | < 0.1 | Dimensiones explícitas en imágenes, skeleton loaders |
| FCP | < 1.8s | Critical CSS inline, font preload |
| TBT | < 200ms | Lazy loading, code splitting por ruta |

### Técnicas de performance obligatorias
- `NgOptimizedImage` con `priority` en imágenes above-the-fold
- `defer` en componentes below-the-fold (`@defer (on viewport)`)
- `loading="lazy"` implícito vía NgOptimizedImage
- Font Inter preloaded en `index.html`
- Imágenes de productos en WebP con fallback
- Skeleton loaders mientras carga Firestore

---

## 9. Diseño — Sistema Visual

### Paleta de colores (modo oscuro por defecto)
```scss
// _variables.scss
$primary:        #FF6B35;   // naranja 3D printing (filamento fundido)
$primary-dark:   #E85A1F;
$primary-light:  #FF8C5A;
$accent:         #00D4AA;   // verde-teal (tech/precisión)
$warn:           #FFB800;   // amarillo (precio bajo / alerta)

// Backgrounds
$bg-dark:        #0A0A0F;
$bg-card:        #12121A;
$bg-elevated:    #1A1A24;

// Text
$text-primary:   #F0F0F5;
$text-secondary: rgba(240, 240, 245, 0.72);
$text-muted:     rgba(240, 240, 245, 0.48);
```

### Componentes clave de UI
- **ProductCard**: imagen, nombre, marca, specs highlights, precio mín (grande), badge N tiendas
- **PriceBadge**: precio con color semáforo (verde = mínimo histórico, naranja = normal, rojo = subió)
- **FilterPanel**: acordeón colapsable en móvil, sidebar fijo en desktop
- **PriceChart**: gráfico de línea con Chart.js (lazy loaded, solo en product-detail)
- **SkeletonCard**: placeholder animado mientras carga — evita CLS
- **AlertForm**: email + precio objetivo, guarda en Firestore

---

## 10. Fases del Proyecto

> **Leyenda:** ✅ Hecho · ⚠️ Parcial · ❌ Pendiente
> **Deploy live:** https://dprecios.web.app · **Repo:** https://github.com/MijelAnjel/3dprecios
> **Lighthouse producción:** Performance 93 · Accessibility 100 · Best Practices 100 · SEO 100

---

### FASE 0 — Setup Base ✅ COMPLETA
- ✅ Angular 21 SSR zoneless con `provideZonelessChangeDetection()`
- ✅ AngularFire 20 instalado y configurado (fix race condition con injector explícito)
- ✅ Firebase proyecto `dprecios`: Hosting, Firestore, Auth
- ✅ `_variables.scss`, `_mixins.scss`, `_animations.scss`
- ✅ `firebase.json`, `.firebaserc`, `environment.ts`/`environment.prod.ts`
- ✅ `scraper/` independiente con `package.json` propio
- ✅ GitHub Actions: `deploy.yml` (auto-deploy en push a `master`)
- ✅ `.npmrc` con `legacy-peer-deps` para compatibilidad AngularFire/Angular 21

### FASE 1 — Shell y Componentes Compartidos ✅ COMPLETA
- ✅ `HeaderComponent`: logo + nav desktop + hamburger móvil
- ✅ `FooterComponent`: links, categorías, tiendas, copyright
- ✅ `ProductCardComponent`: imagen, precio mín/máx, tiendas disponibles
- ✅ `PriceBadgeComponent`: precio formateado en CLP
- ✅ `StoreChipComponent`: logo tienda + nombre
- ✅ `SkeletonCardComponent`: placeholder animado
- ✅ Lazy loading de todas las rutas

### FASE 2 — Home Page ✅ COMPLETA
- ✅ Hero con buscador central
- ✅ Sección "Categorías" con grid de iconos
- ✅ Sección "Mejores precios del día" (top 8 productos de Firestore)
- ✅ Sección "Tiendas participantes" con logos
- ✅ Meta tags Open Graph
- ❌ JSON-LD WebSite + SearchAction + Organization (pendiente)

### FASE 3 — Catálogo y Filtros ✅ COMPLETA
- ✅ Ruta `/categorias/:slug` lazy loaded
- ✅ `FilterPanelComponent`: filtros dinámicos por categoría
- ✅ Filtrado local con `computed()` signal
- ✅ Sort: menor precio, mayor precio, más tiendas
- ✅ Breadcrumb
- ❌ URL params sincronizados con filtros (para compartir búsquedas)
- ❌ Paginación virtual (pendiente — necesario con +1000 productos)

### FASE 4 — Ficha de Producto ✅ COMPLETA (base)
- ✅ Ruta `/productos/:slug` con meta tags dinámicos
- ✅ `PriceTableComponent`: tabla de tiendas ordenada por precio
- ✅ `PriceChartComponent`: historial de precios (Chart.js con `@defer`)
- ✅ Sección "Productos similares"
- ✅ JSON-LD Product + AggregateOffer
- ❌ `AlertFormComponent`: requiere Firebase Auth — **PENDIENTE**
- ❌ Galería de imágenes múltiples (actualmente solo 1 imagen)

### FASE 5 — Scraper Pipeline ✅ ACTIVO (7 tiendas con datos reales)
- ✅ Scrapers activos con datos reales: **horus3d, evstore, makerschile, capital3d** (WooCommerce Store API) + **imperio3d, maxi3d** (HTML+Cheerio) + **todotoner** (Jumpseller SSR)
- ✅ `fetchWcStoreProducts()` — cliente paginado para WooCommerce Store API (4 tiendas migradas)
- ✅ `inferCategory(nombre, path)` — **reescrito con filamentos-primero** (bug crítico corregido: "Filamento FDM PLA" ya no cae en `impresoras-fdm`)
- ✅ `normalizeProductName(nombre)` — normalización para cross-store matching (quita colores, normaliza pesos, elimina suffijos de marketing)
- ✅ `firebase.ts` — actualiza categoría siempre que la nueva sea más específica (no solo desde `general`)
- ✅ `ScraperResult` interface unificada
- ✅ Cheerio + rate limiting + retry con backoff exponencial
- ✅ Firebase Admin SDK — upsert productos, entries, history
- ✅ GitHub Actions cron cada 6 horas (`scrape.yml`)
- ✅ Índices Firestore: products (categoryId+minPrice), products (categoryId+storeCount), entries (collectionGroup), alerts (collectionGroup)
- ✅ `check.ts --recategorize` — comando para re-clasificar todos los productos existentes con la lógica actualizada
- ⚠️ **make3d.ts** — Jumpseller JS-rendered, scraper parcial vía sitemap. Trae ~58 productos pero limitado
- ⚠️ **pcfactory.ts** — JS-rendered sin API conocida, actualmente sin datos
- ❌ Scraper de `3dstore.cl` (falta implementar)
- ❌ MercadoLibre (marcado inactivo, tiene anti-scraping fuerte)

### FASE 6 — Tiendas y Páginas Secundarias ✅ COMPLETA (base)
- ✅ `/tiendas` — grid de todas las tiendas
- ✅ `/tiendas/:slug` — perfil de tienda con sus productos
- ✅ `/privacidad` y `/terminos` — páginas legales
- ❌ Sitemap.xml dinámico generado por scraper (el actual es estático)

### FASE 7 — PWA + Performance ✅ COMPLETA
- ✅ Service Worker con `@angular/pwa` (`ngsw-config.json`)
- ✅ `manifest.webmanifest` con iconos
- ✅ `@defer (on viewport)` en secciones below-the-fold
- ⚠️ Lighthouse CI en GitHub Actions (`lighthouse.yml`) — workflow existe pero falla en CI (build local funciona)

### FASE 8 — Deploy ✅ COMPLETA
- ✅ Build producción sin errores
- ✅ Lighthouse local: **93 / 100 / 100 / 100**
- ✅ Deploy en https://dprecios.web.app
- ✅ CI/CD automático: cada push a `master` → deploy automático

---

## 10b. Pendientes y Próximos Pasos

### Alta prioridad
| Tarea | Detalle |
|---|---|
| **Paginación virtual** | Con +1.000 productos la categoría se carga completa en memoria. Implementar cursor con `startAfter()` de Firestore |
| **URL params en filtros** | Los filtros seleccionados no se reflejan en la URL — imposible compartir búsquedas o volver con el botón atrás |
| **make3d.ts completo** | Jumpseller JS-rendered — leer sitemap.xml, hacer petición individual a cada producto, parsear JSON-LD y precio del HTML |
| **Alertas de precio** | `AlertFormComponent` requiere Firebase Auth — hay que implementar login con email/Google + trigger via Resend |

### Scrapers pendientes
| Tienda | Estado | Qué falta |
|---|---|---|
| **make3d** | ⚠️ Parcial | Completar scraper individual por producto vía sitemap |
| **pcfactory** | ⚠️ Sin datos | JS-rendered; buscar API interna en DevTools > Network > XHR |
| **3dstore.cl** | ❌ Sin implementar | Investigar plataforma y crear scraper |
| **lider / easy** | ❌ Sin implementar | `isActive: true` en STORES pero no hay scraper — buscar en catálogo de impresoras |

### Categorías por agregar
Editar `src/app/core/services/category.service.ts` para agregar:
- `filamentos-tpu` — TPU / TPE (flexibles) — **`inferCategory` ya las clasifica, solo falta añadir a la UI**
- `filamentos-especiales` — Nylon, PA, PA-CF, PC, ASA — **igual, ya clasificadas en scraper**
- `filamentos-composite` — PLA-CF, PETG-CF, fibra de vidrio
- `enclosures` — carcasas/cajas para impresoras
- `scanners-3d` — escáneres 3D

### Funcionalidades futuras
- ❌ **Sitemap.xml dinámico** generado por scraper con todos los slugs de productos
- ❌ **Comparador lado a lado** de 2-3 productos
- ❌ **Historial de precios exportable** (CSV)
- ❌ **Notificaciones push** (Web Push API)
- ❌ **Búsqueda full-text** (actualmente solo filtra por categoría — considerar Algolia Free o búsqueda en Firestore)
- ❌ **Panel admin** para gestionar tiendas y productos manualmente
- ❌ **Lighthouse CI** funcionando en GitHub Actions (workflow existe pero falla en CI)

---

## 11. Configuración Firebase (`firebase.json`)

```json
{
  "hosting": {
    "public": "dist/print3d-web/browser",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "**",
        "headers": [
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
        ]
      }
    ]
  }
}
```

---

## 12. `app.config.ts` — Configuración Base

```typescript
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, withViewTransitions } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes,
      withPreloading(PreloadAllModules),
      withViewTransitions()
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
  ],
};
```

---

## 13. Formato de Precios (`CLP`)

```typescript
// shared/pipes/clp.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'clp' })
export class ClpPipe implements PipeTransform {
  transform(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
// Uso en template: {{ product.minPrice | clp }}  → "$12.990"
```

---

## 14. Checklist Pre-Deploy

- [ ] `ng build` sin errores ni warnings
- [ ] Todas las imágenes usan `NgOptimizedImage` con `width` y `height`
- [ ] Todas las rutas tienen `<title>` y `<meta name="description">` únicos
- [ ] JSON-LD válido en Product pages (test: search.google.com/test/rich-results)
- [ ] Lighthouse Performance ≥ 90 (contra archivos estáticos, NO el servidor SSR)
- [ ] Lighthouse Accessibility = 100 (sin fallos de contraste)
- [ ] robots.txt con `Allow: /` y `Sitemap:` apuntando al sitemap
- [ ] `.env` y service accounts NO commiteados (en `.gitignore`)
- [ ] Firebase security rules — Firestore escritura solo desde Admin SDK
- [ ] HTTPS solo (Firebase Hosting lo maneja automáticamente)

---

## 15. Testing Lighthouse (Nota Crítica)

El servidor SSR de Angular rechaza requests de `localhost` (SSRF protection).
**SIEMPRE** testear Lighthouse contra archivos estáticos:

```powershell
# Build
npm run build

# Servir archivos estáticos
npx serve dist/print3d-web/browser -l 5000 --single

# Lighthouse (nueva terminal)
npx lighthouse http://localhost:5000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless --no-sandbox --disable-dev-shms-usage"

# Ver scores
$r = Get-Content ./lighthouse-report.json | ConvertFrom-Json
$r.categories.PSObject.Properties | ForEach-Object { "$($_.Name): $([math]::Round($_.Value.score * 100))" }
```

---

## 16. Nombre del Proyecto — Opciones

| Nombre | Dominio .cl | Concepto |
|---|---|---|
| **Print3D** | print3d.cl | Directo y descriptivo |
| **FilaPrice** | filaprice.cl | Filamento + precio |
| **3DPrecio** | 3dprecio.cl | Español puro |
| **TresD Precio** | tresdprecio.cl | Chileno |
| **ImpriMejor** | imprimejor.cl | Imprime + mejor precio |

---

*Generado el 30 Mar 2026 — Para usar con GitHub Copilot en VS Code.*
*Basado en las lecciones y convenciones del proyecto NearbyU Web (Angular 21 SSR + Firebase).*
