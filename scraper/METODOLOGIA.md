# Metodología del Scraper — 3DPrecios Chile

> Documento técnico sobre cómo funciona el sistema de extracción, clasificación y comparación de productos.  
> Actualizado: Abril 2026

---

## 1. Arquitectura General (Zero Cost)

```
Tiendas (40+ registradas, ~11 activas)
    │
    ▼
[run-direct.ts]  ────────────────────────►  src/assets/data/catalog.json
    │  (scrapers + inferCategory + deduplica)         │
    │                                                 ▼
    └── --reprocess  (sin internet, ~5 seg)   Firebase Hosting CDN
    └── --purge-non3d (elimina non-3D)               │
                                                      ▼
                                             Angular App (3DPrecios)
                                             CatalogService → localStorage (30min)
```
PARA ELIMINAR SERVICE WORKER:
navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())); localStorage.clear(); location.reload();


**Principio clave:** No hay base de datos en producción. Todo es un JSON estático de ~3 MB en CDN. El scraper se ejecuta manualmente y produce el JSON directamente. El frontend lo lee una vez y lo cachea 30 minutos.

**Flujo de mantención típico:**
1. `npx ts-node src/run-direct.ts` → genera nuevo `catalog.json`
2. `npm run build` → compila Angular
3. `firebase deploy --only hosting` → publica en CDN

**Nota histórica:** La arquitectura anterior usaba GitHub Actions + Firestore (escritura Admin SDK) + `export.ts`. Ese pipeline fue reemplazado por `run-direct.ts` que escribe directamente a `catalog.json` sin Firestore, reduciendo latencia y complejidad.

---

## 2. Tipos de Scraper por Plataforma

Hay tres métodos dependiendo de lo que ofrece cada tienda:

### 2.1 HTML + Cheerio (WooCommerce clásico)
La mayoría de las tiendas chilenas especializadas (filamento.cl, makershop.cl, evstore.cl, etc.) usan WooCommerce con temas que exponen el catálogo via HTML.

**Método:**
1. Definir un array `CATEGORY_PATHS` con las rutas de categoría relevantes (`/categoria-producto/filamentos/`, etc.)
2. Por cada path, paginar: `page/1/`, `page/2/`, … hasta que no aparezca `a.next.page-numbers`
3. Para cada `li.product`, extraer:
   - Nombre: `.woocommerce-loop-product__title`
   - URL: `a.woocommerce-LoopProduct-link[href]`
   - Precio: `.price .woocommerce-Price-amount` (tomar el más bajo si hay tachado)
   - Imagen: `img[src]` o `img[data-src]` (lazy load)
   - Stock: clase `outofstock` en el elemento
4. Pasar nombre + path por `inferCategory()` para clasificar

**Ejemplo:** `makershop.ts`, `filamento.ts`, `horus3d.ts`

**Truco importante:** Algunos temas usan `data-src` para lazy load de imágenes. Siempre verificar ambos atributos.

### 2.2 WooCommerce Store API (REST JSON)
Algunas tiendas tienen la API REST de WooCommerce Store habilitada en `/wp-json/wc/store/v1/products`. Es mucho más rápida y limpia que HTML scraping.

**Método:**
1. Llamar a `fetchWcStoreProducts(baseUrl, categoryIds)` (helper en `utils.ts`)
2. La función maneja paginación automática vía cabecera `X-WP-TotalPages`
3. Filtrar productos con `prices.price > 0`
4. Para tiendas mixtas (no 100% 3D): aplicar filtro `is3DRelated()` de palabras clave

**Ejemplo:** `cimech3d.ts`, `makerschile.ts`, `deskfab.ts`

**Truco importante:** Las tiendas que venden tanto electrónica/CNC como impresión 3D (ej. Cimech3D) necesitan un filtro `NON_3D_RE` que descarte Arduino, Mach3, fresas CNC, spring collets antes de procesar. Sin este filtro, el catálogo se llena de ruido.

