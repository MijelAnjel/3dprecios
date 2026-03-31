import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type SortOption = 'price-asc' | 'price-desc' | 'stores-desc' | 'name-asc';

export const SORT_LABELS: Record<SortOption, string> = {
  'price-asc':    'Menor precio',
  'price-desc':   'Mayor precio',
  'stores-desc':  'Más tiendas',
  'name-asc':     'Nombre A-Z',
};

@Component({
  selector: 'app-sort-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sort-bar">
      <p class="sort-bar__count" aria-live="polite" aria-atomic="true">
        <strong>{{ total() }}</strong> {{ total() === 1 ? 'producto' : 'productos' }}
      </p>
      <div class="sort-bar__controls">
        <label class="sort-bar__label" for="sort-select">Ordenar:</label>
        <select
          id="sort-select"
          class="sort-bar__select"
          [value]="current()"
          (change)="onSort($event)"
        >
          @for (entry of sortEntries; track entry[0]) {
            <option [value]="entry[0]">{{ entry[1] }}</option>
          }
        </select>
      </div>
    </div>
  `,
  styleUrl: './sort-bar.component.scss',
})
export class SortBarComponent {
  readonly total   = input.required<number>();
  readonly current = input<SortOption>('price-asc');
  readonly sortChange = output<SortOption>();

  readonly sortEntries = Object.entries(SORT_LABELS) as [SortOption, string][];

  onSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SortOption;
    this.sortChange.emit(value);
  }
}
