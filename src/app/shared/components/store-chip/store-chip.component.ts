import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Store } from '../../../core/models';

@Component({
  selector: 'app-store-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgOptimizedImage],
  template: `
    <a
      class="store-chip"
      [routerLink]="['/tiendas', store().slug]"
      [attr.aria-label]="'Ver productos de ' + store().name"
    >
      @if (store().logo) {
        <img
          class="store-chip__logo"
          [ngSrc]="store().logo"
          [alt]="store().name"
          width="20"
          height="20"
        />
      }
      <span class="store-chip__name">{{ store().name }}</span>
    </a>
  `,
  styleUrl: './store-chip.component.scss',
})
export class StoreChipComponent {
  readonly store = input.required<Store>();
}
