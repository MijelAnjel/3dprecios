# Metodología del Scraper — 3DPrecios Chile

> Documento técnico sobre cómo funciona el sistema de extracción, clasificación y comparación de productos.  
> Actualizado: Abril 2026

---

## 1. Arquitectura General (Zero Cost)

```
Tiendas (40+)
    │
    ▼
[Scraper TypeScript]  ──run-direct.ts──►  src/assets/data/catalog.json
                                               │
                                               ▼
                                      Firebase Hosting CDN
                                               │
                                               ▼
                                    Angular App (3DPrecios)
                                    CatalogService → localStorage (30min)
```

**Principio clave:** No hay base de datos en producción. Todo es un JSON estático de ~3 MB en CDN. El scraper se ejecuta manualmente (o en CI) y produce el JSON. El frontend lo lee una vez y lo cachea 30 minutos.

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

## 9. Análisis del Catálogo Actual (Abril 2026)

### Estado de categorías (2839 productos totales):
| Categoría | Productos | Calidad |
|-----------|-----------|---------|
| repuestos | 1528 | ✅ Buena — 62% con partType |
| general | 676 | ⚠️ Ver tabla de problemas abajo |
| filamentos-pla | 211 | ✅ Correcta |
| impresoras-fdm | 170 | ✅ Limpia (−29 vs anterior) |
| impresoras-resina | 66 | ✅ Limpia (−11 vs anterior) |
| filamentos-abs | 49 | ✅ Correcta |
| filamentos-petg | 43 | ✅ Correcta |
| filamentos-tpu | 29 | ✅ Correcta |
| resinas | 32 | ✅ Mejorada (+3 vs anterior) |
| secadores | 18 | ✅ Correcta |

### Análisis de los 676 productos en `general`:

| Tipo de contenido | Cantidad estimada | Acción recomendada |
|-------------------|------------------|--------------------|
| Arduino / CNC / fresas (cimech3d legacy) | ~350 | Purgar: son productos pre-filtro, se eliminan en el próximo scrape completo |
| Spring collets / fresas router | ~120 | Purgar (no 3D) |
| Cable plano FFC Artillery | ~5 | Mover a `repuestos` (son cables de impresoras) |
| Block Aluminio Volcano Artillery | ~2 | Mover a `repuestos` |
| Servicios (modelado 3D, corte CNC, laser hora) | ~15 | Filtrar o nueva categoría `servicios` |
| Cajas organizadoras, storage | ~10 | Filtrar (no son materiales 3D) |
| Simulador de carreras (error de tienda) | ~3 | Filtrar |
| Accesorios generales inclasificables | ~170 | Requieren análisis adicional |

**Nota:** La mayoría de los productos Arduino/CNC en `general` son productos **legacy** de antes de que se agregara el filtro `is3DRelated()` en cimech3d. Desaparecerán naturalmente en el **próximo ciclo de scraping completo** (porque cimech3d ya los filtra, y `--reprocess` no borra los que ya están clasificados como `general`).

---

## 10. Qué Falta / Próximas Mejoras

### 10.1 Calidad de Datos (Alta Prioridad)

**A. Purgar productos non-3D del catálogo legado**
Los ~470 productos Arduino/CNC/fresas en `general` vienen de scrapes anteriores a la implementación del filtro. Solución: implementar un flag `--purge-non3d` que elimine del catálogo productos cuyo `storeId` es `cimech3d` y que no pasen `is3DRelated()`, más los `undefined` storeId.

**B. Cables planos FFC → repuestos**
"Cable Plano FFC 500mm eje X Artillery X2" debería ser `repuestos`. Agregar a `isRepuesto`:
```typescript
/cable\s*(plano|ffc|flex).*eje\s*[xyz]|eje\s*[xyz].*cable\s*(plano|ffc)/i.test(n)
```

**C. Más `compatibleWith` en extractSpecs**
Solo el 10-15% de repuestos tienen `compatibleWith` poblado porque los nombres no siempre mencionan el modelo exacto. Expandir con más variantes: "Ender3", "E3V2", "E3S1", "K1C", "K2Plus", etc.

**D. Color de filamentos más completo**
La extracción de color falla para nombres como "Marfil", "Hueso", "Champagne", "Terracota", "Borgona", "Coral". Ampliar la tabla de colores.

### 10.2 Deduplicación (Alta Prioridad)

**E. Deduplicación de repuestos**
Solo 61 de 2839 productos están en múltiples tiendas. Los filamentos deduplicados bien (clave canónica funciona). Pero repuestos aún tienen clave basada en nombre, que varía entre tiendas.

Mejorar: expandir `buildCanonicalKey()` para repuestos con formato:
```
rep-{partType}-{brand}-{modelo-compatible}-{specs}
```
Ej: `rep-nozzle-e3d-ender3-04mm` para "Nozzle 0.4mm para Ender 3" de cualquier tienda.

