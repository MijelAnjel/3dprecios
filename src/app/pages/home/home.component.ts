import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { CategoryService } from '../../core/services/category.service';
import { StoreService } from '../../core/services/store.service';
import { ProductService } from '../../core/services/product.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Product } from '../../core/models';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ProductCardComponent, DecimalPipe],
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
  private readonly catalogService = inject(CatalogService);

  readonly searchControl = new FormControl('');
  readonly stores = this.storeService.stores;
  readonly categories = signal(this.categoryService.categories);
  readonly topProducts     = toSignal(this.productService.getTopProducts(8),            { initialValue: [] as Product[] });
  readonly dailyPicks      = toSignal(this.productService.getRotatingDailyPicks(8),     { initialValue: [] as Product[] });
  readonly popularProducts  = toSignal(this.productService.getPopularProducts(6),        { initialValue: [] as Product[] });
  readonly featuredProducts = toSignal(this.productService.getFeaturedProducts(8),       { initialValue: [] as Product[] });
  readonly loadingProducts = signal(false);
  readonly storeCount = computed(() => this.storeService.stores().length);
  readonly categoryCount = computed(() => this.categories().length);
  readonly productCount = computed(() => this.catalogService.products().length);

  readonly dailyPicksWithBadges = computed(() =>
    this.dailyPicks().map((product, i) => ({
      product,
      badge: this.computePickBadge(i, product),
    }))
  );

  readonly activeIndex = signal(-1);
  readonly showDropdown = signal(false);

  private readonly searchQuery = toSignal(
    this.searchControl.valueChanges.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      startWith(''),
    ),
    { initialValue: '' },
  );

  readonly suggestions = computed(() => {
    const q = (this.searchQuery() ?? '').trim().toLowerCase();
    if (q.length < 2) return [];
    return this.catalogService.products()
      .filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
      .slice(0, 6);
  });

  private readonly jsonLdSchemas = computed(() => [
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
      numberOfEmployees: 1,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Catálogo de productos de impresión 3D',
      url: 'https://3dprecios.cl/categorias',
      numberOfItems: this.catalogService.products().length,
    },
  ]);

  constructor() {
    const doc = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);

    this.titleService.setTitle('3DPrecios — Compara precios de impresión 3D en Chile');
    this.meta.updateTag({
      name: 'description',
      content: 'Compara precios de filamentos, impresoras 3D y resinas en tiendas chilenas. Historial de precios y alertas. Gratis.',
    });
    this.meta.updateTag({ property: 'og:title', content: '3DPrecios — Compara precios de impresión 3D en Chile' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://3dprecios.cl' });

    // Inject JSON-LD structured data via a real <script> tag (SSR-compatible)
    const script = doc.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(this.jsonLdSchemas());
    doc.head.appendChild(script);

    destroyRef.onDestroy(() => script.remove());
  }

  onSearch(): void {
    const query = this.searchControl.value?.trim();
    this.showDropdown.set(false);
    this.activeIndex.set(-1);
    if (query) {
      this.router.navigate(['/categorias'], { queryParams: { q: query } });
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const sug = this.suggestions();
    if (event.key === 'Enter') {
      const idx = this.activeIndex();
      if (idx >= 0 && sug[idx]) {
        this.selectSuggestion(sug[idx].slug);
      } else {
        this.onSearch();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set(Math.min(this.activeIndex() + 1, sug.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, -1));
    } else if (event.key === 'Escape') {
      this.showDropdown.set(false);
      this.activeIndex.set(-1);
    }
  }

  onSearchFocus(): void {
    if ((this.searchControl.value?.trim() ?? '').length >= 2) {
      this.showDropdown.set(true);
    }
  }

  onSearchInput(): void {
    this.activeIndex.set(-1);
    this.showDropdown.set((this.searchControl.value?.trim() ?? '').length >= 2);
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showDropdown.set(false);
      this.activeIndex.set(-1);
    }, 200);
  }

  selectSuggestion(slug: string): void {
    this.showDropdown.set(false);
    this.activeIndex.set(-1);
    this.router.navigate(['/productos', slug]);
  }

  setActiveIndex(i: number): void {
    this.activeIndex.set(i);
  }

  private computePickBadge(index: number, product: Product): { icon: string; label: string; cssClass: string } | null {
    if (index === 0)              return { icon: '🔥', label: 'Oferta del día', cssClass: 'pick-badge--hot' };
    if (product.storeCount >= 3)  return { icon: '🏪', label: 'Multi-tienda',   cssClass: 'pick-badge--multi' };
    if (product.storeCount >= 2)  return { icon: '🏷️', label: '2 tiendas',      cssClass: 'pick-badge--dual' };
    return null;
  }
}
