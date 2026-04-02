import { Injectable } from '@angular/core';
import { Category, SpecField } from '../models';

// Marcas de filamento disponibles en Chile (fuente: tiendas monitoreadas + tiendasypaginas.md)
const FILAMENT_BRANDS: string[] = [
  // Globales dominantes
  'Anycubic', 'Bambu Lab', 'Creality', 'eSUN', 'Elegoo', 'Sunlu',
  // Alta gama y rendimiento
  'AzureFilm', 'Fiberlogy', 'Flashforge', 'FormFutura', 'Hatchbox',
  'Overture', 'Polymaker', 'Prusament',
  // Especializadas e ingeniería
  'Colorfabb', 'NinjaTek', 'Proto-Pasta', 'Smartfil', 'Spectrum', 'Taulman3D',
  // Económicas y de batallas
  'Anet', 'GeeeTech', 'Jayo', 'Kingroon', 'Voxelab', 'Zaxe',
  // Regionales (Argentina/Chile)
  'Grilon3', 'Printalot',
];

// Campos de spec compartidos para filamentos estándar (PLA, PETG, ABS, TPU)
const FILAMENT_SPEC_FIELDS: SpecField[] = [
  {
    key: 'brand',
    label: 'Marca',
    type: 'select',
    options: FILAMENT_BRANDS,
    filterable: true,
  },
  {
    key: 'material',
    label: 'Material',
    type: 'select',
    options: ['PLA', 'PLA+', 'PLA Silk', 'PLA Matte', 'PLA HF', 'PLA-CF', 'PETG', 'PETG-CF', 'PETG-HF', 'ABS', 'ASA', 'ASA-CF', 'TPU', 'TPE', 'Nylon', 'Nylon-CF', 'PC', 'HIPS', 'PVA', 'PEEK', 'PEI'],
    filterable: true,
  },
  {
    key: 'weight',
    label: 'Peso',
    unit: 'g',
    type: 'select',
    options: ['250', '500', '750', '1000', '1250', '2000', '3000', '5000'],
    filterable: true,
  },
  {
    key: 'diameter',
    label: 'Diámetro',
    unit: 'mm',
    type: 'select',
    options: ['1.75', '2.85'],
    filterable: true,
  },
  {
    key: 'color',
    label: 'Color',
    type: 'select',
    options: [
      'Blanco', 'Crema', 'Hueso', 'Marfil', 'Champagne',
      'Negro', 'Antracita', 'Gris',
      'Rojo', 'Borgoña', 'Coral', 'Terracota',
      'Naranja', 'Amarillo', 'Dorado',
      'Verde', 'Lima', 'Menta',
      'Celeste', 'Azul', 'Azul Oscuro',
      'Morado', 'Lavanda', 'Rosa',
      'Café', 'Cobre', 'Plateado', 'Transparente',
    ],
    filterable: true,
  },
];

