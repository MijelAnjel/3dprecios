import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { Product, Category, SpecField, CatalogProduct } from '../../core/models';
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
  private readonly doc     = inject(DOCUMENT);
  private readonly title   = inject(Title);
  private readonly meta    = inject(Meta);
  private readonly categoryService = inject(CategoryService);
  private readonly productService  = inject(ProductService);

  // Señales de estado
  readonly mobileFiltersOpen = signal(false);
  readonly sort    = signal<SortOption>('price-asc');
  readonly filters = signal<ActiveFilters>({ priceMin: null, priceMax: null, stockOnly: false, specs: {} });
  readonly loading = signal(false);
  readonly page    = signal(1);
  readonly PAGE_SIZE = 24;

  readonly hasActiveFilters = computed(() => {
    const { priceMin, priceMax, stockOnly, specs } = this.filters();
    return priceMin !== null || priceMax !== null || stockOnly || Object.values(specs).some(Boolean);
  });

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
    const { priceMin, priceMax, stockOnly, specs } = this.filters();
    const q = this.searchQuery().toLowerCase();
    let list = this.allProducts();

    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (priceMin !== null) list = list.filter((p) => p.minPrice >= priceMin);
    if (priceMax !== null) list = list.filter((p) => p.minPrice <= priceMax);
    if (stockOnly) {
      list = list.filter((p) => (p as CatalogProduct).entries?.some(e => e.stock !== 'out') ?? true);
    }

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

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.visibleProducts().length / this.PAGE_SIZE)));

  readonly pagedProducts = computed<Product[]>(() => {
    const p = Math.min(this.page(), this.totalPages());
    return this.visibleProducts().slice((p - 1) * this.PAGE_SIZE, p * this.PAGE_SIZE);
  });

  /** Páginas a mostrar en el control de paginación (ventana deslizante de 5) */
  readonly pageRange = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }
    if (range[0] > 2) range.unshift(-1);           // ellipsis izq
    if (range[range.length - 1] < total - 1) range.push(-2); // ellipsis der
    return [1, ...range, total];
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

    // Leer estado inicial desde URL
    const snap = this.route.snapshot.queryParamMap;
    const sortParam  = snap.get('sort') as SortOption | null;
    const priceMin   = snap.get('priceMin')  ? Number(snap.get('priceMin'))  : null;
    const priceMax   = snap.get('priceMax')  ? Number(snap.get('priceMax'))  : null;
    const stockOnly  = snap.get('stockOnly') === '1';
    const pageParam  = snap.get('page') ? Number(snap.get('page')) : 1;
    const specs: Record<string, string> = {};
    for (const key of snap.keys) {
      if (key.startsWith('s_')) specs[key.slice(2)] = snap.get(key) ?? '';
    }
    if (sortParam) this.sort.set(sortParam);
    if (pageParam > 1) this.page.set(pageParam);
    if (priceMin !== null || priceMax !== null || stockOnly || Object.keys(specs).length) {
      this.filters.set({ priceMin, priceMax, stockOnly, specs });
    }
  }

  private syncUrl(): void {
    const f = this.filters();
    const s = this.sort();
    const p = this.page();
    const params: Record<string, string | null | undefined> = {
      sort:      s !== 'price-asc' ? s : null,
      page:      p > 1 ? String(p) : null,
      priceMin:  f.priceMin !== null ? String(f.priceMin) : null,
      priceMax:  f.priceMax !== null ? String(f.priceMax) : null,
      stockOnly: f.stockOnly ? '1' : null,
    };
    for (const key of this.specFields().map(sf => sf.key)) {
      params[`s_${key}`] = f.specs[key] || null;
    }
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  onFiltersChange(filters: ActiveFilters): void {
    this.filters.set(filters);
    this.page.set(1);
    this.syncUrl();
  }

  onSortChange(sort: SortOption): void {
    this.sort.set(sort);
    this.page.set(1);
    this.syncUrl();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.syncUrl();
    this.doc.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleMobileFilters(): void {
    this.mobileFiltersOpen.update((v) => !v);
  }
}
