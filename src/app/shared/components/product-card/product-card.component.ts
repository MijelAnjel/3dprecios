import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Product } from '../../../core/models';
import { PriceBadgeComponent } from '../price-badge/price-badge.component';
import { ClpPipe } from '../../pipes/clp.pipe';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgOptimizedImage, PriceBadgeComponent, ClpPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
}
