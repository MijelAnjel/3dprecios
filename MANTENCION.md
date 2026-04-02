# 3DPrecios — Guía de Mantención

Sitio live: **https://dprecios.web.app**
Repositorio: **https://github.com/MijelAnjel/3dprecios**

---

## Cómo funciona el sistema

```
[PowerShell local]
    ↓  npx ts-node src/run-direct.ts
[run-direct.ts]  ──scrape todas las tiendas──►  src/assets/data/catalog.json
                                                     ↓  git commit + push
                                              Firebase Hosting CDN
                                                     ↓  HTTP GET (1× por sesión)
                                        CatalogService (Angular in-memory)
                                                     ↓  localStorage cache 30 min
                                              Usuario (0 lecturas a DB)
```

**Arquitectura Zero-Cost:** No hay base de datos en producción. `run-direct.ts` scraped las tiendas y escribe **directamente** a `src/assets/data/catalog.json`. El sitio Angular lee este JSON estático una vez y lo cachea. El navegador del usuario nunca necesita autenticación ni DB.

**No se usa Firestore en producción.** Firestore existe en el proyecto como legado pero el pipeline actual no lo requiere.

---

## Ejecutar el scraper manualmente

El scraper se ejecuta **localmente** desde PowerShell. No hay cron automático — correrlo cuando se quiera actualizar el catálogo.

### Todas las tiendas (scrape completo)
```powershell
cd scraper
npx ts-node --project tsconfig.json src/run-direct.ts
```
Tarda ~15-30 minutos dependiendo de la cantidad de tiendas activas.

### Una sola tienda (más rápido, para debug)
```powershell
# IMPORTANTE: usar --store=ID con signo = (sin = corre TODAS las tiendas)
npx ts-node --project tsconfig.json src/run-direct.ts --store=horus3d
```

### Tiendas activas (produciendo productos en el catálogo)

| ID              | Tienda           | Método             | Productos | Estado         |
|-----------------|------------------|--------------------|-----------|----------------|
| `horus3d`       | Horus3D          | WC Store API       | ~600      | ✅ Activo       |
| `makerschile`   | Makers Chile     | WC Store API       | ~400      | ✅ Activo       |
| `evstore`       | eVStore          | WC Store API       | ~300      | ✅ Activo       |
| `capital3d`     | Capital 3D       | WC Store API       | ~250      | ✅ Activo       |
| `cimech3d`      | Cimech 3D        | WC Store API       | ~300      | ✅ Activo (mezcla no-3D) |
| `imperio3d`     | Imperio 3D       | WooCommerce HTML   | ~200      | ✅ Activo       |
| `maxi3d`        | Maxi3D           | WooCommerce HTML   | ~300      | ✅ Activo       |
| `make3d`        | Make 3D          | Jumpseller SSR     | ~100      | ✅ Activo       |
| `dream3d`       | Dream 3D         | WooCommerce HTML   | ~120      | ✅ Activo       |
| `mcielectronics`| MCI Electronics  | WC Store API       | ~50       | ✅ Activo (mezcla no-3D) |
| `3dworks`       | 3DWorks          | WooCommerce HTML   | ~100      | ⚠️ Variable     |
| `filamento`     | Filamento.cl     | —                  | 0         | ❌ Inactivo (dominio caído) |
| `crealitychile` | Creality Chile   | —                  | 0         | ❌ Inactivo (dominio caído) |
| `artillerychile`| Artillery Chile  | —                  | 0         | ❌ Inactivo (dominio caído) |
| `tresd`         | 3D.cl            | —                  | 0         | ❌ Inactivo (dominio caído) |

> Para desactivar una tienda con dominio caído: poner `isActive: false` en `scraper/src/models.ts`.

---

## Deploy del sitio

Después de un scrape, hacer `git commit + push` para que Firebase Hosting sirva el nuevo catálogo:

```powershell
cd c:\Users\Miguel\Desktop\ANGULAR\3DPRINT-WEB\print3d-web
git add -A
git commit -m "chore: actualizar catálogo [fecha]"
npm run build
firebase deploy --only hosting
```

O si ya hay CI/CD configurado en GitHub Actions, el `git push` dispara deploy automático.

---

## Categorías actuales del sitio

Las categorías son estáticas — están en `src/app/core/services/category.service.ts`. Para agregar una nueva categoría hay que editar ese archivo y hacer push.

