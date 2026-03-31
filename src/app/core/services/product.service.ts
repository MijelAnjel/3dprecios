import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData,
  collectionGroup,
  doc,
  docData,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from '@angular/fire/firestore';
import { Observable, EMPTY, of, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Product, ProductEntry } from '../models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly firestore = inject(Firestore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Top N productos ordenados por fecha de actualización (más reciente primero). */
  getTopProducts(limitCount = 8): Observable<Product[]> {
    if (!this.isBrowser) return of([]);
    return collectionData(
      query(
        collection(this.firestore, 'products'),
        orderBy('updatedAt', 'desc'),
        limit(limitCount),
      ),
      { idField: 'id' },
    ) as Observable<Product[]>;
  }

  /** Productos de una categoría (categoryId == slug en Firestore). */
  getByCategory(categorySlug: string): Observable<Product[]> {
    if (!this.isBrowser || !categorySlug) return of([]);
    return collectionData(
      query(
        collection(this.firestore, 'products'),
        where('categoryId', '==', categorySlug),
        orderBy('minPrice'),
      ),
      { idField: 'id' },
    ) as Observable<Product[]>;
  }

  /** Producto por slug (= document ID). */
  getBySlug(slug: string): Observable<Product | null> {
    if (!this.isBrowser || !slug) return of(null);
    return (docData(doc(this.firestore, 'products', slug), { idField: 'id' }) as Observable<Product | null>).pipe(
      map((p) => p ?? null),
    );
  }

  /**
   * Productos de una tienda ― usa collectionGroup('entries') para encontrar
   * los productIds activos y luego los recupera individualmente.
   */
  getByStore(storeId: string, limitCount = 12): Observable<Product[]> {
    if (!this.isBrowser || !storeId) return of([]);
    return from(
      getDocs(
        query(
          collectionGroup(this.firestore, 'entries'),
          where('storeId', '==', storeId),
          where('isActive', '==', true),
          limit(limitCount),
        ),
      ).then(async (snap) => {
        const productIds = [...new Set(snap.docs.map((d) => d.data()['productId'] as string))];
        if (productIds.length === 0) return [];
        // Recuperar productos individualmente (evita límite de 30 del operador `in`)
        const docs = await Promise.all(
          productIds.map((id) => getDoc(doc(this.firestore, 'products', id))),
        );
        return docs
          .filter((d) => d.exists())
          .map((d) => ({ id: d.id, ...d.data() }) as Product);
      }),
    );
  }

  /** Productos similares: misma categoría, excluyendo el actual. */
  getSimilar(categorySlug: string, excludeSlug: string, limitCount = 4): Observable<Product[]> {
    if (!this.isBrowser || !categorySlug) return of([]);
    return (
      collectionData(
        query(
          collection(this.firestore, 'products'),
          where('categoryId', '==', categorySlug),
          orderBy('storeCount', 'desc'),
          limit(limitCount + 1),
        ),
        { idField: 'id' },
      ) as Observable<Product[]>
    ).pipe(map((products) => products.filter((p) => p.slug !== excludeSlug).slice(0, limitCount)));
  }
}