// Categorías estáticas — no cambian con el catálogo de productos.
// El campo `id` coincide con el slug (es el categoryId almacenado en Firestore).
const CATEGORIES: Category[] = [
  {
    id: 'filamentos-pla',
    slug: 'filamentos-pla',
    name: 'Filamentos PLA',
    icon: '🧵',
    specFields: FILAMENT_SPEC_FIELDS,
  },
  {
    id: 'filamentos-petg',
    slug: 'filamentos-petg',
    name: 'Filamentos PETG',
    icon: '🟦',
    specFields: FILAMENT_SPEC_FIELDS,
  },
  {
    id: 'filamentos-abs',
    slug: 'filamentos-abs',
    name: 'Filamentos ABS',
    icon: '🔶',
    specFields: FILAMENT_SPEC_FIELDS,
  },
  {
    id: 'filamentos-tpu',
    slug: 'filamentos-tpu',
    name: 'Filamentos TPU/TPE',
    icon: '🟣',
    specFields: FILAMENT_SPEC_FIELDS,
  },
  {
    id: 'filamentos-especiales',
    slug: 'filamentos-especiales',
    name: 'Filamentos Especiales',
    icon: '⚗️',
    specFields: FILAMENT_SPEC_FIELDS,
  },
  {
    id: 'impresoras-fdm',
    slug: 'impresoras-fdm',
    name: 'Impresoras FDM',
    icon: '🖨️',
    specFields: [
      {
        key: 'brand',
        label: 'Marca',
        type: 'select',
        options: ['Anet', 'AnkerMake', 'Anycubic', 'Artillery', 'Bambu Lab', 'Creality', 'Elegoo', 'Flashforge', 'Prusa', 'Qidi', 'Raise3D', 'Snapmaker', 'Voxelab'],
        filterable: true,
      },
      {
        key: 'workArea',
        label: 'Volumen construcción',
        type: 'text',
        filterable: false,
      },
    ],
  },
  {
    id: 'impresoras-resina',
    slug: 'impresoras-resina',
    name: 'Impresoras Resina',
    icon: '💧',
    specFields: [
      {
        key: 'brand',
        label: 'Marca',
        type: 'select',
        options: ['Anycubic', 'Bambu Lab', 'Creality', 'Elegoo', 'Flashforge', 'Graphy', 'Phrozen', 'Shining 3D', 'Uniz'],
        filterable: true,
      },
      {
        key: 'resolution',
        label: 'Resolución UV',
        type: 'select',
        options: ['4K', '8K', '10K', '12K', '14K', '16K'],
        filterable: true,
      },
      {
        key: 'technology',
        label: 'Tecnología',
        type: 'select',
        options: ['MSLA / LCD', 'DLP', 'SLA'],
        filterable: true,
      },
    ],
  },
  {
    id: 'resinas',
    slug: 'resinas',
    name: 'Resinas',
    icon: '🧪',
    specFields: [
      {
        key: 'brand',
        label: 'Marca',
        type: 'select',
        options: ['Anycubic', 'Creality', 'eSUN', 'Elegoo', 'Graphy', 'Phrozen', 'Siraya Tech'],
        filterable: true,
      },
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: ['Estándar', 'ABS-Like', 'Water Washable', 'Alta Resolución', 'Dental', 'Especializada'],
        filterable: true,
      },
      {
        key: 'volume',
        label: 'Volumen',
        unit: 'ml',
        type: 'select',
        options: ['250', '500', '1000', '2000'],
        filterable: true,
      },
    ],
  },
  {
    id: 'repuestos',
    slug: 'repuestos',
    name: 'Repuestos',
    icon: '🔧',
    specFields: [
      {
        key: 'partType',
        label: 'Tipo de repuesto',
        type: 'select',
        options: [
          'Nozzle', 'Hotend', 'Extrusor', 'Sensor', 'Correa / Polea', 'Motor',
          'Placa', 'Cama / Superficie', 'Fuente de Poder', 'Ventilador',
          'Pantalla LCD', 'Termistor', 'Rodamiento / Riel', 'Driver Motor',
          'Piezas Hotend', 'Sistema de Movimiento', 'Accesorio Resina',
        ],
        filterable: true,
      },
      {
        key: 'brand',
        label: 'Marca compatible',
        type: 'select',
        options: ['AnkerMake', 'Anet', 'Anycubic', 'Artillery', 'Bambu Lab', 'Capricorn', 'Creality', 'Elegoo', 'Fiberlogy', 'Flashforge', 'LuckyBot', 'Mosaic', 'Prusa', 'Siboor', 'Sunlu'],
        filterable: true,
      },
      {
        key: 'compatibleWith',
        label: 'Modelo compatible',
        type: 'select',
        options: [
          'Ender 3', 'Ender 3 S1', 'Ender 3 S1 Pro', 'Ender 3 V3', 'Ender 3 V3 SE',
          'Ender 5', 'Ender 6', 'CR-10', 'CR-6',
          'K1', 'K1C', 'K1 Max', 'K2 Plus',
          'Artillery Sidewinder', 'Artillery Genius', 'Artillery Hornet', 'Artillery',
          'Bambu A1 Mini', 'Bambu A1', 'Bambu P1', 'Bambu X1',
          'Prusa', 'Anycubic Kobra / i3', 'Kossel', 'Delta genérica',
        ],
        filterable: true,
      },
      {
        key: 'nozzleDiameter',
        label: 'Diámetro boquilla',
        unit: 'mm',
        type: 'select',
        options: ['0.2', '0.25', '0.3', '0.4', '0.6', '0.8', '1.0', '1.2'],
        filterable: true,
      },
    ],
  },
  {
    id: 'accesorios',
    slug: 'accesorios',
    name: 'Accesorios 3D',
    icon: '🛠️',
    specFields: [
      {
        key: 'brand',
        label: 'Marca compatible',
        type: 'select',
        options: ['Bambu Lab', 'Creality', 'Elegoo', 'Anycubic', 'Artillery', 'Flashforge', 'Prusa'],
        filterable: true,
      },
    ],
  },
  {
    id: 'secadores',
    slug: 'secadores',
    name: 'Secadores de Filamento',
    icon: '🌡️',
    specFields: [
      {
        key: 'brand',
        label: 'Marca',
        type: 'select',
        options: ['Bambu Lab', 'Creality', 'eSUN', 'Polymaker', 'Sovol', 'Sunlu'],
        filterable: true,
      },
    ],
  },
  {
    id: 'scanner-3d',
    slug: 'scanner-3d',
    name: 'Scanners 3D',
    icon: '📡',
    specFields: [
      {
        key: 'brand',
        label: 'Marca',
        type: 'select',
        options: ['Bambu Lab', 'Creality', 'Revopoint', 'Shining 3D'],
        filterable: true,
      },
    ],
  },
  {
    id: 'lapices-3d',
    slug: 'lapices-3d',
    name: 'Lápices 3D',
    icon: '✏️',
    specFields: [
      {
        key: 'brand',
        label: 'Marca',
        type: 'select',
        options: ['3Doodler', 'MYNT3D', 'Scribbler'],
        filterable: true,
      },
    ],
  },
  {
    id: 'general',
    slug: 'general',
    name: 'General',
    icon: '📦',
    specFields: [],
  },
];

@Injectable({ providedIn: 'root' })
export class CategoryService {
  /** Todas las categorías visibles en navegación (excluye 'general'). */
  readonly categories = CATEGORIES.filter((c) => c.id !== 'general');

  /** Todas las categorías incluyendo 'general'. */
  readonly allCategories = CATEGORIES;

  /** Busca una categoría por su slug (= categoryId en Firestore). */
  getBySlug(slug: string): Category | null {
    return CATEGORIES.find((c) => c.slug === slug) ?? null;
  }
}