### 2.3 APIs REST propias o de grandes retailers
Tiendas como Falabella, Ripley, Paris exponen APIs de búsqueda/browse propias. También hay tiendas con API custom.

**Método:**
1. Capturar la URL de la API observando las peticiones de red del browser (DevTools → Network)
2. Identificar parámetros de zona/región (ej. `zone=15200` para Santiago)
3. Iterar por páginas con `currentPage` y `totalPages`
4. Agregar cabeceras necesarias (`x-channel-id`, `Origin`, etc.)
5. Buscar por términos: `"impresora 3d"`, `"filamento 3d"`, `"bambu lab"`, etc.

**Ejemplo:** `falabella.ts`, `ripley.ts`, `paris.ts`

**Truco importante:** Los grandes retailers no tienen categoría 3D dedicada — se busca por término. Siempre usar múltiples términos para mejor cobertura (ej. también `"resina 3d"` por separado).

---

## 3. El Motor de Clasificación: `inferCategory()`

Ubicado en `scraper/src/utils.ts`. Es la pieza más crítica del sistema.

### Principio Fundamental: Orden de Detección

```
Etapa 0: isRepuesto      ← DETECTAR PRIMERO (gana sobre todo)
Etapa 1: secadores       ← antes de filamentos
         scanners        ← antes de printers
         lápices 3D      ← antes de printers
Etapa 1: filamentos      ← PLA / PETG / ABS / TPU / especiales
Etapa 2: resinas         ← líquidas (SLA/MSLA)
Etapa 3: impresoras-resina
Etapa 4: impresoras-fdm
Etapa 5: repuestos       ← por path de URL
Etapa 5b: accesorios
Etapa 6: general         ← fallback (a evitar)
```

**Por qué isRepuesto primero:** El error histórico era que "Sensor de Final de Filamento Artillery" caía en `filamentos-pla` porque la palabra "filamento" aparece en el nombre. Con detección de repuestos-primero, se captura antes de llegar a la regla de filamentos.

### Regla de Oro para Repuestos

Un nombre es un repuesto si contiene un keyword **inequívoco de pieza/componente**, sin importar si también menciona una impresora o un filamento. Ejemplos:

| Nombre | ¿Por qué es repuesto? | Keyword que lo captura |
|--------|----------------------|------------------------|
| "Sensor de Final de Filamento Artillery" | es un sensor | `\bsensor\b` |
| "Tuerca Metálica Anti Backlash para Ender 3" | es una tuerca | `anti[\s-]?backlash` |
| "Filamento Detector Runout BMG" | es un detector | `filament\s*detector` |
| "Motor Paso a Paso Eje X Creality" | es un motor | `motor\s+paso.*eje` |
| "Resina Estándar para Impresora 3D LCD" | empieza con "Resina" | `^resina\b` |

### Regla de Filamentos (Stage 1)

Un nombre es filamento si:
- El path de la URL contiene `/filament*` (señal fuerte de la tienda)
- **O** el nombre contiene keywords de material (`PLA`, `PETG`, `filamento`, etc.) **Y** no menciona `impresora/printer`

La excepción `isFilamentoAccessory` evita que elementos como soportes de carrete (spool holders), filtros de resina o guías PTFE caigan en filamentos.

Sub-categorización de filamentos:
1. Si tiene "PETG" → `filamentos-petg`
2. Si tiene "ABS" o "ASA" → `filamentos-abs`
3. Si tiene "TPU" o "TPE" → `filamentos-tpu`
4. Si tiene Nylon, PC, fibra de carbono, PEEK, PVA, HIPS → `filamentos-especiales`
5. Resto → `filamentos-pla` (incluye PLA+, PLA Silk, PLA-CF, etc.)

### Regla de Resinas (Stage 2)

Un producto es resina líquida si:
- El nombre **empieza** con "Resina" (`^resina\b`) — salida temprana garantizada
- **O** contiene "resina"/"resin" **Y** tiene marcador de líquido: cantidad en ml/g, o palabras como "estándar", "abs-like", "water washable", "transparente"

