import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product, CatalogProduct } from '../models';
import { CatalogService } from './catalog.service';
import { ViewTrackingService } from './view-tracking.service';

/** Deterministic Fisher-Yates shuffle using an LCG seeded by `seed`. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly catalog      = inject(CatalogService);
  private readonly viewTracking = inject(ViewTrackingService);

  /**
   * Selección diaria rotativa con diversidad de tiendas.
   * El seed cambia cada día, por lo que la selección varía a diario.
   */
  getRotatingDailyPicks(limitCount = 8): Observable<Product[]> {
    return this.withCatalog(products => {
      const seed = Math.floor(Date.now() / 86400000); // día actual como semilla
      const withImages = products.filter(p => p.images.length > 0 && p.minPrice > 0);
      const shuffled = seededShuffle(withImages, seed);

      const storeCounts: Record<string, number> = {};
      const result: CatalogProduct[] = [];

      for (const p of shuffled) {
        const storeId = p.entries[0]?.storeId ?? '';
        if ((storeCounts[storeId] ?? 0) >= 2) continue;
        storeCounts[storeId] = (storeCounts[storeId] ?? 0) + 1;
        result.push(p);
        if (result.length >= limitCount) break;
      }

      return result;
    });
  }

  /** Productos más visitados por el usuario actual, según localStorage.
   *  Fallback: los más recientemente actualizados con imagen y en ≥2 tiendas. */
  getPopularProducts(limitCount = 6): Observable<Product[]> {
    const topViewed = this.viewTracking.getMostViewed(limitCount * 3);
    if (topViewed.length > 0) {
      const slugSet = new Set(topViewed.map(v => v.slug));
      const viewMap = new Map(topViewed.map(v => [v.slug, v.count]));
      return this.withCatalog(products =>
        products
          .filter(p => slugSet.has(p.slug))
          .sort((a, b) => (viewMap.get(b.slug) ?? 0) - (viewMap.get(a.slug) ?? 0))
          .slice(0, limitCount)
      );
    }
    // Fallback: actualizados recientemente, presentes en ≥2 tiendas
    return this.withCatalog(products =>
      [...products]
        .filter(p => p.images.length > 0 && p.storeCount >= 2)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limitCount)
    );
  }

  /** Productos con más presencia en tiendas (mayor storeCount) = más competencia de precios. */
  getFeaturedProducts(limitCount = 8): Observable<Product[]> {
    return this.withCatalog(products =>
      [...products]
        .filter(p => p.images.length > 0 && p.storeCount >= 2)
        .sort((a, b) => b.storeCount - a.storeCount)
        .slice(0, limitCount)
    );
  }

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
