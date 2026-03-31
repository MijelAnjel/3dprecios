import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Product, SpecField } from '../../../../core/models';

export interface ActiveFilters {
  priceMin: number | null;
  priceMax: number | null;
  specs: Record<string, string>;
}

@Component({
  selector: 'app-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
})
export class FilterPanelComponent {
  readonly specFields    = input<SpecField[]>([]);
  readonly allProducts   = input<Product[]>([]);   // lista sin filtrar para calcular opciones
  readonly mobileOpen    = input<boolean>(false);
  readonly filtersChange = output<ActiveFilters>();
  readonly close         = output<void>();

  readonly priceMin   = new FormControl<number | null>(null);
  readonly priceMax   = new FormControl<number | null>(null);
  readonly specValues = signal<Record<string, string>>({});

  // Acordeón: qué secciones están abiertas (todas por defecto)
  readonly openSections = signal<Set<string>>(new Set(['price']));

  // Opciones dinámicas calculadas desde los productos reales de la categoría.
  // Sólo muestra valores que EXISTEN en Firestore → filtros siempre relevantes.
  readonly dynamicOptions = computed<Record<string, string[]>>(() => {
    const products = this.allProducts();
    const fields   = this.specFields();
    const result: Record<string, string[]> = {};

    for (const field of fields) {
      if (!field.filterable) continue;
      const values = new Set<string>();
      for (const product of products) {
        const val = product.specs?.[field.key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          values.add(String(val));
        }
      }
      // Ordenar: números de forma numérica, strings alfabéticamente
      result[field.key] = [...values].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b, 'es');
      });
    }
    return result;
  });

  // Cuenta cuántos productos tienen cada valor de spec (para mostrar al usuario)
  readonly optionCounts = computed<Record<string, Record<string, number>>>(() => {
    const products = this.allProducts();
    const fields   = this.specFields();
    const result: Record<string, Record<string, number>> = {};

    for (const field of fields) {
      if (!field.filterable) continue;
      result[field.key] = {};
      for (const product of products) {
        const val = String(product.specs?.[field.key] ?? '');
        if (val) result[field.key][val] = (result[field.key][val] ?? 0) + 1;
      }
    }
    return result;
  });

  toggleSection(key: string): void {
    this.openSections.update((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isSectionOpen(key: string): boolean {
    return this.openSections().has(key);
  }

  onSpecChange(key: string, value: string): void {
    this.specValues.update((prev) => ({ ...prev, [key]: value }));
    this.emit();
  }

  onPriceChange(): void {
    this.emit();
  }

  clearAll(): void {
    this.priceMin.setValue(null);
    this.priceMax.setValue(null);
    this.specValues.set({});
    this.openSections.set(new Set(['price']));
    this.emit();
  }

  hasActiveFilters(): boolean {
    return this.priceMin.value !== null
      || this.priceMax.value !== null
      || Object.values(this.specValues()).some(Boolean);
  }

  private emit(): void {
    this.filtersChange.emit({
      priceMin: this.priceMin.value,
      priceMax: this.priceMax.value,
      specs: this.specValues(),
    });
  }
}

