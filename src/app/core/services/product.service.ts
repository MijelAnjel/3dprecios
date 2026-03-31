import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product, CatalogProduct } from '../models';
import { CatalogService } from './catalog.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly catalog = inject(CatalogService);

  /** Top N productos ordenados por fecha de actualización (más reciente primero). */
  getTopProducts(limitCount = 8): Observable<Product[]> {
    return this.withCatalog(products =>
      [...products]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limitCount)
    );
  }

  /** Productos de una categoría, ordenados por precio mínimo. */
  getByCategory(categorySlug: string): Observable<Product[]> {
    if (!categorySlug) return of([]);
    return this.withCatalog(products =>
      products
        .filter(p => p.categoryId === categorySlug)
        .sort((a, b) => a.minPrice - b.minPrice)
    );
  }

  /** Producto por slug. */
  getBySlug(slug: string): Observable<Product | null> {
    if (!slug) return of(null);
    return this.withCatalog(products =>
      products.find(p => p.slug === slug) ?? null
    );
  }

  /** Productos de una tienda, limitados a limitCount. */
  getByStore(storeId: string, limitCount = 12): Observable<Product[]> {
    if (!storeId) return of([]);
    return this.withCatalog(products =>
      products
        .filter(p => p.entries.some(e => e.storeId === storeId))
        .slice(0, limitCount)
    );
  }

  /** Productos similares: misma categoría, excluyendo el actual. */
  getSimilar(categorySlug: string, excludeSlug: string, limitCount = 4): Observable<Product[]> {
    if (!categorySlug) return of([]);
    return this.withCatalog(products =>
      products
        .filter(p => p.categoryId === categorySlug && p.slug !== excludeSlug)
        .sort((a, b) => b.storeCount - a.storeCount)
        .slice(0, limitCount)
    );
  }

  /**
   * Delega en catalog.load() que es idempotente:
   *  - si ya está en localStorage → emite instantáneamente (0ms, $0)
   *  - si no → HTTP GET al CDN → guarda en caché → emite
   */
  private withCatalog<T>(fn: (products: CatalogProduct[]) => T): Observable<T> {
    return this.catalog.load().pipe(map(data => fn(data.products)));
  }
}
