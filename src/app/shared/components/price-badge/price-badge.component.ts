import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ClpPipe } from '../../pipes/clp.pipe';

export type PriceTrend = 'min' | 'normal' | 'up';

@Component({
  selector: 'app-price-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClpPipe],
  template: `
    <span
      class="price-badge"
      [class.price-badge--min]="trend() === 'min'"
      [class.price-badge--up]="trend() === 'up'"
      [attr.aria-label]="'Precio: ' + price() + ' pesos chilenos'"
    >
      {{ price() | clp }}
      @if (trend() === 'min') {
        <span class="price-badge__tag" aria-label="Mínimo histórico">mín</span>
      }
    </span>
  `,
  styleUrl: './price-badge.component.scss',
})
export class PriceBadgeComponent {
  readonly price = input.required<number>();
  readonly trend = input<PriceTrend>('normal');
}
