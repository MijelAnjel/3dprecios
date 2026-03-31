import { Injectable } from '@angular/core';
import { Category, SpecField } from '../models';

// Campos de spec compartidos para todos los filamentos
const FILAMENT_SPEC_FIELDS: SpecField[] = [
  {
    key: 'brand',
    label: 'Marca',
    type: 'select',
    options: ['Bambu Lab', 'Creality', 'eSUN', 'Polymaker', 'Prusament', 'Sunlu', 'Fiberlogy', 'Overture', 'Zaxe'],
    filterable: true,
  },
  {
    key: 'material',
    label: 'Material',
    type: 'select',
    options: ['PLA', 'PLA+', 'PLA Silk', 'PLA Matte', 'PLA HF', 'PLA-CF', 'PETG', 'ABS', 'ASA', 'TPU', 'TPE', 'Nylon', 'PC'],
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
    options: ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosa', 'Transparente', 'Café', 'Dorado', 'Plateado'],
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
        options: ['Bambu Lab', 'Creality', 'Prusa', 'Elegoo', 'Qidi', 'Flashforge', 'Artillery', 'Raise3D', 'Voxelab'],
        filterable: true,
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
        options: ['Elegoo', 'Anycubic', 'Phrozen', 'Creality', 'Graphy'],
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
        options: ['Elegoo', 'Anycubic', 'Phrozen', 'Creality', 'eSUN', 'Siraya Tech', 'Antinsky'],
        filterable: true,
      },
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: ['Estándar', 'ABS-Like', 'Water Washable', 'Alta Resolución', 'Especializada'],
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
        key: 'brand',
        label: 'Marca compatible',
        type: 'select',
        options: ['Bambu Lab', 'Creality', 'Prusa', 'Elegoo', 'Anycubic', 'Artillery'],
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