Si el nombre menciona una **impresora** Y resina → es una impresora de resina (Stage 3).

### El Problema de "para impresora"

Muchos repuestos se describen como "X para impresora Y". Ej: "Correa GT2 para impresora 3D Ender".

Solución aplicada en Stage 4 (FDM catch-all):
```typescript
if (isPrinterWord
  && !/resina|...|sla|msla|dlp/i.test(n)
  && !/para\s+(impresora|impresión)|repuesto|accesorio|pieza|upgrade/i.test(n)
) return 'impresoras-fdm';
```

Esto previene que "X para impresora" sea clasificado como impresora FDM.

---

## 4. Extracción de Specs: `extractSpecs()`

Ubicado en `scraper/src/utils.ts`. Extrae atributos estructurados del nombre del producto para habilitar filtros.

### Filamentos
| Spec | Regex / método |
|------|---------------|
| `brand` | Lista de ~28 marcas con regex: eSUN, Bambu, Polymaker, etc. |
| `material` | PETG, ABS, TPU, PLA, etc. desde el nombre |
| `weight` | `(\d+(?:[.,]\d+)?)\s*(kg|g)` → normalizado a gramos |
| `diameter` | `(\d+[.,]\d+)\s*mm` → "1.75" o "2.85" |
| `color` | Tabla de ~60 colores (ES + EN) con variantes tipográficas |

### Repuestos
| Spec | Fuente |
|------|--------|
| `brand` | Lista `PRINTER_BRANDS` (Artillery, Bambu Lab, Creality, etc.) |
| `partType` | 17 tipos: Nozzle, Hotend, Extrusor, Sensor, Correa/Polea, Motor, Placa, Cama/Superficie, Fuente, Ventilador, Pantalla LCD, Termistor, Rodamiento/Riel, Driver Motor, Piezas Hotend, Sistema de Movimiento, Accesorio Resina |
| `compatibleWith` | 14 familias de modelos: Ender 3, Ender 5, Artillery Sidewinder/Genius, Bambu A1/P1/X1, Prusa, etc. |

### Impresoras Resina
| Spec | Source |
|------|--------|
| `brand` | Lista `PRINTER_BRANDS` |
| `resolution` | `\b(4k\|8k\|10k\|12k\|14k\|16k)\b` |
| `technology` | DLP / SLA / MSLA/LCD detectados por keyword |

---

## 5. Deduplicación: `buildCanonicalKey()`

**El problema:** Cada tienda nombra el mismo producto diferente:
- "Filamento PLA Blanco 1kg eSUN 1.75mm para impresión 3D" (tienda A)
- "PLA Blanco eSUN" (tienda B)
- "eSUN PLA+ Blanco 1000g 1.75mm" (tienda C)

Sin deduplicación, estos aparecen como 3 productos separados en vez de 1 con 3 precios.

**La solución:** Derivar la clave de los **atributos estructurales**, no del nombre literal.

| Categoría | Clave canónica | Ejemplo |
|-----------|---------------|---------|
| Filamentos | `fil-{marca}-{material}-{peso}g-{diámetro}mm-{color}` | `fil-esun-pla-1000g-175mm-blanco` |
| Impresoras FDM | `fdm-{marca}-{modelo}` | `fdm-bambu-lab-a1-mini` |
| Impresoras Resina | `rsp-{marca}-{modelo}` | `rsp-anycubic-photon-m3-premium` |
| Resinas | `res-{marca}-{tipo}-{volumen}ml` | `res-anycubic-standard-500ml` |
| Otros | `{slug-del-nombre-normalizado}` | (fallback) |

**Cobertura actual:** 948/1528 repuestos (62%) tienen `partType`. Los filamentos tienen la mejor cobertura de clave canónica. Después de un ciclo completo de scraping, la deduplicación de impresoras (misma marca+modelo en múltiples tiendas) debería mejorar fuertemente.

---

## 6. El Flag `--reprocess`

Permite re-aplicar todas las reglas nuevas al catálogo existente **sin hacer scraping**.

