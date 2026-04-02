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

export interface Symptom {
  id: string;
  emoji: string;
  label: string;
}

export interface GuideEntry {
  name: string;
  url: string;
  description: string;
  lang: 'es' | 'en';
  difficulty: 'principiante' | 'intermedio' | 'experto';
  symptoms: string[];
}

export interface GuideCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  guides: GuideEntry[];
}

const SYMPTOMS: Symptom[] = [
  { id: 'stringing',      emoji: '🕸️',  label: 'Hilos / Stringing' },
  { id: 'warping',        emoji: '🌀',  label: 'Alabeo / Warping' },
  { id: 'layer-shift',    emoji: '↔️',  label: 'Desplazamiento de capas' },
  { id: 'bad-adhesion',   emoji: '🎯',  label: 'Mala adhesión a la cama' },
  { id: 'underextrusion', emoji: '📉',  label: 'Sub-extrusión' },
  { id: 'overextrusion',  emoji: '📈',  label: 'Sobre-extrusión' },
  { id: 'elephant-foot',  emoji: '🐘',  label: 'Piel de elefante' },
  { id: 'delamination',   emoji: '📄',  label: 'Capas separadas' },
  { id: 'clog',           emoji: '🔩',  label: 'Boquilla atascada' },
  { id: 'first-layer',    emoji: '🔵',  label: 'Primera capa mala' },
  { id: 'surface-lines',  emoji: '〰️', label: 'Líneas en superficie' },
  { id: 'supports',       emoji: '🏗️', label: 'Soportes difíciles' },
  { id: 'resin-fail-bed', emoji: '🧪',  label: 'Resina: no adhiere' },
  { id: 'resin-bubbles',  emoji: '🫧',  label: 'Resina: burbujas' },
  { id: 'resin-suction',  emoji: '💧',  label: 'Resina: ventosas' },
  { id: 'resin-supports', emoji: '⛓️', label: 'Resina: fallo de soportes' },
];

