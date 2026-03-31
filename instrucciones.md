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

### FASE 0 — Setup Base (Día 1)
- [ ] `ng new print3d-web --ssr --style=scss`
- [ ] Configurar `provideZonelessChangeDetection()` en `app.config.ts`
- [ ] Instalar AngularFire (`ng add @angular/fire`)
- [ ] Configurar Firebase proyecto: Hosting, Firestore, Auth
- [ ] `src/styles/_variables.scss`, `_mixins.scss`, `_animations.scss`
- [ ] Reset CSS + tipografía base en `styles.scss`
- [ ] Configurar `firebase.json` y `.firebaserc`
- [ ] `environment.ts` / `environment.prod.ts` con config Firebase
- [ ] Carpeta `scraper/` independiente con `package.json` propio
- [ ] GitHub Actions workflow base (deploy automático en push a main)

### FASE 1 — Shell y Componentes Compartidos (Día 1-2)
- [ ] `HeaderComponent`: logo + nav desktop + hamburger móvil (position:absolute cuando abierto)
- [ ] `FooterComponent`: links, categorías, stores, copyright
- [ ] `ProductCardComponent`: input `product: Product`, imagen lazy, precio mín/máx
- [ ] `PriceBadgeComponent`: precio formateado en CLP (`$1.990`)
- [ ] `StoreChipComponent`: logo tienda + nombre
- [ ] `SkeletonCardComponent`: skeleton animado
- [ ] `BreadcrumbComponent`: aria-label + JSON-LD
- [ ] Lazy loading de todas las rutas

### FASE 2 — Home Page (Día 2-3)
- [ ] Hero con buscador central (input reactivo con signal)
- [ ] Sección "Categorías" con grid de iconos
- [ ] Sección "Mejores precios del día" (top 8 productos más baratos)
- [ ] Sección "Tiendas participantes" con logos
- [ ] JSON-LD WebSite + SearchAction + Organization
- [ ] Meta tags Open Graph completos

### FASE 3 — Catálogo y Filtros (Día 3-5)
- [ ] Ruta `/categorias/:slug` lazy loaded
- [ ] `FilterPanelComponent`: filtros dinámicos por categoría vía `specFields`
- [ ] Filtrado con `computed()` signal (no requests al servidor)
- [ ] Sort: menor precio, mayor precio, más tiendas, relevancia
- [ ] Paginación virtual (virtual scroll para +1000 productos)
- [ ] URL params sincronizados con filtros activos (para compartir búsquedas)
- [ ] Breadcrumb + JSON-LD BreadcrumbList

### FASE 4 — Ficha de Producto (Día 5-7)
- [ ] Ruta `/productos/:slug` con SSR + meta tags dinámicos
- [ ] Galería de imágenes (lazy + NgOptimizedImage)
- [ ] `PriceTableComponent`: tabla de tiendas ordenada por precio, con link directo
- [ ] `PriceChartComponent`: Chart.js con historial 30/60/90 días (lazy con `@defer`)
- [ ] `AlertFormComponent`: email + precio objetivo → Firestore + Firebase Auth
- [ ] JSON-LD Product + AggregateOffer + ItemAvailability
- [ ] Sección "Productos similares" con computed()

### FASE 5 — Scraper Pipeline (Día 7-10)
- [ ] Carpeta `scraper/` con TypeScript + ts-node
- [ ] `scraper/src/stores/` — un archivo por tienda
- [ ] Interface `ScraperResult` unificada para todas las tiendas
- [ ] Cheerio para scraping de HTML estático
- [ ] Playwright para sitios con JS (solo si necesario — más pesado en CI)
- [ ] Rate limiting y manejo de errores/reintentos
- [ ] Firebase Admin SDK — upsert productos y entradas
- [ ] Trigger de alerta: si `newPrice <= alert.targetPrice` → enviar email via Resend
- [ ] GitHub Actions cron cada 6 horas
- [ ] Webhook de Slack/Discord opcional para errores de scraping

### FASE 6 — Tiendas y Páginas Secundarias (Día 10-11)
- [ ] `/tiendas` — grid de todas las tiendas con stats
- [ ] `/tiendas/:slug` — perfil de tienda con sus productos listados
- [ ] `/privacidad` y `/terminos` — páginas legales
- [ ] Sitemap.xml generado automáticamente por el scraper

### FASE 7 — PWA + Performance (Día 11-12)
- [ ] Service Worker con `@angular/pwa` (`ng add @angular/pwa`)
- [ ] `ngsw-config.json`: caché de assets, rutas de categorías
- [ ] `@defer (on viewport)` en secciones below-the-fold
- [ ] Preloading de rutas críticas
- [ ] Lighthouse CI en GitHub Actions (falla si Performance < 90)
- [ ] `manifest.json` con iconos para instalación PWA

### FASE 8 — Lighthouse Final y Deploy (Día 12-13)
- [ ] Build production: `npm run build`
- [ ] Lighthouse contra archivos estáticos: `npx serve dist/print3d-web/browser`
- [ ] **Objetivo:** Performance ≥ 90, Accessibility = 100, Best Practices = 100, SEO = 100
- [ ] Corregir todos los fallos de contraste (mínimo 4.5:1 texto normal, 3:1 texto grande)
- [ ] Deploy: `firebase deploy --only hosting`
- [ ] Verificar en producción con Lighthouse real

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
