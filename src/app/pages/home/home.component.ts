import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { CategoryService } from '../../core/services/category.service';
import { StoreService } from '../../core/services/store.service';
import { ProductService } from '../../core/services/product.service';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ProductCardComponent, SkeletonComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly categoryService = inject(CategoryService);
  private readonly storeService = inject(StoreService);
  private readonly productService = inject(ProductService);

  readonly searchControl = new FormControl('');
  readonly stores = this.storeService.stores;
  readonly categories = signal(this.categoryService.categories.filter((c) => c.id !== 'general'));
  readonly topProducts = toSignal(this.productService.getTopProducts(8), { initialValue: [] });
  readonly loadingProducts = signal(false);
  readonly storeCount = computed(() => this.storeService.stores().length);
  readonly categoryCount = computed(() => this.categories().length);

  readonly jsonLd = computed(() =>
    JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '3DPrecios',
        url: 'https://3dprecios.cl',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://3dprecios.cl/categorias?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '3DPrecios',
        url: 'https://3dprecios.cl',
        description: 'Comparador de precios de productos de impresión 3D en Chile.',
      },
    ])
  );

  constructor() {
    this.titleService.setTitle('3DPrecios — Compara precios de impresión 3D en Chile');
    this.meta.updateTag({
      name: 'description',
      content: 'Compara precios de filamentos, impresoras 3D y resinas en tiendas chilenas. Historial de precios y alertas. Gratis.',
    });
    this.meta.updateTag({ property: 'og:title', content: '3DPrecios — Compara precios de impresión 3D en Chile' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://3dprecios.cl' });
  }

  onSearch(): void {
    const query = this.searchControl.value?.trim();
    if (query) {
      this.router.navigate(['/categorias'], { queryParams: { q: query } });
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }
}
