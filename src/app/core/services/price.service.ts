import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { ProductEntry, PriceHistory } from '../models';

@Injectable({ providedIn: 'root' })
export class PriceService {
  private readonly firestore = inject(Firestore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Entradas de precio activas para un producto (subcollección `/products/{slug}/entries`). */
  getEntries(productSlug: string): Observable<ProductEntry[]> {
    if (!this.isBrowser || !productSlug) return of([]);
    return collectionData(
      query(
        collection(this.firestore, 'products', productSlug, 'entries'),
        orderBy('price'),
      ),
      { idField: 'id' },
    ) as Observable<ProductEntry[]>;
  }

  /** Historial de precios para un producto (subcollección `/products/{slug}/history`). */
  getHistory(productSlug: string): Observable<PriceHistory[]> {
    if (!this.isBrowser || !productSlug) return of([]);
    return collectionData(
      query(
        collection(this.firestore, 'products', productSlug, 'history'),
        orderBy('recordedAt'),
      ),
      { idField: 'id' },
    ) as Observable<PriceHistory[]>;
  }
}
