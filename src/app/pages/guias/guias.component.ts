import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

// ─── Data models ─────────────────────────────────────────────────────────────

export interface Solution {
  step: number;
  action: string;
  detail?: string;
}

export interface Cause {
  title: string;
  explanation: string;
}

export interface ExternalGuide {
  name: string;
  url: string;
  lang: 'es' | 'en';
}

export interface Problem {
  id: string;
  emoji: string;
  label: string;
  group: 'fdm' | 'resin';
  tagline: string;
  what: string;
  visualHint: string;
  causes: Cause[];
  solutions: Solution[];
  tips: string[];
  externalGuides: ExternalGuide[];
}

// ─── Problems database ────────────────────────────────────────────────────────

const PROBLEMS: Problem[] = [
  {
    id: 'stringing',
    emoji: '🕸️',
    label: 'Hilos / Stringing',
    group: 'fdm',
    tagline: 'Hilos de plástico entre partes separadas',
    what: 'El stringing ocurre cuando la boquilla se desplaza sobre un espacio vacío y deja un hilillo de plástico fundido. El resultado son telarañas finas que conectan partes de la pieza que no deberían estar unidas.',
    visualHint: 'Aspecto de telaraña o cabello fino entre torres, columnas o paredes separadas. Los hilos suelen ser translúcidos y se doblan fácilmente.',
    causes: [
      { title: 'Retracción insuficiente', explanation: 'La retracción jala el filamento hacia atrás antes de que la boquilla viaje. Si es demasiado corta o lenta, queda plástico colgando.' },
      { title: 'Temperatura demasiado alta', explanation: 'A mayor temperatura, el plástico es más líquido y fluye solo por gravedad. PLA sobre 220 °C produce mucho stringing.' },
      { title: 'Velocidad de desplazamiento baja', explanation: 'Si la boquilla viaja despacio sobre espacios vacíos, tiene más tiempo para babear plástico.' },
      { title: 'Filamento húmedo', explanation: 'La humedad dentro del filamento se convierte en vapor y empuja plástico extra hacia afuera.' },
    ],
    solutions: [
      { step: 1, action: 'Aumenta la retracción en 0.5 mm y testa', detail: 'Empieza por 3–4 mm en extrusor directo, 5–7 mm en Bowden. Aumenta de 0.5 mm en 0.5 mm hasta eliminar hilos.' },
      { step: 2, action: 'Baja la temperatura de 5 en 5 °C', detail: 'Imprime una torre de temperatura (temp tower). El mejor rango para PLA suele ser 195–210 °C.' },
      { step: 3, action: 'Activa "Avoid crossing perimeters" en el slicer', detail: 'Esto obliga a la boquilla a viajar por dentro de la pieza, evitando saltar sobre espacios vacíos visibles.' },
      { step: 4, action: 'Sube la velocidad de desplazamiento (travel speed)', detail: 'Usa 150–250 mm/s en desplazamientos. A mayor velocidad, menos tiempo para babear.' },
      { step: 5, action: 'Seca el filamento 4–6 horas a 45–50 °C', detail: 'Usa deshidratador de alimentos o horno con la puerta entreabierta. El PLA húmedo burbujea audiblemente.' },
    ],
    tips: [
      'Imprime un "stringing test" (puente de Torres) antes y después de ajustar para comparar visualmente.',
      'El stringing residual se puede eliminar con un encendedor a 3–5 cm de distancia — el calor funde los hilos sin dañar la superficie.',
      'Cada marca y color de filamento puede necesitar ajustes distintos de temperatura.',
    ],
    externalGuides: [
      { name: 'Simplify3D — Stringing & Oozing', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/#stringing-and-oozing', lang: 'en' },
      { name: 'All3DP — Stringing: Easy Ways to Prevent It', url: 'https://all3dp.com/2/3d-print-stringing-easy-ways-to-prevent-it/', lang: 'en' },
      { name: 'Bitfab — Hilos en impresión 3D', url: 'https://bitfab.io/es/blog/errores-impresion-3d/#stringing', lang: 'es' },
    ],
  },
  {
    id: 'warping',
    emoji: '🌀',
    label: 'Alabeo / Warping',
    group: 'fdm',
    tagline: 'Las esquinas se levantan de la cama',
    what: 'El warping es la deformación de la base de una pieza. Las esquinas o bordes se despegan de la cama y se curvan hacia arriba mientras la pieza se enfría, distorsionando la geometría final.',
    visualHint: 'Esquinas levantadas o arqueadas. La pieza puede despegarse completamente durante la impresión. En vista lateral parece una sonrisa o cuenco invertido.',
    causes: [
      { title: 'Enfriamiento desigual', explanation: 'El plástico se contrae al enfriarse. Si las capas superiores se enfrían antes que las inferiores, la diferencia de contracción dobla la pieza.' },
      { title: 'Temperatura de cama insuficiente', explanation: 'Una cama fría no mantiene el plástico adherido. ABS sin cama caliente siempre alabea. PLA necesita 55–65 °C mínimo.' },
      { title: 'Superficie de cama sucia o inadecuada', explanation: 'Grasa de dedos, polvo o una superficie desgastada rompen la adhesión. El plástico no se pega y se levanta.' },
      { title: 'Ventilador de capa demasiado agresivo', explanation: 'Enfriar las primeras capas muy rápido produce la misma contracción diferencial que el enfriamiento ambiental.' },
    ],
    solutions: [
      { step: 1, action: 'Limpia la cama con alcohol isopropílico al 90%+', detail: 'Usa un paño de microfibra limpio. No toques la cama con los dedos después de limpiarla.' },
      { step: 2, action: 'Sube la temperatura de cama 5–10 °C', detail: 'PLA: 60–70 °C. PETG: 80–85 °C. ABS: 100–110 °C. ASA: 100–115 °C.' },
      { step: 3, action: 'Aplica adhesivo de cama (3DLAC, pegamento de barra, laca)', detail: '3DLAC es el estándar en Chile. Aplícalo a 20–30 cm sobre la cama caliente en capa fina y uniforme.' },
      { step: 4, action: 'Añade brim de 5–10 mm en el slicer', detail: 'El brim aumenta el área de adhesión. Ideal para piezas altas y delgadas o con poco contacto de base.' },
      { step: 5, action: 'Cierra el entorno de la impresora (enclosure)', detail: 'ABS y ASA requieren temperatura ambiente constante ~40 °C. Una caja improvisada de cartón ya ayuda.' },
      { step: 6, action: 'Desactiva el ventilador en las primeras 3–5 capas', detail: 'En Cura: "Regular Fan Speed at Layer" = 3. En PrusaSlicer la opción está en Cooling.' },
    ],
    tips: [
      'Para ABS y ASA, imprime dentro de un enclosure y mantén la puerta cerrada durante toda la impresión.',
      'Las placas PEI (acero de resorte) son la mejor inversión: no necesitan adhesivo y tienen excelente adhesión en caliente + fácil liberación en frío.',
      'Orienta la pieza para minimizar la huella: a veces rotar 45° reduce el warping significativamente.',
    ],
    externalGuides: [
      { name: 'Simplify3D — Warping', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/#not-sticking-to-the-bed', lang: 'en' },
      { name: 'Prusa — Warping guide', url: 'https://help.prusa3d.com/article/warping_2011', lang: 'en' },
      { name: 'Bitfab — Alabeo', url: 'https://bitfab.io/es/blog/errores-impresion-3d/#warping', lang: 'es' },
    ],
  },
  {
    id: 'layer-shift',
    emoji: '↔️',
    label: 'Desplazamiento de capas',
    group: 'fdm',
    tagline: 'Las capas se desplazan horizontalmente',
    what: 'El layer shift es cuando las capas de la pieza se desplazan en el eje X o Y de manera abrupta. La parte superior de la pieza queda desalineada respecto a la inferior, como si alguien hubiera empujado la impresión a la mitad.',
    visualHint: 'La pieza tiene un "salto" horizontal visible. Las capas superiores están desplazadas respecto a las inferiores. Puede ser un solo desplazamiento grande o pequeños saltos acumulados.',
    causes: [
      { title: 'Correa floja o desgastada', explanation: 'Las correas GT2 transmiten el movimiento de los motores. Si están flojas, la inercia de la cabeza hace que se salte pasos.' },
      { title: 'Velocidad o aceleración demasiado alta', explanation: 'Movimientos muy bruscos generan fuerzas de inercia que los motores no pueden seguir. Los pasos se pierden y la posición cambia.' },
      { title: 'Obstáculo físico o colisión', explanation: 'La boquilla choca contra una parte de la pieza que se curvó (warping) o contra un blob de plástico, forzando un desplazamiento.' },
      { title: 'Motor paso a paso sobrecalentado', explanation: 'Los drivers de motor se desactivan temporalmente por temperatura. El motor queda libre y la posición se pierde.' },
      { title: 'Corriente de motor insuficiente', explanation: 'Con poca corriente, el motor no tiene torque suficiente para resistir la inercia de la cabeza en cambios de dirección rápidos.' },
    ],
    solutions: [
      { step: 1, action: 'Revisa y ajusta la tensión de las correas', detail: 'Pulsa la correa como guitarra: debe sonar entre 40–60 Hz. Muchas impresoras tienen tensores integrados. Si la correa está agrietada, reemplázala.' },
      { step: 2, action: 'Reduce velocidad al 80% y aceleración a 1500 mm/s²', detail: 'En Cura: Print Speed. En PrusaSlicer: Printer settings → Machine limits. Prueba reduciendo 20% cada vez.' },
      { step: 3, action: 'Activa Linear Advance o Pressure Advance', detail: 'Reduce cúmulos de plástico que causan colisiones. Disponible en Marlin (LA) y Klipper (PA).' },
      { step: 4, action: 'Verifica que las poleas (pulleys) estén bien fijadas', detail: 'Aprieta los dos tornillos Allen de cada polea, especialmente el que toca el eje plano del motor.' },
      { step: 5, action: 'Mejora la ventilación de los drivers', detail: 'Agrega un pequeño ventilador sobre los drivers de la placa. Los TMC2209 tienen protección térmica automática; si se activa, el motor se suelta.' },
    ],
    tips: [
      'Un layer shift único casi siempre es un obstáculo físico (blob, warping). Múltiples layer shifts son correa o drivers.',
      'Si tienes Klipper, activa resonance_compensation (Input Shaping) — elimina la mayoría de layer shifts por vibración.',
      'Revisa los rails y guías de deslizamiento: fricción excesiva también causa pérdida de pasos.',
    ],
    externalGuides: [
      { name: 'Simplify3D — Layer Shifting', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/#layer-shifting', lang: 'en' },
      { name: "Ellis' Guide — Layer Shifts", url: 'https://ellis3dp.com/Print-Tuning-Guide/', lang: 'en' },
    ],
  },
  {
    id: 'bad-adhesion',
    emoji: '🎯',
    label: 'Mala adhesión a la cama',
    group: 'fdm',
    tagline: 'La primera capa no se pega a la cama',
    what: 'La pieza no se adhiere a la cama de impresión durante la primera capa: el plástico se enrolla alrededor de la boquilla, queda suelto o se despega inmediatamente. Sin la primera capa correcta, el resto de la impresión falla.',
    visualHint: 'Filamento que se enrolla en la boquilla o queda suelto sobre la cama. La primera capa no se aplana — se ve como un cordón redondo en lugar de una banda achatada.',
    causes: [
      { title: 'Cama mal nivelada / Z offset incorrecto', explanation: 'Si la boquilla está muy alta, el plástico no se presiona contra la cama y no adhiere. Si está muy baja, rasca la superficie.' },
      { title: 'Superficie sucia', explanation: 'Aceite de los dedos, polvo o residuos del adhesivo anterior crean barreras que impiden la adhesión.' },
      { title: 'Temperatura de cama incorrecta', explanation: 'Cada material tiene un rango óptimo de cama. Por fuera de ese rango, la adhesión falla.' },
      { title: 'Primera capa demasiado rápida', explanation: 'A alta velocidad, el plástico no tiene tiempo de unirse a la superficie antes de que la boquilla siga adelante.' },
    ],
    solutions: [
      { step: 1, action: 'Nivela la cama manualmente con una hoja de papel', detail: 'La hoja debe deslizarse con una ligera resistencia bajo la boquilla. Ajusta las cuatro esquinas y el centro.' },
      { step: 2, action: 'Calibra el Z offset (Live Adjust Z)', detail: 'La primera capa debe verse "aplastada" y brillante. Si está redonda y suelta, baja el Z offset 0.05 mm a la vez.' },
      { step: 3, action: 'Limpia la cama con IPA 90%+ y paño de microfibra', detail: 'Hazlo justo antes de imprimir. No toques la cama después.' },
      { step: 4, action: 'Reduce la velocidad de la primera capa al 25–30%', detail: 'Cura: "Initial Layer Speed". PrusaSlicer: "First layer speed". Le da tiempo al plástico de adherirse.' },
      { step: 5, action: 'Sube la temperatura de cama 5 °C', detail: 'PLA: intenta 65 °C. PETG: 85 °C. El calor extra mejora la adhesión sin necesitar adhesivo.' },
    ],
    tips: [
      'El BLTouch o CR Touch automatiza la nivelación. Una inversión que vale la pena en camas grandes.',
      'PETG se adhiere muy bien al PEI en frío — a veces demasiado. Aplica una capa muy fina de adhesivo de barra como separador.',
      'Aumenta el "First layer height" al 120% en el slicer para más margen de error en la nivelación.',
    ],
    externalGuides: [
      { name: 'Teaching Tech — First Layer Calibration', url: 'https://teachingtechyt.github.io/calibration.html#firstlayer', lang: 'en' },
      { name: 'Prusa — First Layer Issues', url: 'https://help.prusa3d.com/article/first-layer-issues_1804', lang: 'en' },
    ],
  },
  {
    id: 'underextrusion',
    emoji: '📉',
    label: 'Sub-extrusión',
    group: 'fdm',
    tagline: 'La impresión deposita menos plástico del necesario',
    what: 'La sub-extrusión ocurre cuando la impresora deposita menos material del que el slicer calculó. Las capas quedan incompletas, hay huecos entre líneas de relleno, y la pieza es frágil o porosa.',
    visualHint: 'Huecos en las paredes, "puntos" o gaps visibles en el relleno, capas que se ven transparentes o ralas. Las líneas de perímetro no se fusionan entre sí.',
    causes: [
      { title: 'Boquilla parcialmente obstruida', explanation: 'Residuos de filamento carbonizado o polvo reducen el caudal efectivo sin bloquear completamente.' },
      { title: 'Temperatura de impresión baja', explanation: 'El plástico muy viscoso no fluye lo suficientemente rápido para mantener el caudal requerido.' },
      { title: 'E-steps mal calibrados', explanation: 'Si el extrusor avanza 10 mm de filamento pero en realidad solo mueve 9 mm, todo queda con defecto de 10%.' },
      { title: 'Velocidad de impresión excesiva', explanation: 'A alta velocidad se pide más caudal que el hotend puede fundir. El resultado es subextrusión intermitente.' },
      { title: 'Tensión de extrusor insuficiente', explanation: 'Si el extrusor no aprieta bien el filamento, el diente patina y el avance real es menor al ordenado.' },
    ],
    solutions: [
      { step: 1, action: 'Limpia la boquilla con un "cold pull"', detail: 'Calienta a temperatura de impresión, inserta nylon, deja enfriar a 90 °C y jala con fuerza. Repite 3 veces. El nylon arrastra los residuos.' },
      { step: 2, action: 'Calibra los E-steps del extrusor', detail: 'Marca 100 mm de filamento, ordena extrudir 100 mm, mide cuánto avanzó. Calcula: E-steps_nuevos = E-steps_actuales × 100 / mm_reales.' },
      { step: 3, action: 'Sube la temperatura 5–10 °C', detail: 'El plástico más fluido cubre mejor las líneas. Prueba con temp tower para encontrar el óptimo sin perder detalles.' },
      { step: 4, action: 'Sube el multiplicador de flujo (Flow Rate) al 102–105%', detail: 'Es una compensación temporal. La calibración de E-steps es la solución correcta a largo plazo.' },
      { step: 5, action: 'Ajusta la tensión del extrusor', detail: 'En extrusores de palanca (Bondtech, Orbiter), aprieta el tornillo de tensión media vuelta a la vez. Debe girar sin patinar pero sin marcar el filamento.' },
    ],
    tips: [
      'Imprime un cubo de calibración de extrusión (Calibration Cube) — si las paredes tienen huecos, hay sub-extrusión.',
      'Usa el porcentaje de flujo solo como corrección temporal; calibrar los E-steps es la solución real.',
      'El filamento muy fino (diámetro menor a tolerancia) también causa sub-extrusión — mídelo con pie de metro.',
    ],
    externalGuides: [
      { name: 'Teaching Tech — Extruder Calibration', url: 'https://teachingtechyt.github.io/calibration.html#esteps', lang: 'en' },
      { name: "Ellis' Guide — Extrusion Multiplier", url: 'https://ellis3dp.com/Print-Tuning-Guide/', lang: 'en' },
    ],
  },
  {
    id: 'overextrusion',
    emoji: '📈',
    label: 'Sobre-extrusión',
    group: 'fdm',
    tagline: 'Se deposita más plástico del necesario',
    what: 'La sobre-extrusión ocurre cuando se deposita más material del necesario. Las paredes quedan más gruesas de lo diseñado, hay plástico sobrante en esquinas y el acabado superficial es rugoso e irregular.',
    visualHint: 'Líneas de perímetro abultadas que se superponen, esquinas redondeadas o con "colmillos", capas superiores con exceso de material. La pieza puede ser más grande que las dimensiones del modelo.',
    causes: [
      { title: 'Multiplicador de flujo demasiado alto', explanation: 'Si configuraste >100% de flow sin necesidad, se deposita más plástico del calculado.' },
      { title: 'E-steps mal calibrados (exceso)', explanation: 'El extrusor avanza más filamento del ordenado. La raíz del problema es en el firmware.' },
      { title: 'Temperatura demasiado alta', explanation: 'El plástico muy fluido "escurre" y ocupa más espacio del calculado por el slicer.' },
      { title: 'Diámetro de filamento incorrecto en slicer', explanation: 'Si configuras 1.75 mm pero el filamento es 1.7 mm real, el slicer calcula de más.' },
    ],
    solutions: [
      { step: 1, action: 'Verifica y calibra los E-steps', detail: 'Ver solución de sub-extrusión paso 2 — el mismo procedimiento aplica.' },
      { step: 2, action: 'Baja el multiplicador de flujo al 98–100%', detail: 'En Cura: "Flow". En PrusaSlicer: "Extrusion multiplier". Solo ajusta si los E-steps ya están calibrados.' },
      { step: 3, action: 'Mide el diámetro real del filamento', detail: 'Usa un calibrador Vernier/digital. Mide en 5 puntos distintos. Ingresa el promedio en el slicer.' },
      { step: 4, action: 'Baja la temperatura 5 °C', detail: 'Especialmente si el exceso ocurre solo en esquinas (oozing en cambios de dirección).' },
    ],
    tips: [
      'Imprime un cubo de pared única (Single Wall Cube). Mide el grosor con calibrador. Debe coincidir con el ancho de línea configurado (ej. 0.4 mm).',
      'La sobre-extrusión leve es preferible a la sub-extrusión para piezas estructurales. Ajusta según el uso.',
    ],
    externalGuides: [
      { name: 'Simplify3D — Over-Extrusion', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/#over-extrusion', lang: 'en' },
    ],
  },
  {
    id: 'elephant-foot',
    emoji: '🐘',
    label: 'Pata de elefante',
    group: 'fdm',
    tagline: 'La base de la pieza queda más ancha que el modelo',
    what: 'La "pata de elefante" es cuando la primera o primeras capas se ensanchan más allá de las dimensiones del modelo. La base de la pieza sobresale como si fuera la pata de un elefante, afectando tolerancias y ajustes.',
    visualHint: 'Primera capa visiblemente más ancha que el resto de la pieza. Vista lateral muestra un ensanchamiento en la base. Hace que piezas con huecos o ajustes no encajen correctamente.',
    causes: [
      { title: 'Z offset demasiado bajo (boquilla muy cerca)', explanation: 'El plástico es aplastado por la boquilla y se expande lateralmente más de lo normal.' },
      { title: 'Temperatura de cama muy alta', explanation: 'La cama mantiene el plástico de la primera capa fundido por más tiempo, permitiendo que fluya hacia los lados.' },
      { title: 'Primera capa demasiado lenta', explanation: 'Más tiempo en contacto con la cama caliente = más tiempo para que el plástico se expanda.' },
    ],
    solutions: [
      { step: 1, action: 'Sube el Z offset 0.05 mm a la vez', detail: 'La primera capa debe verse ligeramente aplastada pero sin "explotarse" hacia los lados.' },
      { step: 2, action: 'Baja la temperatura de cama 5 °C', detail: 'Prueba bajar de 65 °C a 60 °C para PLA. Comprueba que no se pierda adhesión.' },
      { step: 3, action: 'Activa "Elephant Foot Compensation" en el slicer', detail: 'PrusaSlicer lo tiene nativo. En Cura se llama "Initial Layer Horizontal Expansion" — usa valores negativos como -0.2 mm.' },
      { step: 4, action: 'Sube la velocidad de la primera capa al 40–50%', detail: 'Menos tiempo para que el plástico se expanda. Mantén la adhesión suficiente.' },
    ],
    tips: [
      'Para piezas de precisión (engranajes, uniones), siempre activa la compensación de pata de elefante.',
      'El equilibrio es: suficiente adhesión sin deformación. Itera el Z offset en pasos de 0.05 mm.',
    ],
    externalGuides: [
      { name: 'All3DP — Elephant Foot', url: 'https://all3dp.com/2/elephant-foot-3d-printing-all-you-need-to-know/', lang: 'en' },
    ],
  },
  {
    id: 'delamination',
    emoji: '📄',
    label: 'Capas separadas',
    group: 'fdm',
    tagline: 'Las capas se despegan o separan entre sí',
    what: 'La deslaminación o separación de capas ocurre cuando las capas de la pieza no se fusionan correctamente y se separan. La pieza pierde resistencia estructural y puede desmoronarse con facilidad.',
    visualHint: 'Grietas horizontales visibles entre capas. La pieza se puede separar a mano siguiendo los planos de las capas. En casos severos, las capas se separan solas durante la impresión.',
    causes: [
      { title: 'Temperatura de impresión insuficiente', explanation: 'El plástico no está lo suficientemente fundido para fusionarse con la capa anterior.' },
      { title: 'Altura de capa demasiado alta', explanation: 'Si la altura de capa supera el 80% del diámetro de boquilla, las capas no se superponen suficientemente.' },
      { title: 'Enfriamiento excesivo', explanation: 'La capa anterior se enfrió antes de que la nueva capa la toque. No hay fusión posible.' },
      { title: 'Velocidad de impresión excesiva', explanation: 'A alta velocidad, el plástico no tiene tiempo de unirse correctamente a la capa anterior.' },
    ],
    solutions: [
      { step: 1, action: 'Sube la temperatura de impresión 10 °C', detail: 'Prueba 15–20 °C sobre el valor habitual. Para ABS, 250 °C. Para PLA, hasta 225 °C. Verifica que no aumente el stringing.' },
      { step: 2, action: 'Reduce la altura de capa al 60–70% del diámetro de boquilla', detail: 'Con boquilla de 0.4 mm: usa capas de 0.2–0.24 mm máximo para buena adhesión.' },
      { step: 3, action: 'Reduce la velocidad del ventilador al 50–70%', detail: 'Especialmente útil para ABS y ASA, que necesitan enfriamiento lento.' },
      { step: 4, action: 'Sube el multiplicador de flujo al 103–105%', detail: 'Más material mejora la fusión entre capas. Combina con temperatura para mejor resultado.' },
    ],
    tips: [
      'La deslaminación en ABS casi siempre se soluciona con enclosure y temperatura de cama a 105–110 °C.',
      'Reduce el ventilador de capa para los primeros 5 mm de la pieza donde la resistencia es crítica.',
      'Aumenta el número de perímetros (walls): 3–4 perímetros dan mucha más resistencia que 2.',
    ],
    externalGuides: [
      { name: 'Simplify3D — Layer Separation', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/#layer-separation-and-splitting', lang: 'en' },
      { name: 'MatterHackers — Delamination', url: 'https://www.matterhackers.com/articles/3d-printer-troubleshooting-guide', lang: 'en' },
    ],
  },
  {
    id: 'clog',
    emoji: '🔩',
    label: 'Boquilla atascada',
    group: 'fdm',
    tagline: 'El filamento no puede pasar o sale con dificultad',
    what: 'Un atasco o clog es la obstrucción total o parcial del hotend. El extrusor intenta empujar filamento pero no puede o casi no puede. La impresión falla, el extrusor "clica" audiblemente y puede dañarse.',
    visualHint: 'El extrusor hace clic repetidos (skipping). La pieza tiene capas faltantes que se vuelven más graves con el tiempo. En atasco total, no sale nada de la boquilla.',
    causes: [
      { title: 'Temperatura demasiado baja', explanation: 'El plástico no se funde completamente y se acumula en la boquilla.' },
      { title: 'Filamento quemado dentro del hotend', explanation: 'Temperaturas muy altas o pausas largas queman el plástico, que se pega a las paredes internas.' },
      { title: 'Tubo PTFE degradado', explanation: 'El tubo de teflón puede carbonizarse a >240 °C y obstruir el hotend en impresoras all-metal.' },
      { title: 'Partículas de polvo o suciedad', explanation: 'Filamentos de madera, metal o fibra de carbono desgastan la boquilla de acero. Requieren boquillas endurecidas.' },
    ],
    solutions: [
      { step: 1, action: 'Realiza un "Cold Pull" (atomic pull)', detail: 'Calienta a 200 °C → inserta nylon o PETG → enfría a 90 °C → jala con fuerza. El filamento arrastra los residuos. Repite 3–5 veces.' },
      { step: 2, action: 'Sube la temperatura 20 °C e intenta extrudir manualmente', detail: 'A veces el plástico retenido se re-funde. Empuja el filamento manualmente mientras la impresora extruye despacio.' },
      { step: 3, action: 'Limpia la boquilla externamente con cepillo de latón', detail: 'Mientras está caliente, elimina el plástico pegado en el exterior. Nunca uses herramientas de acero sobre latón.' },
      { step: 4, action: 'Reemplaza la boquilla si los métodos anteriores fallan', detail: 'Una boquilla de latón cuesta 1–3 USD. Vale más la pena reemplazarla que gastar horas intentando limpiarla.' },
      { step: 5, action: 'Inspecciona y reemplaza el tubo PTFE', detail: 'Si tiene color café/negro en la zona del hotend, está degradado. Reemplaza por Capricorn XS para mayor resistencia térmica.' },
    ],
    tips: [
      'Después de cada impresión larga, sube la temperatura 20 °C y extruye 20 mm para purgar residuos antes de enfriar.',
      'Para filamentos abrasivos (metal, madera, fibra de carbono), usa boquillas de acero endurecido o tungsteno.',
      'Guarda las boquillas usadas en un frasco con acetona si son de acero — limpia los residuos de ABS.',
    ],
    externalGuides: [
      { name: 'Prusa — Clogged Nozzle', url: 'https://help.prusa3d.com/article/clogged-nozzle-hotend_2011', lang: 'en' },
      { name: 'All3DP — How to Unclog a 3D Printer Nozzle', url: 'https://all3dp.com/2/unclog-3d-printer-nozzle/', lang: 'en' },
    ],
  },
  {
    id: 'first-layer',
    emoji: '🔵',
    label: 'Primera capa mala',
    group: 'fdm',
    tagline: 'La primera capa tiene problemas de calidad o adhesión',
    what: 'Una primera capa deficiente es la raíz de la mayoría de los fallos de impresión. Puede manifestarse como falta de adhesión, sobre-aplastamiento, líneas separadas, o superficie rugosa irregular.',
    visualHint: 'La primera capa tiene huecos entre líneas, o está tan aplastada que se forma una masa brillante sin líneas visibles. Las esquinas pueden levantarse incluso en la primera capa.',
    causes: [
      { title: 'Z offset incorrecto', explanation: 'Demasiado alto: plástico sin presión no adhiere. Demasiado bajo: el plástico se aplana en exceso o rasca la cama.' },
      { title: 'Cama desnivelada', explanation: 'Si un lado está más alto que el otro, el Z offset correcto para un lado es incorrecto para el otro.' },
      { title: 'Temperatura de cama incorrecta', explanation: 'Fuera del rango óptimo del material, la adhesión de la primera capa falla.' },
    ],
    solutions: [
      { step: 1, action: 'Ejecuta la rutina de nivelación de cama', detail: 'Hazlo siempre en caliente (cama y hotend a temperatura de impresión). La expansión térmica cambia el nivelado.' },
      { step: 2, action: 'Calibra el Z offset con Live Adjust Z', detail: 'La primera capa ideal: líneas ligeramente aplastadas y juntas, sin huecos, sin exceso. Ajusta de 0.05 mm en 0.05 mm.' },
      { step: 3, action: 'Imprime a 25% de velocidad en la primera capa', detail: 'A menor velocidad, el plástico tiene más tiempo para adherirse y el margen de error es mayor.' },
      { step: 4, action: 'Usa la función "Live Adjust" mientras imprime la primera capa', detail: 'No esperes a que falle — ajusta el Z en tiempo real durante los primeros minutos de impresión.' },
    ],
    tips: [
      'Antes de imprimir siempre pre-calienta la cama 5–10 minutos para que alcance temperatura uniforme.',
      'Guarda el Z offset en la EEPROM de la impresora para no perderlo entre impresiones.',
    ],
    externalGuides: [
      { name: 'Teaching Tech — First Layer', url: 'https://teachingtechyt.github.io/calibration.html#firstlayer', lang: 'en' },
      { name: 'Bitfab — Primera capa', url: 'https://bitfab.io/es/blog/errores-impresion-3d/', lang: 'es' },
    ],
  },
  {
    id: 'surface-lines',
    emoji: '〰️',
    label: 'Líneas en superficie',
    group: 'fdm',
    tagline: 'La superficie de la pieza tiene líneas u ondas visibles',
    what: 'Las líneas o bandas horizontales visibles en las capas de la pieza, o las ondas (ringing/ghosting) que aparecen después de esquinas y cambios de dirección. Hay dos tipos: bandas regulares por problemas mecánicos, y ghosting por vibraciones.',
    visualHint: 'Bandas horizontales cada cierta cantidad de capas (Z wobble), o patrón de ondas tipo "eco" que aparece después de esquinas pronunciadas (ghosting/ringing).',
    causes: [
      { title: 'Z wobble — eje Z con vibración', explanation: 'El tornillo de avance (leadscrew) tiene curvatura o la tuerca del eje está floja. Produce bandas periódicas.' },
      { title: 'Ghosting / Ringing — vibraciones de la estructura', explanation: 'Al cambiar de dirección bruscamente, la estructura de la impresora vibra. Las ondas quedan impresas en la superficie.' },
      { title: 'Flujo inconsistente', explanation: 'Filamento con diámetro variable o temperatura de hotend inestable cambia el caudal y crea capas de grosor diferente.' },
    ],
    solutions: [
      { step: 1, action: 'Reduce la aceleración a 500–1000 mm/s²', detail: 'Menos inercia = menos vibración. Es la solución más rápida para el ghosting.' },
      { step: 2, action: 'Activa Input Shaping (Klipper) o Resonance Compensation (Marlin)', detail: 'Estas funciones cancelan las frecuencias de resonancia de la impresora. Requieren acelerómetro (ADXL345).' },
      { step: 3, action: 'Ajusta y centra el leadscrew del eje Z', detail: 'El tornillo no debe estar bajo tensión lateral. Las tuercas de acoplamiento deben estar libres de jugar levemente.' },
      { step: 4, action: 'Seca el filamento y verifica diámetro', detail: 'El filamento húmedo o con diámetro irregular produce capas inconsistentes.' },
    ],
    tips: [
      'Imprime un "Ringing Tower" (torture test de ghosting) para medir el efecto antes y después de ajustes.',
      'Aprieta todos los tornillos de la estructura de la impresora. El movimiento libre de paneles amplifica las vibraciones.',
    ],
    externalGuides: [
      { name: "Ellis' Guide — Ringing / Ghosting", url: 'https://ellis3dp.com/Print-Tuning-Guide/', lang: 'en' },
      { name: 'Klipper — Resonance Compensation', url: 'https://www.klipper3d.org/Resonance_Compensation.html', lang: 'en' },
    ],
  },
  {
    id: 'supports',
    emoji: '🏗️',
    label: 'Soportes difíciles de quitar',
    group: 'fdm',
    tagline: 'Los soportes se pegan a la pieza o dejan marcas',
    what: 'Los soportes son estructuras temporales que sostienen voladizos y puentes durante la impresión. Cuando quedan muy pegados a la pieza, el removido deja marcas, daña la superficie o es imposible sin herramientas.',
    visualHint: 'Soportes que necesitan fuerza excesiva para removerse, o que dejan una superficie rugosa/marcada donde contactaban la pieza. En el peor caso, arrancan material de la pieza.',
    causes: [
      { title: 'Distancia Z de soporte demasiado pequeña', explanation: 'Si el soporte toca demasiado cerca la pieza, el plástico se fusiona entre ellos.' },
      { title: 'Temperatura de impresión alta en zona de soporte', explanation: 'A alta temperatura, más fusión entre soporte y pieza.' },
      { title: 'Tipo de soporte incorrecto', explanation: 'Soportes normales pueden ser reemplazados por soportes árbol que tocan menos superficie.' },
    ],
    solutions: [
      { step: 1, action: 'Aumenta "Support Z Distance" a 0.2–0.3 mm', detail: 'En Cura y PrusaSlicer. Este espacio crea una separación que facilita el removido sin fusión.' },
      { step: 2, action: 'Cambia a soportes tipo árbol (Tree Supports)', detail: 'Los tree supports tocan menos área de la pieza. Ideales para formas orgánicas y complejas.' },
      { step: 3, action: 'Usa filamento PVA o HIPS como material de soporte', detail: 'PVA se disuelve en agua, HIPS en limoneno. Requiere impresora multimaterial o dual extrusor.' },
      { step: 4, action: 'Reduce la densidad del soporte al 10–15%', detail: 'Soportes más ligeros son más fáciles de remover y dejan menos marca.' },
      { step: 5, action: 'Rediseña la orientación de la pieza para minimizar voladizos', detail: 'Rotar la pieza 45° o 90° puede eliminar la necesidad de soportes completamente.' },
    ],
    tips: [
      'Los voladizos de hasta 45° generalmente no necesitan soporte en la mayoría de materiales.',
      'Herramientas útiles: pinzas de punta, bisturí, cortafríos pequeño. El kit de herramientas de post-procesado es indispensable.',
      'En PrusaSlicer, los "Enforcers" y "Blockers" de soporte dan control preciso sobre dónde se generan.',
    ],
    externalGuides: [
      { name: 'All3DP — 3D Print Supports Guide', url: 'https://all3dp.com/1/3d-printing-support-structures/', lang: 'en' },
      { name: 'Simplify3D — Support Material', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/#support-material', lang: 'en' },
    ],
  },
  // ── Resin ─────────────────────────────────────────────────────────────────
  {
    id: 'resin-fail-bed',
    emoji: '🧪',
    label: 'Resina: no adhiere a la cama',
    group: 'resin',
    tagline: 'La pieza no se pega a la plataforma de impresión',
    what: 'En impresoras de resina (MSLA/DLP), la pieza crece hacia arriba adherida a la plataforma. Si no adhiere, la resina curada queda pegada en el FEP/nFEP del vat y la plataforma sube vacía.',
    visualHint: 'La plataforma sube vacía, sin pieza. Al revisar el vat, hay una lámina de resina curada pegada al FEP. En casos parciales, solo parte de la pieza queda en la plataforma.',
    causes: [
      { title: 'Bottom exposure time insuficiente', explanation: 'Las primeras capas necesitan 3–6x más exposición que las capas normales para anclarse a la plataforma.' },
      { title: 'Plataforma de impresión mal nivelada', explanation: 'Si no está paralela al FEP, el UV no llega uniformemente y algunas zonas no adhieren.' },
      { title: 'Temperatura del vat/resina baja', explanation: 'Por debajo de 20 °C la resina es más viscosa y la fotopolimerización es menos eficiente.' },
      { title: 'Plataforma sucia o muy lisa', explanation: 'La primera adhesión necesita rugosidad. También la contaminación con resina curada anterior.' },
    ],
    solutions: [
      { step: 1, action: 'Aumenta el Bottom Exposure Time al doble', detail: 'Si el normal es 2 s, prueba con 40–60 s para bottom layers. Usa el exposure finder de Chepclub/AmeraLabs.' },
      { step: 2, action: 'Re-nivela la plataforma con la hoja de papel', detail: 'Afloja la plataforma, bájala hasta el FEP con un papel en medio. Aprieta que la hoja tenga resistencia uniforme en todos los ángulos.' },
      { step: 3, action: 'Calienta la resina a 25–30 °C', detail: 'Usa una bolsa de agua caliente alrededor del vat 10 minutos antes. O imprime en ambiente calefaccionado.' },
      { step: 4, action: 'Lija suavemente la plataforma con lija 400', detail: 'Crea micro-rugosidad que mejora la adhesión mecánica. Limpia bien con IPA después.' },
    ],
    tips: [
      'El "Exposure Finder" de AmeraLabs (Matrix test) es la forma más eficiente de calibrar exposición para tu resina específica.',
      'Agita la resina en el vat antes de cada impresión para homogeneizar el pigmento.',
      'Las resinas ABS-Like generalmente necesitan menos tiempo de exposición que las estándar — consulta la hoja de datos.',
    ],
    externalGuides: [
      { name: 'AmeraLabs — Calibration Test', url: 'https://ameralabs.com/blog/ameralabs-town-calibration-test/', lang: 'en' },
      { name: 'Chitubox — Troubleshooting', url: 'https://www.chitubox.com/en/article/support/howto/chitubox-free/troubleshooting', lang: 'en' },
    ],
  },
  {
    id: 'resin-bubbles',
    emoji: '🫧',
    label: 'Resina: burbujas',
    group: 'resin',
    tagline: 'Burbujas de aire en la pieza o en el vat',
    what: 'Las burbujas en impresión de resina aparecen como huecos esféricos en la superficie o interior de la pieza, o como microburbujas en el vat que afectan la calidad superficial y la translucidez.',
    visualHint: 'Pequeños hoyos esféricos en la superficie de la pieza. En piezas transparentes, microburbujas internas que reducen la claridad. Burbujas visibles en la resina del vat.',
    causes: [
      { title: 'Resina agitada con aire atrapado', explanation: 'Al mezclar la resina antes de imprimir, se pueden introducir burbujas de aire que quedan atrapadas.' },
      { title: 'Temperatura de resina baja', explanation: 'La resina fría es más viscosa y retiene mejor las burbujas de aire.' },
      { title: 'Capas de ventilación insuficientes (suction cups)', explanation: 'Las grandes áreas planas sin huecos crean succión al despegarse del FEP, y el aire entra abruptamente.' },
      { title: 'FEP con daños o turbiedad', explanation: 'El FEP desgastado dispersa la luz UV de manera irregular y puede crear zonas de curado desigual.' },
    ],
    solutions: [
      { step: 1, action: 'Agita la resina lentamente en movimiento circular, sin batir', detail: 'Mueve la espátula en círculos desde el fondo. Evita movimientos bruscos que introduzcan aire.' },
      { step: 2, action: 'Calienta la resina a 25–28 °C antes de imprimir', detail: 'La resina tibia es menos viscosa y las burbujas ascienden y desaparecen.' },
      { step: 3, action: 'Añade agujeros de ventilación en zonas planas del modelo', detail: 'En el slicer o en el modelo 3D, agrega perforaciones de 2–3 mm para romper el sello de succión.' },
      { step: 4, action: 'Revisa el estado del FEP', detail: 'El FEP debe ser claro y sin rayaduras. Reemplázalo si está opaco o con marcas de piezas anteriores.' },
    ],
    tips: [
      'Deja reposar la resina 5–10 minutos después de agitar para que las burbujas asciendan.',
      'Los modelos vaciados con agujeros de drenaje necesitan siempre ventilación en la parte inferior para evitar succión.',
    ],
    externalGuides: [
      { name: 'AmeraLabs — Resin Troubleshooting', url: 'https://ameralabs.com/blog/resin-3d-printing-troubleshooting/', lang: 'en' },
      { name: 'Formlabs — Print Defects', url: 'https://support.formlabs.com/s/article/Print-Defects', lang: 'en' },
    ],
  },
  {
    id: 'resin-suction',
    emoji: '💧',
    label: 'Resina: efecto ventosa',
    group: 'resin',
    tagline: 'Piezas con superficies planas generan succión al despegarse',
    what: 'El efecto ventosa (suction cup effect) ocurre cuando una superficie plana y cerrada se pega al FEP por succión al subir la plataforma. Puede arrancar la pieza de la plataforma, deformarla o dañar el FEP.',
    visualHint: 'Partes de la pieza que se desprenden y quedan en el FEP (especialmente secciones planas sobre cavidades cerradas). El vat hace un sonido de succión fuerte al separarse.',
    causes: [
      { title: 'Superficies horizontales cerradas sin ventilación', explanation: 'Al subir la plataforma, el sellado entre FEP y pieza crea una presión negativa intensa.' },
      { title: 'Velocidad de lift (ascenso) demasiado alta', explanation: 'A mayor velocidad, la fuerza de succión es más grande porque no hay tiempo para que la resina llene el espacio.' },
    ],
    solutions: [
      { step: 1, action: 'Agrega agujeros de ventilación de 2–4 mm en zonas planas', detail: 'Colócalos en la parte más alta de cada cavidad cerrada. Permiten que la resina fluya y rompe el vacío.' },
      { step: 2, action: 'Reduce el Lift Speed a 40–60 mm/min', detail: 'Una separación más lenta da tiempo para que la resina llene el espacio y la succión sea gradual.' },
      { step: 3, action: 'Inclina la pieza 10–15° en el slicer', detail: 'Las superficies inclinadas no crean sello perfecto. La succión se rompe progresivamente.' },
      { step: 4, action: 'Activa anti-suction en el slicer si está disponible', detail: 'Algunos slicers (Chitubox Pro) tienen algoritmos que añaden ventilación automáticamente.' },
    ],
    tips: [
      'El vaciado de modelos sólidos (hollow) reduce el peso de resina y la fuerza de succión a la vez.',
      'Los modelos vaciados deben siempre tener agujeros de drenaje para limpiar la resina no curada del interior.',
    ],
    externalGuides: [
      { name: 'AmeraLabs — Suction Cup Effect', url: 'https://ameralabs.com/blog/resin-3d-printing-troubleshooting/', lang: 'en' },
    ],
  },
  {
    id: 'resin-supports',
    emoji: '⛓️',
    label: 'Resina: fallo de soportes',
    group: 'resin',
    tagline: 'Los soportes se rompen y la pieza se desprende',
    what: 'En resina, los soportes son pilares de 0.3–0.8 mm que sostienen las partes que no tocan la plataforma. Si fallan, esa parte queda suelta y se daña o cae al vat.',
    visualHint: 'Partes de la pieza con deformación, ausentes o pegadas al FEP. Resina curada flotando en el vat (islas). La parte superior puede verse correcta mientras la inferior falta.',
    causes: [
      { title: 'Soportes muy delgados o con densidad insuficiente', explanation: 'Si el área de la pieza es grande y los soportes son pocos o muy finos, no pueden resistir la fuerza de separación del FEP.' },
      { title: 'Punto de contacto (tip) demasiado pequeño', explanation: 'El tip es el punto donde el soporte toca la pieza. Si es muy pequeño, se rompe bajo la tensión de lift.' },
      { title: 'Exposición normal insuficiente', explanation: 'Si las capas no están bien curadas, los soportes son frágiles y se rompen fácilmente.' },
      { title: 'Inclinación de la pieza incorrecta', explanation: 'Una pieza casi horizontal genera enormes áreas de contacto con el FEP y fuerzas de separación muy altas.' },
    ],
    solutions: [
      { step: 1, action: 'Aumenta la densidad de soportes al 70–80%', detail: 'Más soportes distribuyen la fuerza de separación. Especialmente en piezas con grandes superficies horizontales.' },
      { step: 2, action: 'Usa soportes medianos o pesados (medium/heavy)', detail: 'El diámetro del soporte determina su resistencia. Para piezas grandes, usa 0.6–0.8 mm de diámetro.' },
      { step: 3, action: 'Inclina la pieza 30–45° en el slicer', detail: 'Inclinar la pieza reduce el área de contacto por capa y la fuerza de separación necesaria.' },
      { step: 4, action: 'Verifica y ajusta los tiempos de exposición', detail: 'Usa el Exposure Matrix de AmeraLabs para encontrar la exposición correcta para tu resina.' },
      { step: 5, action: 'Agrega soportes manuales en zonas críticas', detail: 'El auto-soporte no es perfecto. Revisa visualmente el sliceado y agrega soportes manuales donde vengas bordes sueltos.' },
    ],
    tips: [
      'Apoya siempre las áreas más pesadas de la pieza directamente desde la plataforma.',
      'Imprime pequeñas piezas de prueba primero para calibrar la densidad de soportes de tu resina específica.',
    ],
    externalGuides: [
      { name: 'AmeraLabs — Supports Guide', url: 'https://ameralabs.com/blog/resin-3d-printing-troubleshooting/', lang: 'en' },
      { name: 'Chitubox — Support Settings', url: 'https://www.chitubox.com/en/article/support/howto/chitubox-free/troubleshooting', lang: 'en' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-guias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './guias.component.html',
  styleUrl: './guias.component.scss',
})
export class GuiasComponent {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  readonly fdmProblems = PROBLEMS.filter(p => p.group === 'fdm');
  readonly resinProblems = PROBLEMS.filter(p => p.group === 'resin');
  readonly allProblems = PROBLEMS;

  readonly activeId = signal<string | null>(null);

  readonly activeProblem = computed(() => {
    const id = this.activeId();
    return id ? PROBLEMS.find(p => p.id === id) ?? null : null;
  });

  constructor() {
    this.titleService.setTitle('Guías y Soluciones — Impresión 3D — 3DPrecios');
    this.meta.updateTag({
      name: 'description',
      content:
        'Enciclopedia completa de problemas de impresión 3D: causas, soluciones paso a paso e ilustraciones. ' +
        'Stringing, warping, layer shift, capas separadas, fallo de resina y más.',
    });

    const route = inject(ActivatedRoute);
    afterNextRender(() => {
      route.fragment.subscribe(fragment => {
        if (fragment) {
          const el = this.doc.getElementById(fragment);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (PROBLEMS.some(p => p.id === fragment)) {
              this.activeId.set(fragment);
            }
          }
        }
      });
    });
  }

  select(id: string): void {
    const prev = this.activeId();
    this.activeId.set(prev === id ? null : id);
    if (prev !== id) {
      afterNextRender(() => {
        this.doc.getElementById('problem-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  clearSelection(): void {
    this.activeId.set(null);
  }
}
