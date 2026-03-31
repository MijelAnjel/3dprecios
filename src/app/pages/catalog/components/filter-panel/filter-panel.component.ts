import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { SpecField } from '../../../../core/models';

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
  readonly specFields   = input<SpecField[]>([]);
  readonly mobileOpen   = input<boolean>(false);
  readonly filtersChange = output<ActiveFilters>();
  readonly close         = output<void>();

  readonly priceMin = new FormControl<number | null>(null);
  readonly priceMax = new FormControl<number | null>(null);
  readonly specValues = signal<Record<string, string>>({});

  // Acordeón: qué secciones están abiertas
  readonly openSections = signal<Set<string>>(new Set(['price', 'specs']));

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
    this.emit();
  }

  private emit(): void {
    this.filtersChange.emit({
      priceMin: this.priceMin.value,
      priceMax: this.priceMax.value,
      specs: this.specValues(),
    });
  }
}
