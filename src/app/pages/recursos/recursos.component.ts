import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { inject } from '@angular/core';

export interface ResourceSite {
  name: string;
  url: string;
  description: string;
}

export interface ResourceCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  sites: ResourceSite[];
}

const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: 'repositorios',
    icon: '📦',
    title: 'Repositorios Principales',
    description: 'Las plataformas más grandes con millones de modelos gratuitos.',
    sites: [
      { name: 'Thingiverse',       url: 'https://www.thingiverse.com',       description: 'La plataforma más grande con millones de modelos gratuitos.' },
      { name: 'Printables',        url: 'https://www.printables.com',        description: 'Plataforma de Prusa con modelos de alta calidad y comunidad activa.' },
      { name: 'MakerWorld',        url: 'https://makerworld.com',            description: 'Repositorio oficial de Bambu Lab con modelos verificados.' },
      { name: 'Cults3D',           url: 'https://cults3d.com',               description: 'Modelos gratuitos y de pago con diseñadores independientes.' },
      { name: 'MyMiniFactory',     url: 'https://www.myminifactory.com',     description: 'Modelos certificados para impresión 3D garantizada.' },
      { name: 'Thangs',            url: 'https://thangs.com',                description: 'Motor de búsqueda 3D inteligente con millones de archivos.' },
      { name: 'CGTrader',          url: 'https://www.cgtrader.com',          description: 'Modelos 3D profesionales para diseño e impresión.' },
      { name: 'TurboSquid',        url: 'https://www.turbosquid.com',        description: 'Marketplace de modelos 3D profesionales.' },
      { name: 'Pinshape',          url: 'https://pinshape.com',              description: 'Comunidad de diseñadores con colecciones curadas.' },
      { name: 'YouMagine',         url: 'https://www.youmagine.com',         description: 'Plataforma de Ultimaker con diseños abiertos.' },
      { name: 'GrabCAD Library',   url: 'https://grabcad.com/library',       description: 'Modelos CAD y técnicos de ingeniería.' },
      { name: 'Sketchfab',         url: 'https://sketchfab.com',             description: 'Visualización 3D interactiva con opción de descarga.' },
      { name: 'Creality Cloud',    url: 'https://www.crealitycloud.com',     description: 'Plataforma oficial de Creality con modelos y slicing.' },
      { name: 'MakerOnline',       url: 'https://www.makeronline.com',       description: 'Comunidad maker con proyectos y modelos.' },
      { name: 'Nexprint',          url: 'https://nexprint.com',              description: 'Plataforma emergente de modelos para impresión 3D.' },
    ],
  },
  {
    id: 'buscadores',
    icon: '🔍',
    title: 'Buscadores de Modelos STL',
    description: 'Motores de búsqueda que rastrean múltiples repositorios a la vez.',
    sites: [
      { name: 'Yeggi',      url: 'https://www.yeggi.com',      description: 'El buscador de STL más popular, indexa decenas de plataformas.' },
      { name: 'STLFiner',   url: 'https://stlfiner.com',       description: 'Buscador STL con filtros avanzados y previsualizaciones.' },
      { name: '3DFindit',   url: 'https://3dfindit.com',       description: 'Búsqueda semántica de modelos técnicos y mecánicos.' },
      { name: 'STLFinder',  url: 'https://www.stlfinder.com',  description: 'Motor de búsqueda especializado en archivos STL y 3MF.' },
    ],
  },
  {
    id: 'nicho',
    icon: '🎮',
    title: 'Repositorios de Nicho',
    description: 'Plataformas especializadas en categorías específicas.',
    sites: [
      { name: 'Gambody',          url: 'https://www.gambody.com',              description: 'Figuras y miniaturas de videojuegos y cultura pop.' },
      { name: 'Fab365',           url: 'https://fab365.net',                   description: 'Modelos articulados y plegables sin ensamblaje.' },
      { name: 'NASA 3D Resources', url: 'https://nasa3d.arc.nasa.gov',         description: 'Modelos oficiales de naves, planetas y misiones de la NASA.' },
      { name: 'NIH 3D Print',     url: 'https://3dprint.nih.gov',              description: 'Modelos biomédicos, anatómicos y científicos verificados.' },
      { name: 'ToyMakr3D',        url: 'https://www.toymakr3d.com',            description: 'Juguetes articulados y modelos transformables.' },
      { name: '3DSky',            url: 'https://3dsky.org',                    description: 'Modelos especializados en arquitectura e interiorismo.' },
      { name: '3D Warehouse',     url: 'https://3dwarehouse.sketchup.com',     description: 'Modelos de arquitectura y mobiliario de SketchUp.' },
      { name: 'Instructables',    url: 'https://www.instructables.com',        description: 'Proyectos completos con STL, guías e instrucciones.' },
      { name: 'Wicked Art',       url: 'https://wicked.art',                   description: 'Modelos artísticos y miniaturas de alta calidad.' },
      { name: 'Loot Studios',     url: 'https://www.lootstudios.com',          description: 'Paquetes mensuales de miniaturas fantásticas.' },
    ],
  },
  {
    id: 'ia',
    icon: '🤖',
    title: 'IA y Generación 3D',
    description: 'Herramientas de inteligencia artificial para crear modelos 3D desde texto o imágenes.',
    sites: [
      { name: 'Meshy',        url: 'https://www.meshy.ai',     description: 'Genera modelos 3D desde texto o imágenes con IA.' },
      { name: 'Tripo3D',      url: 'https://www.tripo3d.ai',   description: 'Modelos 3D generados por IA en segundos desde fotos.' },
      { name: 'Printpal',     url: 'https://printpal.io',       description: 'Genera y optimiza modelos 3D para impresión directa.' },
      { name: '3D AI Studio', url: 'https://3daistudio.com',   description: 'Creación de modelos 3D con inteligencia artificial.' },
      { name: 'CSM.ai',       url: 'https://www.csm.ai',       description: 'Convierte imágenes en modelos 3D listos para imprimir.' },
    ],
  },
  {
    id: 'ingenieria',
    icon: '⚙️',
    title: 'Ingeniería, Mecánica y CAD',
    description: 'Repositorios técnicos para piezas mecánicas, componentes y proyectos de ingeniería.',
    sites: [
      { name: '3DContentCentral', url: 'https://www.3dcontentcentral.com', description: 'Millones de componentes CAD listos para descargar.' },
      { name: 'GrabCAD',          url: 'https://grabcad.com',              description: 'La mayor comunidad de ingenieros CAD del mundo.' },
      { name: 'TraceParts',       url: 'https://www.traceparts.com',       description: 'Biblioteca de componentes técnicos certificados.' },
      { name: 'PartCommunity',    url: 'https://partcommunity.com',        description: 'Datos CAD 2D/3D de fabricantes industriales.' },
      { name: 'OnShape',          url: 'https://cad.onshape.com',          description: 'CAD profesional en la nube con biblioteca pública.' },
    ],
  },
  {
    id: 'museos',
    icon: '🏛️',
    title: 'Museos, Ciencia y Educación',
    description: 'Modelos digitalIzados de artefactos reales, fósiles y patrimonio cultural.',
    sites: [
      { name: 'Smithsonian 3D',   url: 'https://3d.si.edu',                description: 'Colección oficial del Smithsonian en 3D.' },
      { name: 'Scan the World',   url: 'https://www.scantheworld.org',      description: 'Esculturas y arte mundial digitalizado.' },
      { name: 'African Fossils',  url: 'https://africanfossils.org',        description: 'Fósiles africanos escaneados en 3D.' },
      { name: 'MorphoSource',     url: 'https://www.morphosource.org',      description: 'Biología y fósiles para investigación científica.' },
      { name: 'Embodi3D',         url: 'https://www.embodi3d.com',          description: 'Modelos médicos y anatómicos para educación.' },
      { name: 'Thingiverse Education', url: 'https://www.thingiverse.com/education', description: 'Colección educativa curada de Thingiverse.' },
    ],
  },
  {
    id: 'alternativos',
    icon: '🌐',
    title: 'Repositorios Alternativos',
    description: 'Otras plataformas con comunidades activas y modelos únicos.',
    sites: [
      { name: 'Repables',         url: 'http://repables.com',              description: 'Repositorio de piezas de repuesto y reparación.' },
      { name: 'Redpah',           url: 'https://www.redpah.com',           description: 'Marketplace de modelos 3D de pago.' },
      { name: '3D Ago Go',        url: 'https://www.3dagogo.com',          description: 'Modelos 3D curados y revisados por expertos.' },
      { name: 'Threeding',        url: 'https://www.threeding.com',        description: 'Plataforma de modelos con enfoque en calidad.' },
      { name: 'Malix3Design',     url: 'https://www.malix3design.com',     description: 'Diseños artísticos y decorativos para imprimir.' },
      { name: 'Patreon 3D',       url: 'https://www.patreon.com',          description: 'Artistas STL con suscripciones mensuales exclusivas.' },
    ],
  },
  {
    id: 'software',
    icon: '🛠️',
    title: 'Software y Herramientas',
    description: 'Herramientas de diseño y modelado 3D para crear tus propios modelos.',
    sites: [
      { name: 'Tinkercad',   url: 'https://www.tinkercad.com/things', description: 'Diseño 3D online gratis, ideal para principiantes.' },
      { name: 'FreeCAD',     url: 'https://www.freecad.org',          description: 'CAD 3D paramétrico de código abierto.' },
      { name: 'Blender',     url: 'https://www.blender.org',          description: 'Modelado 3D profesional y gratuito.' },
      { name: 'Shapr3D',     url: 'https://www.shapr3d.com',          description: 'CAD profesional intuitivo para iPad y Mac.' },
    ],
  },
];

@Component({
  selector: 'app-recursos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recursos.component.html',
  styleUrl: './recursos.component.scss',
})
export class RecursosComponent {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);

  readonly categories = RESOURCE_CATEGORIES;

  constructor() {
    this.titleService.setTitle('Recursos 3D — Descargas y Herramientas — 3DPrecios');
    this.meta.updateTag({
      name: 'description',
      content: 'Directorio de repositorios, buscadores y herramientas para descargar modelos 3D gratuitos y de pago: Thingiverse, Printables, MakerWorld y más.',
    });
  }
}