const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: 'biblias-fdm',
    icon: '📚',
    title: 'Guías Visuales FDM — Las Biblias',
    description:
      'Los recursos más completos y visuales para diagnosticar fallos en impresoras FDM/FFF. Cada problema explicado con fotografías reales.',
    guides: [
      {
        name: 'Simplify3D — Print Quality Troubleshooting',
        url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/',
        description:
          'La guía visual más famosa de la industria. Fotografías reales de cada fallo con acciones correctivas claras y ordenadas.',
        lang: 'en',
        difficulty: 'principiante',
        symptoms: [
          'stringing', 'warping', 'layer-shift', 'bad-adhesion', 'underextrusion',
          'overextrusion', 'elephant-foot', 'delamination', 'clog', 'first-layer',
          'surface-lines', 'supports',
        ],
      },
      {
        name: 'All3DP — 3D Printing Troubleshooting (2026)',
        url: 'https://all3dp.com/1/common-3d-printing-problems-troubleshooting-3d-printer-issues/',
        description:
          'Más de 40 problemas comunes con soluciones paso a paso. Actualizada regularmente, ideal para empezar.',
        lang: 'en',
        difficulty: 'principiante',
        symptoms: [
          'stringing', 'warping', 'layer-shift', 'bad-adhesion', 'underextrusion',
          'overextrusion', 'elephant-foot', 'delamination', 'clog', 'first-layer',
          'surface-lines', 'supports',
        ],
      },
      {
        name: 'MatterHackers — 3D Printer Troubleshooting',
        url: 'https://www.matterhackers.com/articles/3d-printer-troubleshooting-guide',
        description:
          'Explica cómo PLA, ABS y Nylon reaccionan distinto ante el mismo fallo. Enfocada en el comportamiento de los materiales.',
        lang: 'en',
        difficulty: 'intermedio',
        symptoms: ['stringing', 'warping', 'bad-adhesion', 'underextrusion', 'delamination', 'clog'],
      },
    ],
  },
  {
    id: 'resina',
    icon: '🧪',
    title: 'Especialistas en Resina (SLA / DLP / LCD)',
    description:
      'Fallos específicos de resina: ventosas, fallo de soportes por viscosidad, temperaturas de curado y química de pantallas.',
    guides: [
      {
        name: 'AmeraLabs — Resin 3D Printing Troubleshooting',
        url: 'https://ameralabs.com/blog/resin-3d-printing-troubleshooting/',
        description:
          'La guía más profunda sobre química de resinas y fallos mecánicos en pantallas LCD. Incluye pruebas de exposición.',
        lang: 'en',
        difficulty: 'intermedio',
        symptoms: ['resin-fail-bed', 'resin-bubbles', 'resin-suction', 'resin-supports', 'delamination'],
      },
      {
        name: 'Formlabs — Print Defects Guide',
        url: 'https://support.formlabs.com/s/article/Print-Defects',
        description:
          'Documentación técnica sobre la física del despegue y el curado UV. 100% aplicable a cualquier impresora de resina.',
        lang: 'en',
        difficulty: 'intermedio',
        symptoms: ['resin-fail-bed', 'resin-suction', 'resin-supports', 'delamination'],
      },
      {
        name: 'Chitubox Help Center — Troubleshooting',
        url: 'https://www.chitubox.com/en/article/support/howto/chitubox-free/troubleshooting',
        description:
          'Cómo el slicer influye en los errores: parámetros de exposición, anti-aliasing y configuración de soportes.',
        lang: 'en',
        difficulty: 'intermedio',
        symptoms: ['resin-fail-bed', 'resin-supports'],
      },
    ],
  },
  {
    id: 'calibracion',
    icon: '⚙️',
    title: 'Calibración y Nivel Experto',
    description:
      'Para entender la raíz del problema mediante pruebas controladas. Ajuste de flujo, aceleración, resonancia y Pressure Advance.',
    guides: [
      {
        name: 'Teaching Tech — 3D Printer Calibration',
        url: 'https://teachingtechyt.github.io/calibration.html',
        description:
          'Sitio interactivo guiado paso a paso. Cubre desde la primera capa hasta la calibración de aceleración e Input Shaping.',
        lang: 'en',
        difficulty: 'intermedio',
        symptoms: ['bad-adhesion', 'first-layer', 'overextrusion', 'underextrusion', 'surface-lines', 'stringing'],
      },
      {
        name: "Ellis' Print Tuning Guide",
        url: 'https://ellis3dp.com/Print-Tuning-Guide/',
        description:
          'La guía definitiva para Voron, Klipper y máquinas avanzadas. Cubre Pressure Advance, extrusion multiplier y más.',
        lang: 'en',
        difficulty: 'experto',
        symptoms: [
          'stringing', 'layer-shift', 'overextrusion', 'underextrusion',
          'surface-lines', 'elephant-foot', 'first-layer',
        ],
      },
    ],
  },
  {
    id: 'referencias',
    icon: '📖',
    title: 'Wikis y Referencia Oficial',
    description:
      'Bases de conocimiento mantenidas por los fabricantes. Terminología, parámetros de slicer y soluciones por modelo.',
    guides: [
      {
        name: 'Prusa Knowledge Base',
        url: 'https://help.prusa3d.com/',
        description:
          'Base de conocimiento oficial de Prusa Research. Aplica a cualquier impresora FDM, no solo modelos Prusa.',
        lang: 'en',
        difficulty: 'principiante',
        symptoms: ['stringing', 'warping', 'bad-adhesion', 'underextrusion', 'clog', 'first-layer', 'layer-shift'],
      },
      {
        name: 'Bambu Lab Wiki',
        url: 'https://wiki.bambulab.com/',
        description:
          'Documentación oficial de Bambu Lab. Muy completa para usuarios de A1, P1 y X1. Incluye AMS y multimaterial.',
        lang: 'en',
        difficulty: 'principiante',
        symptoms: ['stringing', 'clog', 'layer-shift', 'bad-adhesion', 'first-layer'],
      },
      {
        name: 'All3DP — Glosario de Impresión 3D',
        url: 'https://all3dp.com/2/3d-printing-glossary/',
        description:
          'Más de 100 términos técnicos explicados: G-code, retracción, bed leveling, PETG, deposición fundida y más.',
        lang: 'en',
        difficulty: 'principiante',
        symptoms: [],
      },
    ],
  },
  {
    id: 'espanol',
    icon: '🇪🇸',
    title: 'Guías en Español',
    description:
      'Recursos de calidad en nuestro idioma. Ideales para compartir con usuarios nuevos o con quienes prefieren leer en español.',
    guides: [
      {
        name: 'Bitfab — Guía de Errores de Impresión 3D',
        url: 'https://bitfab.io/es/blog/errores-impresion-3d/',
        description:
          'Clara y directa, con ejemplos reales de piezas fallidas. Cubre los 20 problemas más frecuentes con fotos.',
        lang: 'es',
        difficulty: 'principiante',
        symptoms: ['stringing', 'warping', 'bad-adhesion', 'underextrusion', 'elephant-foot', 'first-layer', 'supports'],
      },
      {
        name: 'Leon3D — Guía de Resolución de Problemas',
        url: 'https://www.leon-3d.es/guia-de-resolucion-de-problemas/',
        description:
          'Una de las mejor documentadas en español, con códigos de error específicos y soluciones detalladas.',
        lang: 'es',
        difficulty: 'intermedio',
        symptoms: ['stringing', 'warping', 'underextrusion', 'clog', 'layer-shift'],
      },
    ],
  },
];

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

  readonly symptoms = SYMPTOMS;
  readonly allCategories = GUIDE_CATEGORIES;
  readonly activeSymptom = signal<string | null>(null);

  readonly activeSymptomData = computed(() => {
    const id = this.activeSymptom();
    return id ? SYMPTOMS.find(s => s.id === id) ?? null : null;
  });

  readonly filteredCategories = computed(() => {
    const sym = this.activeSymptom();
    if (!sym) return GUIDE_CATEGORIES;
    return GUIDE_CATEGORIES
      .map(cat => ({ ...cat, guides: cat.guides.filter(g => g.symptoms.includes(sym)) }))
      .filter(cat => cat.guides.length > 0);
  });

  constructor() {
    this.titleService.setTitle('Guías y Soluciones — Impresión 3D — 3DPrecios');
    this.meta.updateTag({
      name: 'description',
      content:
        'Biblioteca de guías, biblias de errores y recursos de calibración para impresión 3D FDM y resina. ' +
        'Buscador de síntomas: stringing, warping, layer shift y más.',
    });

    const route = inject(ActivatedRoute);
    afterNextRender(() => {
      route.fragment.subscribe(fragment => {
        if (fragment) {
          this.doc.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  selectSymptom(id: string): void {
    this.activeSymptom.update(v => (v === id ? null : id));
  }

  clearSymptom(): void {
    this.activeSymptom.set(null);
  }

  scrollTo(id: string): void {
    this.doc.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
