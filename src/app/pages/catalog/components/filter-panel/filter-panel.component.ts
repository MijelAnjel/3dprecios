import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { Product, SpecField } from '../../../../core/models';

export interface ActiveFilters {
  priceMin: number | null;
  priceMax: number | null;
  stockOnly: boolean;
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
  readonly initialStockOnly = input<boolean>(false);
  readonly filtersChange = output<ActiveFilters>();
  readonly close         = output<void>();

  readonly priceMin   = new FormControl<number | null>(null);
  readonly priceMax   = new FormControl<number | null>(null);
  readonly stockOnly  = new FormControl<boolean>(false);
  readonly specValues = signal<Record<string, string>>({});

  // Señales reactivas derivadas de los FormControls — permiten que computed() reaccione
  // a cambios en los filtros de precio y stock sin necesidad de suscripciones manuales.
  private readonly stockOnlyVal = toSignal(
    this.stockOnly.valueChanges.pipe(startWith(false as boolean | null)),
    { initialValue: false as boolean | null },
  );
  private readonly priceMinVal = toSignal(
    this.priceMin.valueChanges.pipe(startWith(null as number | null)),
    { initialValue: null as number | null },
  );
  private readonly priceMaxVal = toSignal(
    this.priceMax.valueChanges.pipe(startWith(null as number | null)),
    { initialValue: null as number | null },
  );

  // Acordeón: qué secciones están abiertas (todas por defecto)
  readonly openSections = signal<Set<string>>(new Set(['price']));

  constructor() {
    // Sincronizar el FormControl con el valor inicial si viene de la URL
    effect(() => {
      const initial = this.initialStockOnly();
      if (initial) this.stockOnly.setValue(true);
    });
  }

  // Conjunto completo de valores posibles — calculado desde todos los productos
  // (nunca se estrecha al filtrar, para que las opciones no desaparezcan).
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
      result[field.key] = [...values].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b, 'es');
      });
    }
    return result;
  });

  // Conteos facetados: para cada campo aplica TODOS los filtros activos EXCEPTO
  // el propio campo. Así el conteo de "Marca" refleja el filtro de stock+precio+material,
  // y el de "Material" refleja stock+precio+marca, etc.
  readonly optionCounts = computed<Record<string, Record<string, number>>>(() => {
    const fields = this.specFields();
    const result: Record<string, Record<string, number>> = {};
    for (const field of fields) {
      if (!field.filterable) continue;
      const subset = this.applyFilters(field.key);
      result[field.key] = {};
      for (const product of subset) {
        const val = String(product.specs?.[field.key] ?? '');
        if (val) result[field.key][val] = (result[field.key][val] ?? 0) + 1;
      }
    }
    return result;
  });

  // Total de productos para "Todos" en cada campo: productos que pasan todos
  // los filtros EXCEPTO el propio campo (base sobre la que se muestran las opciones).
  readonly filteredTotals = computed<Record<string, number>>(() => {
    const fields = this.specFields();
    const result: Record<string, number> = {};
    for (const field of fields) {
      if (!field.filterable) continue;
      result[field.key] = this.applyFilters(field.key).length;
    }
    return result;
  });

  // Aplica stock + precio + specs activos, excluyendo opcionalmente un campo.
  // Llamar solo dentro de computed() para que las señales sean rastreadas.
  private applyFilters(excludeSpecKey?: string): Product[] {
    const products = this.allProducts();
    const doStock  = this.stockOnlyVal() ?? false;
    const min      = this.priceMinVal();
    const max      = this.priceMaxVal();
    const specs    = this.specValues();

    let list = products;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (doStock)      list = list.filter(p => (p as any).entries?.some((e: any) => e.stock !== 'out') ?? true);
    if (min !== null) list = list.filter(p => p.minPrice >= min);
    if (max !== null) list = list.filter(p => p.minPrice <= max);
    for (const [key, val] of Object.entries(specs)) {
      if (key === excludeSpecKey) continue;
      if (val) list = list.filter(p => String(p.specs[key]) === val);
    }
    return list;
  }

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
    this.emitFilters();
  }

  onPriceChange(): void {
    this.emitFilters();
  }

  onStockChange(): void {
    this.emitFilters();
  }

  clearAll(): void {
    this.priceMin.setValue(null);
    this.priceMax.setValue(null);
    this.stockOnly.setValue(false);
    this.specValues.set({});
    this.openSections.set(new Set(['price']));
    this.emitFilters();
  }

  hasActiveFilters(): boolean {
    return this.priceMin.value !== null
      || this.priceMax.value !== null
      || this.stockOnly.value === true
      || Object.values(this.specValues()).some(Boolean);
  }

  private emitFilters(): void {
    this.filtersChange.emit({
      priceMin:  this.priceMin.value,
      priceMax:  this.priceMax.value,
      stockOnly: this.stockOnly.value ?? false,
      specs:     this.specValues(),
    });
  }
}