```bash
npx ts-node --project tsconfig.json src/run-direct.ts --reprocess
```

**¿Qué hace exactamente?**
1. Carga `src/assets/data/catalog.json` existente
2. Para cada producto en categorías `['general', 'impresoras-fdm', 'impresoras-resina']`:
   - Re-ejecuta `inferCategory(nombre, '')`
   - Si el resultado corrige la categoría (ej. fdm → repuestos), aplica el cambio
   - Re-ejecuta `extractSpecs()` con la categoría correcta
3. Guarda el catálogo actualizado
4. Ideal para probar nuevas reglas de clasificación sin tiempo de scraping

**Cuándo corrige y cuándo no:**
| Categoría origen | ¿Re-categoriza? | Condición |
|-----------------|-----------------|-----------|
| `general` | ✅ Sí | Cualquier categoría más específica |
| `impresoras-fdm` | ✅ Sí | Solo si nuevo resultado es `repuestos`/`resinas`/`accesorios` |
| `impresoras-resina` | ✅ Sí | Solo si nuevo resultado es `repuestos`/`resinas`/`accesorios` |
| `filamentos-*` | ❌ No | Considerados correctos |
| `repuestos` | ❌ No | Considerados correctos |

---

## 7. Workflow para Agregar una Nueva Tienda

### Paso 0: Investigar la tienda
Abrir DevTools (F12) → Network → filtrar XHR/Fetch mientras navegas el catálogo.
Determinar si es:
- WooCommerce HTML (ver `li.product` en el DOM)
- WooCommerce Store API (ver petición a `/wp-json/wc/store/v1/products`)
- API propia (capturar la URL de la petición de listado)

### Paso 1: Crear el archivo del scraper
```typescript
// scraper/src/stores/mitienda.ts
import { ScraperResult, StoreConfig } from '../models';
import { fetchWcStoreProducts, inferCategory } from '../utils';

export async function scrapeMitienda(store: StoreConfig): Promise<ScraperResult[]> {
  // ... implementación
}
```

### Paso 2: Determinar si necesita filtro non-3D
Navegar la tienda. Si vende productos **ajenos a impresión 3D** (electrónica, CNC, herramentales):
```typescript
const NON_3D_RE = /patrones_no_3d/i;
const KEYWORDS_3D = ['impresora', 'filamento', 'resina', ...];
function is3DRelated(name: string): boolean {
  if (NON_3D_RE.test(name)) return false;
  return KEYWORDS_3D.some(kw => name.toLowerCase().includes(kw));
}
```

### Paso 3: Registrar en `models.ts`
```typescript
{ id: 'mitienda', name: 'Mi Tienda', slug: 'mitienda', 
  baseUrl: 'https://mitienda.cl', logo: '...', isActive: true }
```

### Paso 4: Registrar en `run-direct.ts`
```typescript
import { scrapeMitienda } from './stores/mitienda';
// ...
[store.id === 'mitienda'] => scrapeMitienda(store)
```

### Paso 5: Probar con `--test-store`
```bash
npx ts-node --project tsconfig.json src/run-direct.ts --test-store mitienda
```

### Paso 6: Ejecutar un scrape completo y revisar el catálogo
Verificar que los productos se categorizan bien. Si no, mejorar los `CATEGORY_PATHS` o agregar reglas `inferCategory`.

---

## 8. Workflow para Mejorar Categorización

### Cuando aparece un producto mal clasificado:
1. Identificar el nombre exacto del producto
2. Testear en Node el porqué falla:
```bash
node -e "var n='Nombre del producto'; console.log('isPrinter:', /impresora|printer/i.test(n), 'isRepuesto:', /boquilla|nozzle|...|hotend/i.test(n));"
```
3. Identificar qué pattern falta en `inferCategory()`
4. Agregar el pattern al bloque `isRepuesto` (o la etapa correspondiente)
5. Ejecutar `--reprocess` para aplicar sin re-scraping
6. Verificar distribución por categoría en output

