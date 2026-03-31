import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NgOptimizedImage } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { Store, Product } from '../../core/models';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StoreService } from '../../core/services/store.service';
import { ProductService } from '../../core/services/product.service';

@Component({
  selector: 'app-store',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgOptimizedImage,
    BreadcrumbComponent,
    ProductCardComponent,
    SkeletonComponent,
  ],
  templateUrl: './store.component.html',
  styleUrl:    './store.component.scss',
})
export class StoreComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta  = inject(Meta);
  private readonly storeService   = inject(StoreService);
  private readonly productService = inject(ProductService);

  readonly slug = toSignal(
    this.route.paramMap.pipe(map(p => p.get('slug') ?? '')),
    { initialValue: '' },
  );

  readonly stores   = this.storeService.stores;
  readonly loading  = signal(false);

  /** Tienda activa cuando hay slug, null en la vista de lista */
  readonly activeStore = computed<Store | null>(() => {
    const s = this.slug();
    if (!s) return null;
    return this.stores().find(st => st.slug === s) ?? null;
  });

  readonly isListView = computed(() => !this.slug());

  /** Productos de la tienda activa */
  readonly products = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('slug') ?? ''),
      switchMap(slug => slug
        ? this.productService.getByStore(slug, 12)
        : of([] as Product[]),
      ),
    ),
    { initialValue: [] as Product[] },
  );

  readonly breadcrumb = computed(() => {
    const st = this.activeStore();
    return [
      { label: 'Inicio',   url: '/' },
      { label: 'Tiendas',  url: '/tiendas' },
      ...(st ? [{ label: st.name }] : []),
    ];
  });

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      const store = this.stores().find(s => s.slug === slug);
      const name  = store?.name ?? 'Tienda';
      this.title.setTitle(`${name} — Precios de impresión 3D | 3DPrecios`);
      this.meta.updateTag({ name: 'description', content: `Compara todos los productos de ${name} disponibles en 3DPrecios.` });
    } else {
      this.title.setTitle('Tiendas de impresión 3D en Chile — 3DPrecios');
      this.meta.updateTag({ name: 'description', content: 'Explora las tiendas chilenas de impresión 3D que comparamos en 3DPrecios: Impresalta, Formageo, MakerShop y más.' });
    }
  }
}