| Category ID           | Nombre                  | Qué incluye                                      |
|-----------------------|-------------------------|--------------------------------------------------|
| filamentos-pla        | Filamentos PLA          | PLA, PLA+, PLA Silk, PLA Matte, etc.            |
| filamentos-abs        | Filamentos ABS          | ABS, ABS+, ASA                                   |
| filamentos-petg       | Filamentos PETG         | PETG, PETG-CF, PETG-HF                           |
| filamentos-tpu        | Filamentos TPU/TPE      | TPU, TPE (flexibles)                             |
| filamentos-especiales | Filamentos Especiales   | Nylon, PC, PA12, PA-CF, PEEK, PEI, HIPS, PVA   |
| impresoras-fdm        | Impresoras FDM          | Bambu, Creality, Prusa, Elegoo Aquila, Anycubic  |
| impresoras-resina     | Impresoras Resina       | Elegoo Saturn/Mars, Anycubic, Phrozen, Shining   |
| resinas               | Resinas                 | Resina estándar, ABS-like, 8K                    |
| repuestos             | Repuestos               | Boquillas, hotends, camas, cinturones            |
| accesorios            | Accesorios              | Herramientas, insumos, adhesivos, eVacuum, eSpool|
| secadores             | Secadores               | Secadores de filamento y cajas con calefacción   |
| scanner-3d            | Escáneres 3D            | Escáneres de escritorio y portátiles              |
| lapices-3d            | Lápices 3D             | Lápices 3D con filamento                         |
| general               | General                 | Todo lo que no califica en otra categoría        |

---

## Re-procesar catálogo sin re-scraping

Cuando se cambia lógica de `inferCategory` o se agregan nuevos patrones `isRepuesto`, se puede aplicar los cambios al catálogo actual **sin volver a scraper todas las tiendas**:

```powershell
cd scraper
npx ts-node --project tsconfig.json src/run-direct.ts --reprocess
```

**¿Qué hace `--reprocess`?**
- Re-ejecuta `inferCategory()` en todos los productos del catálogo existente
- Mueve productos mal clasificados a su categoría correcta (boquillas, gargantas, resinas, etc.)
- Re-extrae specs con la categoría correcta
- Guarda el nuevo `catalog.json` en ~5 segundos (sin acceso a internet)

**Guarda de seguridad:** Solo re-clasifica si el nuevo resultado es "más específico" (nunca baja de categoría concreta a `general`).

### Limpiar productos non-3D del catálogo (heredados)

```powershell
npx ts-node --project tsconfig.json src/run-direct.ts --purge-non3d
```

Elimina del catálogo productos en categoría `general` que no tienen keywords de impresión 3D. Útil después de añadir tiendas con catálogos mixtos (electrónica, CNC, etc.). Solo afecta productos en `general`, no toca repuestos ni filamentos.

> **Localización del catálogo:** `src/assets/data/catalog.json`. Angular Build lo copia a `dist/` automáticamente.

---

### Categorías que faltan y se pueden agregar

> Todas las categorías identificadas previamente ya están implementadas en `category.service.ts` y `inferCategory()`. Para agregar una **nueva** categoría:
> 1. Editar `src/app/core/services/category.service.ts` — agregar la entrada al array `CATEGORIES`
> 2. Verificar que `inferCategory` en `scraper/src/utils.ts` ya la detecta, o agregar la lógica correspondiente
> 3. Hacer push → deploy automático

---

## Qué raspa cada scraper y cómo clasifica

El scraper usa `inferCategory(nombre, path)` para clasificar cada producto. Los filamentos se detectan **siempre antes** que las impresoras, y los repuestos conocidos (BTT, Bigtreetech) tienen **prioridad máxima**.

| Tienda | Método | Qué visita |
|---|---|---|
| **horus3d** | WC Store API | Todos los productos (paginado automático) |
| **imperio3d** | HTML + Cheerio | 5 paths de categoría WooCommerce |
| **makerschile** | WC Store API | Todos los productos, filtra los no-3D con `inferCategory` |
| **evstore** | WC Store API | Todos los productos |
| **capital3d** | WC Store API | Categorías específicas (IDs 54, 43, 49, etc.) |
| **maxi3d** | HTML + Cheerio | Paths WooCommerce con paginación `?product-page=N` (~280+ prods) |
| **todotoner** | HTML + Cheerio | Paths Jumpseller con selector `button[data-product-name]` |
| **make3d** | HTML + Cheerio | Paths Jumpseller (mismo selector que todotoner) |

**Cómo funciona la clasificación por categoría:**
- Path `/filamentos/` → detecta material por nombre → `filamentos-pla / petg / abs / tpu / especiales`
- Path `/impresoras-3d/` → detecta tipo por nombre/modelo → `impresoras-fdm` o `impresoras-resina`
- Path `/resinas/` → `resinas`
- Path `/repuestos/` o `/accesorios/` → `repuestos`
- Path `/insumos/` o `/herramientas/` → `accesorios`
- Nombre con `"secador"` o `"dryer"` → `secadores`
- Sin match claro → `general` (no se guarda en Firestore)

