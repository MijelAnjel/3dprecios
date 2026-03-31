import { Injectable, inject, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { Store } from '../models';
import { CatalogService } from './catalog.service';

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly catalog = inject(CatalogService);

  /** Todas las tiendas activas como signal (derivado del catálogo). */
  readonly stores = computed(() =>
    this.catalog.stores().filter(s => s.isActive)
  );

  /** Tienda por slug. */
  getBySlug(slug: string): Observable<Store | null> {
    return toObservable(this.stores).pipe(
      map(stores => stores.find(s => s.slug === slug) ?? null),
    );
  }
}