### Checklist de calidad de categorías:
```bash
# Ver distribución actual
node -e "var d=JSON.parse(require('fs').readFileSync('src/assets/data/catalog.json','utf8')); var c={}; d.products.forEach(p=>{c[p.categoryId]=(c[p.categoryId]||0)+1;}); console.log(JSON.stringify(c,null,2));"

# Muestrear una categoría sospechosa
node -e "var d=JSON.parse(require('fs').readFileSync('src/assets/data/catalog.json','utf8')); d.products.filter(p=>p.categoryId==='impresoras-fdm').slice(0,30).forEach(p=>console.log(p.name));"
```

---

## 9. Estado del Catálogo (Abril 2026)

### Distribución de categorías (3.166 productos, 11 tiendas activas con productos):

| Categoría | Productos | Calidad |
|-----------|-----------|--------|
| repuestos | 1.766 | ✅ Buena — isRepuesto cubre >200 patrones |
| general | 470 | ⚠️ ~350 son electrónica/CNC de tiendas mixtas (cimech3d, mcielectronics) |
| filamentos-pla | 438 | ✅ Limpia tras corrección de boquillas/gargantas/embudo AMS |
| impresoras-fdm | 171 | ✅ Correcta |
| filamentos-abs | 64 | ✅ Limpia (Resinas ABS Like movidas a `resinas`) |
| filamentos-petg | 61 | ✅ Correcta |
| impresoras-resina | 58 | ✅ Correcta |
| filamentos-tpu | 41 | ✅ Correcta |
| resinas | 38 | ✅ Mejorada (+3 por corrección de orden ABS/resina) |
| secadores | 19 | ✅ Correcta |
| accesorios | 14 | ✅ Correcta |
| accesorios-resina | 11 | ✅ Correcta |
| filamentos-especiales | 10 | ✅ Correcta |
| scanner-3d | 4 | ✅ Correcta |
| lapices-3d | 1 | ✅ Correcta |

### Sobre los 470 productos en `general`:
La mayoría son legados de cimech3d y mcielectronics — tiendas con catálogos mixtos (electrónica/CNC + 3D). El filtro `is3DRelated()` ya opera en sus scrapers para productos nuevos, pero los anteriores permanecen en `general`. Se limpian con `--purge-non3d` o desaparecen naturalmente en el próximo scrape completo.

### Productos sin imagen (23 total):
- cimech3d: 22 — cables/conectores com imágenes JS-rendered (no accesibles al scraper)
- makerschile: 1 — lazy load no capturado

Esto es esperado: el frontend muestra un placeholder cuando `imageUrl` está vacío.

---

## 10. Lecciones Aprendidas (Errores Históricos)

Esta sección documenta problemas reales y sus soluciones para no repetirlos.

### 10.1 Orden de detección en `inferCategory` es CRÍTICO

`isRepuesto` debe ser la **primera** verificación, antes de cualquier check de filamentos o impresoras. Si un nombre contiene un keyword inequívoco de pieza (sensor, nozzle, boquilla, garganta, hotend...) → siempre es `repuestos`, sin importar si también menciona "filamento".

> **Ejemplo del bug:** "Sensor de Final de **Filamento** Artillery" → cayó en `filamentos-pla` porque el check de filamentos corría antes.

### 10.2 Plurales en `isRepuesto`

Usar `\bboquillas?\b` (el `?` hace la `s` opcional), no `\bboquilla\b`. Siempre verificar los plurales en español al agregar patterns.

### 10.3 "Resina ABS Like" cae en `filamentos-abs`

El check de `\babs\b` corría ANTES del check de resinas. Solución: añadir un guard de resina (`/^resina\b/i`) ANTES del bloque de filamentos, y otro guard (`/\bresina\b/i`) DENTRO del bloque para capturar nombres como "Marca Resina ABS Like".

**Regla:** la detección de resinas siempre debe correr antes de los subfiltros de material (ABS, TPU, etc.).

