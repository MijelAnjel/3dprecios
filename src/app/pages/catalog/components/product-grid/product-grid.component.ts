import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Product } from '../../../../core/models';
import { ProductCardComponent } from '../../../../shared/components/product-card/product-card.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-product-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCardComponent, SkeletonComponent],
  template: `
    @if (loading()) {
      <app-skeleton [count]="8" />
    } @else if (products().length === 0) {
      <div class="product-grid__empty" role="status">
        <span class="product-grid__empty-icon" aria-hidden="true">🔍</span>
        <p class="product-grid__empty-title">Sin resultados</p>
        <p class="product-grid__empty-sub">Prueba cambiando los filtros.</p>
      </div>
    } @else {
      <ul class="product-grid" role="list" aria-label="Productos">
        @for (product of products(); track product.id) {
          <li><app-product-card [product]="product" /></li>
        }
      </ul>
    }
  `,
  styleUrl: './product-grid.component.scss',
})
export class ProductGridComponent {
  readonly products = input.required<Product[]>();
  readonly loading  = input<boolean>(false);
}
