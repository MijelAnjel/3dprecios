# 3DPrecios — Guía de Mantención

Sitio live: **https://dprecios.web.app**
Repositorio: **https://github.com/MijelAnjel/3dprecios**

---

## Cómo funciona el sistema

```
Scrapers (GitHub Actions)
    ↓  cada 6 horas — Admin SDK escribe en Firestore
Firestore (solo escritura desde scraper)
    ↓  Admin SDK lee una vez al terminar el scrape
export.ts → src/assets/catalog.json
    ↓  git commit + push → Firebase Hosting CDN
dprecios.web.app
    ↓  HTTP GET catalog.json (1× por sesión, cache localStorage 30min)
Angular (in-memory, 0 lecturas Firestore)
```

El scraper visita cada tienda, extrae productos y precios, los guarda en Firestore, y luego genera `catalog.json` — un snapshot estático del catálogo completo que el sitio sirve desde CDN. El navegador del usuario **nunca lee Firestore directamente**.

---

## Ejecutar el scraper manualmente

1. Ir a: https://github.com/MijelAnjel/3dprecios/actions/workflows/scrape.yml
2. Clic en **"Run workflow"** → **"Run workflow"**
3. Esperar ~20-30 minutos
4. El workflow actualiza Firestore **y** regenera `catalog.json` automáticamente
5. Refresh del sitio — aparecen los productos actualizados

### Scraper de una sola tienda (más rápido)

En el mismo formulario de "Run workflow", ingresar el ID de la tienda en el campo opcional:

| ID           | Tienda          | Método             | Estado   |
|--------------|-----------------|--------------------|----------|
| `horus3d`    | Horus3D         | WC Store API       | ✅ Activo |
| `imperio3d`  | Imperio 3D      | WooCommerce HTML   | ✅ Activo |
| `makerschile`| Makers Chile    | WC Store API       | ✅ Activo |
| `evstore`    | eVStore         | WC Store API       | ✅ Activo |
| `capital3d`  | Capital 3D      | WC Store API       | ✅ Activo |
| `maxi3d`     | Maxi3D          | WooCommerce HTML   | ✅ Activo |
| `todotoner`  | TodoToner       | Jumpseller SSR     | ✅ Activo |
| `make3d`     | Make3D          | Jumpseller SSR     | ✅ Activo |
| `falabella`  | Falabella       | API JSON           | ⚠️ Pocos  |
| `pcfactory`  | PC Factory      | JS-rendered        | ⚠️ Sin datos |

### Scraper automático (sin hacer nada)

El scraper corre automáticamente **cada 6 horas** (00:00, 06:00, 12:00, 18:00 UTC). No requiere acción manual.

---

## Deploy del sitio (automático)

Cada `git push` a la rama `master` dispara el deploy automáticamente. No hay que hacer nada extra.

Para deployar manualmente:
1. https://github.com/MijelAnjel/3dprecios/actions/workflows/deploy.yml
2. Clic en **"Run workflow"**

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

## Regenerar catalog.json manualmente

`catalog.json` se genera automáticamente al final de cada scrape. Si necesitas regenerarlo sin correr el scraper completo (por ejemplo, tras cambiar `inferCategory` o después de `--fix-dupes`):

```powershell
cd scraper
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json" -Raw
npx ts-node check.ts --export
```

Esto lee TODO Firestore via Admin SDK (~1.600 lecturas) y sobreescribe `src/assets/catalog.json`. Luego hacer `git commit + push` para que Firebase Hosting lo sirva.

> **Nota:** El archivo resultante va a `src/assets/catalog.json` — no a `public/`. Angular Build lo copia a `dist/` automáticamente.

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

## Comandos locales útiles

```bash
# Correr el scraper localmente (todas las tiendas)
cd scraper
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "dprecios-firebase-adminsdk-fbsvc-5fc52d6967.json" -Raw
npm run scrape

# Correr el scraper de una tienda específica
npm run scrape -- --store=impresalta

# Seed de datos de prueba (resetea productos de muestra)
npm run seed

# Desarrollo local del sitio
cd ..
npm start

# Build de producción
npm run build
```

---

## Estructura de Firestore

```
stores/
  {storeId}          ← configuración de cada tienda

products/
  {productSlug}      ← producto canónico (nombre, marca, categoryId, minPrice, maxPrice, storeCount)
    entries/
      {storeId}_{slug}  ← precio actual en esa tienda (url, price, stock, lastChecked)
    history/
      {timestamp}    ← historial de precios (para el gráfico)
```
