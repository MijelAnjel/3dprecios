import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '../models';

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly firestore = inject(Firestore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Todas las tiendas activas como signal */
  readonly stores = signal<Store[]>([]);

  constructor() {
    if (!this.isBrowser) return;
    (collectionData(
      query(collection(this.firestore, 'stores'), where('isActive', '==', true)),
      { idField: 'id' },
    ) as Observable<Store[]>)
      .pipe(takeUntilDestroyed())
      .subscribe((s) => this.stores.set(s));
  }

  /** Tienda por slug como observable (para reactive queries) */
  getBySlug(slug: string): Observable<Store | null> {
    if (!this.isBrowser || !slug) return of(null);
    return (
      collectionData(
        query(
          collection(this.firestore, 'stores'),
          where('slug', '==', slug),
          where('isActive', '==', true),
        ),
        { idField: 'id' },
      ) as Observable<Store[]>
    ).pipe(map((results) => results[0] ?? null));
  }
}
