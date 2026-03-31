import { Injectable } from '@angular/core';
import { Category, SpecField } from '../models';

// Categorías estáticas — no cambian con el catálogo de productos.
// El campo `id` coincide con el slug (es el categoryId almacenado en Firestore).
const CATEGORIES: Category[] = [
  {
    id: 'filamentos-pla',
    slug: 'filamentos-pla',
    name: 'Filamentos PLA',
    icon: '🧵',
    specFields: [
      { key: 'diameter', label: 'Diámetro', unit: 'mm', type: 'select', options: ['1.75', '2.85'], filterable: true },
      { key: 'weight',   label: 'Peso',     unit: 'g',  type: 'select', options: ['500', '750', '1000', '2000'], filterable: true },
    ],
  },
  {
    id: 'filamentos-abs',
    slug: 'filamentos-abs',
    name: 'Filamentos ABS',
    icon: '🔶',
    specFields: [
      { key: 'diameter', label: 'Diámetro', unit: 'mm', type: 'select', options: ['1.75', '2.85'], filterable: true },
    ],
  },
  {
    id: 'filamentos-petg',
    slug: 'filamentos-petg',
    name: 'Filamentos PETG',
    icon: '🟦',
    specFields: [
      { key: 'diameter', label: 'Diámetro', unit: 'mm', type: 'select', options: ['1.75', '2.85'], filterable: true },
    ],
  },
  {
    id: 'impresoras-fdm',
    slug: 'impresoras-fdm',
    name: 'Impresoras FDM',
    icon: '🖨️',
    specFields: [
      { key: 'brand', label: 'Marca', type: 'select', options: ['Bambu Lab', 'Prusa', 'Creality', 'Elegoo', 'Qidi'], filterable: true },
    ],
  },
  {
    id: 'impresoras-resina',
    slug: 'impresoras-resina',
    name: 'Impresoras Resina',
    icon: '💧',
    specFields: [
      { key: 'brand', label: 'Marca', type: 'select', options: ['Elegoo', 'Anycubic', 'Phrozen'], filterable: true },
    ],
  },
  {
    id: 'resinas',
    slug: 'resinas',
    name: 'Resinas',
    icon: '🧪',
    specFields: [
      { key: 'volume', label: 'Volumen', unit: 'ml', type: 'select', options: ['500', '1000'], filterable: true },
    ],
  },
  {
    id: 'repuestos',
    slug: 'repuestos',
    name: 'Repuestos',
    icon: '🔧',
    specFields: [],
  },
  {
    id: 'herramientas',
    slug: 'herramientas',
    name: 'Herramientas',
    icon: '🛠️',
    specFields: [],
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
  /** Todas las categorías (estáticas). */
  readonly categories = CATEGORIES;

  /** Busca una categoría por su slug (= categoryId en Firestore). */
  getBySlug(slug: string): Category | null {
    return CATEGORIES.find((c) => c.slug === slug) ?? null;
  }
}
