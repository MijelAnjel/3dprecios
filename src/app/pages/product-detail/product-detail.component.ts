import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { Product, ProductEntry, Store, PriceHistory, Category } from '../../core/models';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { PriceTableComponent } from './components/price-table/price-table.component';
import { PriceChartComponent } from './components/price-chart/price-chart.component';
import { AlertFormComponent } from './components/alert-form/alert-form.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { ProductService } from '../../core/services/product.service';
import { PriceService } from '../../core/services/price.service';
import { StoreService } from '../../core/services/store.service';
import { CategoryService } from '../../core/services/category.service';

@Component({
  selector: 'app-product-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    PriceTableComponent,
    PriceChartComponent,
    AlertFormComponent,
    ProductCardComponent,
    ClpPipe,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl:    './product-detail.component.scss',
})
export class ProductDetailComponent {
  private readonly route           = inject(ActivatedRoute);
  private readonly title           = inject(Title);
  private readonly meta            = inject(Meta);
  private readonly clp             = new ClpPipe();
  private readonly productService  = inject(ProductService);
  private readonly priceService    = inject(PriceService);
  private readonly storeService    = inject(StoreService);
  private readonly categoryService = inject(CategoryService);

  readonly slug = toSignal(
    this.route.paramMap.pipe(map(p => p.get('slug') ?? '')),
    { initialValue: '' },
  );

  /** Producto activo desde Firestore */
  readonly product = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('slug') ?? ''),
      switchMap(slug => slug ? this.productService.getBySlug(slug) : of(null)),
    ),
    { initialValue: null as Product | null },
  );

  /** Entradas de precio para el producto activo */
  readonly entries = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('slug') ?? ''),
      switchMap(slug => slug ? this.priceService.getEntries(slug) : of([] as ProductEntry[])),
    ),
    { initialValue: [] as ProductEntry[] },
  );

  /** Historial de precios para el producto activo */
  readonly history = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('slug') ?? ''),
      switchMap(slug => slug ? this.priceService.getHistory(slug) : of([] as PriceHistory[])),
    ),
    { initialValue: [] as PriceHistory[] },
  );

  /** Todas las tiendas activas (para resolver nombres desde storeId) */
  readonly stores = this.storeService.stores;

  /** Productos similares (misma categoría) */
  readonly similar = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('slug') ?? ''),
      switchMap(slug => {
        const product = this.product();
        return product?.categoryId
          ? this.productService.getSimilar(product.categoryId, slug, 4)
          : of([] as Product[]);
      }),
    ),
    { initialValue: [] as Product[] },
  );

  /** Categoría activa */
  readonly category = computed<Category | null>(() => {
    const categoryId = this.product()?.categoryId;
    return categoryId ? this.categoryService.getBySlug(categoryId) : null;
  });

  readonly loading = signal(false);
  readonly activeImageIndex = signal(0);

  readonly breadcrumb = computed(() => {
    const p = this.product();
    const c = this.category();
    return [
      { label: 'Inicio',     url: '/' },
      { label: 'Categorías', url: '/categorias' },
      ...(c ? [{ label: c.name, url: `/categorias/${c.slug}` }] : []),
      ...(p ? [{ label: p.name }] : []),
    ];
  });

  readonly minPrice    = computed(() => this.product()?.minPrice ?? 0);

  /** Specs del producto con labels legibles desde el specFields de la categoría */
  readonly specDisplayEntries = computed<Array<[string, string]>>(() => {
    const specs = this.product()?.specs ?? {};
    const fields = this.category()?.specFields ?? [];
    const fieldMap = new Map(fields.map(f => [f.key, f]));
    return Object.entries(specs)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([key, val]) => {
        const field = fieldMap.get(key);
        const label = field?.label ?? key;
        const suffix = field?.unit ? ` ${field.unit}` : '';
        return [label, `${val}${suffix}`] as [string, string];
      });
  });

  readonly specEntries = computed(() => Object.entries(this.product()?.specs ?? {}));

  readonly jsonLd = computed(() => {
    const p = this.product();
    if (!p) return null;
    const offers = this.entries()
      .filter(e => e.isActive)
      .map(e => {
        const store = this.stores().find(s => s.id === e.storeId);
        return {
          '@type': 'Offer',
          price: e.price,
          priceCurrency: 'CLP',
          availability: e.stock === 'out'
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          url: e.url,
          seller: { '@type': 'Organization', name: store?.name ?? '' },
        };
      });
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      brand: { '@type': 'Brand', name: p.brand },
      description: p.description,
      image: p.images,
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: p.minPrice,
        highPrice: p.maxPrice,
        priceCurrency: 'CLP',
        offerCount: p.storeCount,
        offers,
      },
    });
  });

  constructor() {
    effect(() => {
      const p = this.product();
      if (!p) return;
      this.title.setTitle(`${p.name} — Comparar precios | 3DPrecios`);
      this.meta.updateTag({ name: 'description', content: `Compara precios de ${p.name} en tiendas chilenas. Desde ${this.clp.transform(p.minPrice)}.` });
      this.meta.updateTag({ property: 'og:title',       content: `${p.name} — 3DPrecios` });
      this.meta.updateTag({ property: 'og:description', content: `Desde ${this.clp.transform(p.minPrice)} en ${p.storeCount} tiendas.` });
      this.meta.updateTag({ property: 'og:image',       content: p.images[0] ?? '' });
    });
  }

  setActiveImage(index: number): void {
    this.activeImageIndex.set(index);
  }
}