**F. Impresoras FDM: clave canónica más robusta**
Actualmente: `fdm-bambu-lab-a1-mini`. Si una tienda dice "Bambu A1 Mini" y otra "Bambulab A1 Mini Combo" → claves distintas. Mejorar `buildCanonicalKey` con normalize del modelo.

### 10.3 Nuevas Categorías / Filtros (Prioridad Media)

**G. Specs para impresoras FDM**
Actualmente solo `brand`. Agregar:
- `workArea`: volumen de trabajo `"220x220x250"` extraído de regex `\b\d+[xX]\d+[xX]\d+\b`
- `extruderCount`: "Combo" / "AMS" implica multi-extrusor

**H. Filtro por grado de nozzle en Repuestos**
El diámetro de boquilla (0.2mm, 0.4mm, 0.6mm, 0.8mm) es el filtro más buscado. Extraer con:
```typescript
/(\d+[.,]\d+)\s*mm.*nozzle|nozzle.*(\d+[.,]\d+)\s*mm/i
specs['nozzleDiameter'] = match
```
Agregar `nozzleDiameter` a `extractSpecs` y a `specFields` de `repuestos`.

**I. Sub-categoría para Wash & Cure stations**
Actualmente están en `impresoras-resina`. Son un tipo de producto diferente — estaciones de posprocesado. Podrían tener su propio filtro o estar en `accesorios`.

**J. Grado de filamento (Standard vs Premium)**
Algunas marcas tienen líneas distintas (eSUN PLA vs eSUN PLA+) que impactan el precio. Extraer `grade`: Standard / Plus / Silk / Pro / Matte / CF / etc.

### 10.4 Nuevas Tiendas (Prioridad Media)

**Potenciales tiendas a agregar:**

| Tienda | Tipo | Observaciones |
|--------|------|---------------|
| `abcdin.cl` | Retailer | Tienen impresoras Creality |
| `lider.cl` / Walmart | Retailer | Venden impresoras FDM masivas |
| `pcfactory.cl` | Electrónica | Tienen impresoras Bambu, Creality |
| `todoclick.cl` | Electrónica | Tienen filamentos y planchas |
| `3dmakersclub.cl` | Especializada | Tienda nueva, buen catálogo filamentos |
| `bambulab.com/es-cl` | Oficial | Precios oficiales Bambu Chile |
| `creality.com` | Oficial | Precios oficiales Creality |

**Criterio para agregar una tienda:**
- ¿Tiene stock activo en Chile con precios CLP?
- ¿Tiene >20 productos 3D?
- ¿El scraping es técnicamente viable (no requiere JS rendering)?

### 10.5 Infraestructura (Prioridad Baja)

**K. `--purge-non3d` flag**
Implementar en `run-direct.ts` un flag que elimine del catálogo productos que:
- Tienen `storeId` de tiendas conocidas como "mixtas" (cimech3d, electronicat, mcielectronics)  
- **Y** no pasan un filtro de keywords 3D

**L. Historial de precios visible en frontend**
El campo `history[]` ya existe en el modelo. Implementar gráfico de precio en el tiempo en la página de producto (una línea por tienda).

**M. `--test-store {id}` completo**
Actualmente se puede probar una tienda individualmente. Mejorar el output para mostrar:
- Distribución de categorías resultante
- Productos que caen en `general` (indicador de calidad)
- Productos con specs vacíos

---

## 11. Comandos Útiles de Diagnóstico

```bash
# Ver distribución de categorías
node -e "var d=JSON.parse(require('fs').readFileSync('src/assets/data/catalog.json','utf8')); var c={}; d.products.forEach(function(p){c[p.categoryId]=(c[p.categoryId]||0)+1;}); Object.keys(c).sort(function(a,b){return c[b]-c[a];}).forEach(function(k){console.log(c[k]+' '+k);});"

# Muestrear una categoría
node -e "var d=JSON.parse(require('fs').readFileSync('src/assets/data/catalog.json','utf8')); d.products.filter(function(p){return p.categoryId==='impresoras-fdm';}).slice(0,30).forEach(function(p){console.log(p.name);});"

# Ver cobertura de specs en repuestos
node -e "var d=JSON.parse(require('fs').readFileSync('src/assets/data/catalog.json','utf8')); var r=d.products.filter(function(p){return p.categoryId==='repuestos';}); var wt=r.filter(function(p){return p.specs&&p.specs.partType;}); console.log('Con partType:',wt.length,'/',r.length,'('+Math.round(wt.length/r.length*100)+'%)');"

# Ver multi-tienda
node -e "var d=JSON.parse(require('fs').readFileSync('src/assets/data/catalog.json','utf8')); var mt=d.products.filter(function(p){return p.entries&&p.entries.length>1;}); console.log('Multi-tienda:',mt.length,'/',d.products.length); mt.slice(0,10).forEach(function(p){console.log(p.entries.length,' tiendas | ',p.name.substring(0,60));});"

# Ejecutar re-proceso (sin scraping)
npx ts-node --project tsconfig.json src/run-direct.ts --reprocess

# Scrape completo
npx ts-node --project tsconfig.json src/run-direct.ts
```
