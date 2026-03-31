import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProductEntry, PriceHistory } from '../models';
import { CatalogService } from './catalog.service';

@Injectable({ providedIn: 'root' })
export class PriceService {
  private readonly catalog = inject(CatalogService);

  /**
   * Entradas de precio para un producto.
   * Embebidas en catalog.json — 0 lecturas a Firestore.
   */
  getEntries(productSlug: string): Observable<ProductEntry[]> {
    return this.catalog.load().pipe(
      map(data => {
        const product = data.products.find(p => p.slug === productSlug);
        if (!product) return [];
        return product.entries
          .sort((a, b) => a.price - b.price)
          .map((e): ProductEntry => ({
            id:          `${e.storeId}_${productSlug}`,
            productId:   productSlug,
            storeId:     e.storeId,
            url:         e.url,
            price:       e.price,
            currency:    'CLP',
            stock:       e.stock,
            sku:         e.sku,
            lastChecked: '',
            isActive:    true,
          }));
      }),
    );
  }

  /**
   * Historial de precios para un producto.
   * Puntos de historial embebidos en catalog.json.
   */
  getHistory(productSlug: string): Observable<PriceHistory[]> {
    return this.catalog.load().pipe(
      map(data => {
        const product = data.products.find(p => p.slug === productSlug);
        if (!product) return [];
        return product.history
          .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
          .map((h): PriceHistory => ({
            productId:  productSlug,
            storeId:    h.storeId,
            price:      h.price,
            recordedAt: h.recordedAt,
          }));
      }),
    );
  }
}
