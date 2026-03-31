import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { Product, Category, SpecField } from '../../core/models';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { FilterPanelComponent, ActiveFilters } from './components/filter-panel/filter-panel.component';
import { SortBarComponent, SortOption } from './components/sort-bar/sort-bar.component';
import { ProductGridComponent } from './components/product-grid/product-grid.component';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';

@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbComponent, FilterPanelComponent, SortBarComponent, ProductGridComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent {
  private readonly route   = inject(ActivatedRoute);
  private readonly router  = inject(Router);
  private readonly title   = inject(Title);
  private readonly meta    = inject(Meta);
  private readonly categoryService = inject(CategoryService);
  private readonly productService  = inject(ProductService);

  // Señales de estado
  readonly mobileFiltersOpen = signal(false);
  readonly sort    = signal<SortOption>('price-asc');
  readonly filters = signal<ActiveFilters>({ priceMin: null, priceMax: null, specs: {} });
  readonly loading = signal(false);

  // Slug de la ruta como signal
  private readonly slug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')),
    { initialValue: '' },
  );

  // Query param "q" (búsqueda desde el hero)
  private readonly searchQuery = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('q') ?? '')),
    { initialValue: '' },
  );

  // Categoría activa desde el servicio estático
  readonly category = computed<Category | null>(() => this.categoryService.getBySlug(this.slug()));

  // Spec fields de la categoría activa
  readonly specFields = computed<SpecField[]>(() => this.category()?.specFields ?? []);

  // Breadcrumb
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Categorías', url: '/categorias' },
    ...(this.category() ? [{ label: this.category()!.name }] : []),
  ]);

  // Todos los productos de la categoría desde Firestore (reactivo al slug)
  readonly allProducts = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug') ?? ''),
      switchMap((slug) => this.productService.getByCategory(slug)),
    ),
    { initialValue: [] as Product[] },
  );

  // Filtrado + sort con computed() — sin requests al servidor
  readonly visibleProducts = computed<Product[]>(() => {
    const { priceMin, priceMax, specs } = this.filters();
    const q = this.searchQuery().toLowerCase();
    let list = this.allProducts();

    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (priceMin !== null) list = list.filter((p) => p.minPrice >= priceMin);
    if (priceMax !== null) list = list.filter((p) => p.minPrice <= priceMax);

    for (const [key, val] of Object.entries(specs)) {
      if (val) list = list.filter((p) => String(p.specs[key]) === val);
    }

    return [...list].sort((a, b) => {
      switch (this.sort()) {
        case 'price-asc':   return a.minPrice - b.minPrice;
        case 'price-desc':  return b.minPrice - a.minPrice;
        case 'stores-desc': return b.storeCount - a.storeCount;
        case 'name-asc':    return a.name.localeCompare(b.name, 'es');
      }
    });
  });

  constructor() {
    // Actualizar meta tags cuando cambia la categoría
    effect(() => {
      const cat = this.category();
      const name = cat?.name ?? 'Catálogo';
      this.title.setTitle(`${name} — Precios en Chile | 3DPrecios`);
      this.meta.updateTag({
        name: 'description',
        content: `Compara precios de ${name} en tiendas chilenas. Encuentra el mejor precio en 3DPrecios.`,
      });
    });

    // Sincronizar sort con URL query params
    effect(() => {
      const currentSort = this.sort();
      if (currentSort !== 'price-asc') {
        this.router.navigate([], { queryParamsHandling: 'merge', queryParams: { sort: currentSort }, replaceUrl: true });
      }
    });

    // Leer sort inicial de URL
    const sortParam = this.route.snapshot.queryParamMap.get('sort') as SortOption | null;
    if (sortParam) this.sort.set(sortParam);
  }

  onFiltersChange(filters: ActiveFilters): void {
    this.filters.set(filters);
  }

  onSortChange(sort: SortOption): void {
    this.sort.set(sort);
  }

  toggleMobileFilters(): void {
    this.mobileFiltersOpen.update((v) => !v);
  }
}