### 10.4 `RECATEGORIZE_ALL` debe incluir categorías de filamento

Sin `filamentos-*` en la lista, `--reprocess` no podía corregir boquillas/gargantas que llegaron bajo categoría `filamentos` por la API WooCommerce de la tienda. Ahora están incluidas con guard para solo permitir movimiento a `repuestos`/`resinas`/`accesorios-resina`/`secadores`.

### 10.5 `--store dream3d` (con espacio) corre TODAS las tiendas

El argumento se parsea buscando `a.startsWith('--store=')`. Sin el `=`, el flag no se reconoce y se scrapean todas las tiendas. **Siempre usar `--store=ID`** (con signo igual).

### 10.6 `images` en WC Store API es array de objetos, no de strings

Algunos scrapers hacían `p.images[0]`` esperando un string. La respuesta real es `{ id, src, thumbnail, alt }`. Siempre usar `p.images?.[0]?.src ?? ''`.

### 10.7 Tiendas con protección Cloudflare

`fetchHtml` recibía HTML del challenge "One moment, please" sin error HTTP. Solución: detectar el texto CF en la respuesta y lanzar `CF-BLOCKED` explícito. La tienda se omite y sigue el scrape.

### 10.8 Accesorios del sistema AMS caen en filamentos

"Embudo para **filamento** AMS Lite" contiene "filamento" → cayó en `filamentos-pla`. Solución: patterns específicos en `isRepuesto`: `/(embudo|funnel)\s*(para\s*)?(filamento|ams|bambu)/i`.

---

## 11. Workflow para Corregir Categorización

### Cuando aparece un producto mal clasificado:
1. Identificar el nombre exacto del producto
2. Testear clasificación en TypeScript:
```bash
cd scraper
npx ts-node --project tsconfig.json -e "import { inferCategory } from './src/utils'; console.log(inferCategory('Nombre del producto', ''));"
```
3. Identificar qué pattern falta y en qué etapa de `inferCategory`
4. Agregar el pattern (a `isRepuesto` o la etapa correspondiente en `utils.ts`)
5. Ejecutar `--reprocess` para aplicar sin re-scraping
6. Verificar distribución de categorías en output

### Checklist de calidad de categorías:
```bash
# Distribución actual (desde la raíz del proyecto)
node -e "const d=require('./src/assets/data/catalog.json'); const c={}; d.products.forEach(p=>{c[p.categoryId]=(c[p.categoryId]||0)+1;}); Object.entries(c).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(v,k));"

# Final de una categoría (recién agregados, más probables de tener errores)
node -e "const d=require('./src/assets/data/catalog.json'); d.products.filter(p=>p.categoryId==='filamentos-pla').slice(-20).forEach(p=>console.log(p.entries?.[0]?.storeId,'|',p.name));"

# Buscar por keyword sospechosa
node -e "const d=require('./src/assets/data/catalog.json'); d.products.filter(p=>/garganta|boquilla|embudo/i.test(p.name)).forEach(p=>console.log(p.categoryId,'|',p.name));"

# Productos multi-tienda
node -e "const d=require('./src/assets/data/catalog.json'); const mt=d.products.filter(p=>p.entries?.length>1); console.log('Multi-tienda:',mt.length,'/',d.products.length); mt.slice(0,10).forEach(p=>console.log(p.entries.length,'tiendas |',p.name.substring(0,60)));"
```

### Pendientes de calidad (baja prioridad):
- **Color de filamentos:** Agregar colores chilenos/españoles no capturados: Marfil, Hueso, Champagne, Terracota, Borgoña, Coral
- **Specs para impresoras FDM:** Añadir `workArea` (`\b\d+[xX]\d+[xX]\d+\b`) y `extruderCount`
- **Diámetro de boquilla en repuestos:** `nozzleDiameter` desde regex `(\d+[.,]\d+)\s*mm` es el filtro más buscado
- **Deduplicación de repuestos:** clave canónica `rep-{partType}-{brand}-{modelo}-{specs}` para cruzar tiendas
