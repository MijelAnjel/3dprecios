import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="skeleton-card"
      role="status"
      aria-busy="true"
      [attr.aria-label]="'Cargando ' + count() + ' productos'"
    >
      @for (item of items(); track item) {
        <div class="skeleton-card__item">
          <div class="skeleton-card__img"></div>
          <div class="skeleton-card__body">
            <div class="skeleton-card__line skeleton-card__line--short"></div>
            <div class="skeleton-card__line"></div>
            <div class="skeleton-card__line skeleton-card__line--medium"></div>
            <div class="skeleton-card__line skeleton-card__line--price"></div>
            <div class="skeleton-card__line skeleton-card__line--short"></div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent {
  readonly count = input<number>(4);

  get items(): () => number[] {
    return () => Array.from({ length: this.count() }, (_, i) => i);
  }
}