---

## Agregar una tienda nueva

Ver guía completa paso a paso en [ARQUITECTURA.md](ARQUITECTURA.md#7-cómo-añadir-una-tienda-nueva).

Resumen rápido:
1. Crear archivo `scraper/src/stores/nueva-tienda.ts` (plantilla WC Store API o HTML+Cheerio)
2. Agregar la tienda al array `STORES` en `scraper/src/models.ts`
3. Importarla y agregarla al objeto `STORE_SCRAPERS` en `scraper/src/run.ts`
4. Probar localmente con `npx ts-node src/run.ts --store=nueva-tienda`
5. Hacer push

---

## Secrets de GitHub (no tocar)

| Secret                    | Para qué sirve                                    |
|---------------------------|---------------------------------------------------|
| FIREBASE_SERVICE_ACCOUNT  | JSON de cuenta de servicio — permite escribir en Firestore |
| FIREBASE_PROJECT_ID       | ID del proyecto Firebase (`dprecios`)             |
| RESEND_API_KEY            | Alertas de precio por email (futuro)              |

Si el JSON de la cuenta de servicio vence o se revoca, hay que:
1. Ir a Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave
2. Copiar el contenido JSON
3. Ir a GitHub → Settings → Secrets → `FIREBASE_SERVICE_ACCOUNT` → Update

---

## Comandos de mantención (PowerShell)

```powershell
# ── Scraping ──────────────────────────────────────────────────────────────

# Scrape completo (todas las tiendas activas → ~15-30 min)
cd scraper
npx ts-node --project tsconfig.json src/run-direct.ts

# Scrape de una tienda (IMPORTANTE: usar = sin espacio)
npx ts-node --project tsconfig.json src/run-direct.ts --store=horus3d

# Re-aplicar reglas de clasificación sin internet (~5 seg)
npx ts-node --project tsconfig.json src/run-direct.ts --reprocess

# Eliminar productos non-3D del catálogo (categoría general)
npx ts-node --project tsconfig.json src/run-direct.ts --purge-non3d

# ── Diagnóstico ──────────────────────────────────────────────────────────

# Distribución de categorías
cd ..
node -e "const d=require('./src/assets/data/catalog.json'); const c={}; d.products.forEach(p=>{c[p.categoryId]=(c[p.categoryId]||0)+1;}); Object.entries(c).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(v,k));"

# Ver los últimos 20 productos de una categoría
node -e "const d=require('./src/assets/data/catalog.json'); d.products.filter(p=>p.categoryId==='filamentos-pla').slice(-20).forEach(p=>console.log(p.entries[0]?.storeId,'|',p.name));"

# Verificar que un nombre clasifica correctamente
cd scraper
npx ts-node --project tsconfig.json -e "import { inferCategory } from './src/utils'; console.log(inferCategory('Boquilla MK8 0.4mm para Ender 3', ''));"

# ── Deploy ────────────────────────────────────────────────────────────────

cd c:\Users\Miguel\Desktop\ANGULAR\3DPRINT-WEB\print3d-web
git add -A
git commit -m "chore: actualizar catálogo"
npm run build
firebase deploy --only hosting

# ── Frontend ──────────────────────────────────────────────────────────────

npm start          # desarrollo local
npm run build      # build de producción
```

---

## Estructura de catalog.json

El catálogo es un JSON estático en `src/assets/data/catalog.json`, generado por `run-direct.ts`:

```typescript
{
  version:    number,      // incrementa con cada scrape
  exportedAt: string,      // ISO timestamp
  stores:     StoreConfig[],
  products: [
    {
      id:         string,  // slug canónico (clave de dedup)
      name:       string,  // nombre normalizado
      categoryId: string,  // 'filamentos-pla', 'repuestos', etc.
      brand:      string,
      imageUrl:   string,
      minPrice:   number,  // CLP
      maxPrice:   number,  // CLP
      storeCount: number,  // cuántas tiendas lo venden
      specs:      Record<string, string | number>,
      entries: [           // precios por tienda (inline, no subcollection)
        {
          storeId:     string,
          price:       number,
          stock:       'available' | 'out',
          url:         string,
          lastChecked: string,
        }
      ]
    }
  ]
}
```

> Nota: Firestore existía en la arquitectura anterior y el proyecto aún lo incluye como dependencia, pero el pipeline de producción actual escribe directamente a `catalog.json` sin pasar por Firestore.
