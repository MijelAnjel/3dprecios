import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProductEntry, Store } from '../../../../core/models';
import { ClpPipe } from '../../../../shared/pipes/clp.pipe';

interface PriceRow {
  entry: ProductEntry;
  store: Store | undefined;
}

@Component({
  selector: 'app-price-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClpPipe],
  template: `
    <div class="price-table">
      <h2 class="price-table__title">Precios por tienda</h2>
      <div class="price-table__wrapper" role="region" aria-label="Tabla de precios por tienda" tabindex="0">
        <table class="price-table__table">
          <thead>
            <tr>
              <th scope="col">Tienda</th>
              <th scope="col">Precio</th>
              <th scope="col">Stock</th>
              <th scope="col"><span class="sr-only">Ir a tienda</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of sortedRows(); track row.entry.id; let first = $first) {
              <tr [class.price-table__row--best]="first">
                <td class="price-table__store">
                  @if (row.store?.logo) {
                    <img
                      [src]="row.store!.logo"
                      [alt]="row.store!.name"
                      width="24"
                      height="24"
                      class="price-table__logo"
                    />
                  }
                  <span>{{ row.store?.name ?? '—' }}</span>
                  @if (first) {
                    <span class="price-table__badge price-table__badge--best" aria-label="Mejor precio">Mejor precio</span>
                  }
                </td>
                <td class="price-table__price">
                  {{ row.entry.price | clp }}
                </td>
                <td class="price-table__stock">
                  <span
                    class="price-table__stock-badge"
                    [class.price-table__stock-badge--available]="row.entry.stock === 'available'"
                    [class.price-table__stock-badge--low]="row.entry.stock === 'low'"
                    [class.price-table__stock-badge--out]="row.entry.stock === 'out'"
                  >
                    {{ stockLabel(row.entry.stock) }}
                  </span>
                </td>
                <td class="price-table__action">
                  <a
                    [href]="row.entry.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="price-table__btn"
                    [attr.aria-label]="'Comprar en ' + (row.store?.name ?? 'tienda')"
                  >
                    Ver oferta →
                  </a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="price-table__empty">No hay entradas disponibles.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrl: './price-table.component.scss',
})
export class PriceTableComponent {
  readonly entries = input.required<ProductEntry[]>();
  readonly stores  = input.required<Store[]>();

  readonly sortedRows = computed<PriceRow[]>(() => {
    const storeMap = new Map(this.stores().map(s => [s.id, s]));
    return [...this.entries()]
      .filter(e => e.isActive)
      .sort((a, b) => a.price - b.price)
      .map(entry => ({ entry, store: storeMap.get(entry.storeId) }));
  });

  stockLabel(stock: ProductEntry['stock']): string {
    switch (stock) {
      case 'available': return 'Disponible';
      case 'low':       return 'Últimas unidades';
      case 'out':       return 'Sin stock';
      default:          return 'Desconocido';
    }
  }
}
