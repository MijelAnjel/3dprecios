import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, switchMap, catchError, tap } from 'rxjs';
import { CatalogData, CatalogProduct, Store } from '../models';

interface CachedItem<T> {
  value: T;
  expiresAt: number;
}

const IDB_DB_NAME    = 'catalog-db';
const IDB_DB_VERSION = 1;
const IDB_STORE      = 'cache';
const IDB_KEY        = 'catalog_v2';
const CACHE_TTL_MS   = 30 * 60 * 1000; // 30 minutos

// ── Minimal IndexedDB helpers (async, non-blocking) ──────────

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Fuente de datos principal de la app.
 * Lee /assets/data/catalog.json (archivo estático generado por el scraper
 * y servido desde Firebase Hosting CDN).
 *
 * Estrategia Zero Cost:
 *  - Primer acceso: HTTP GET → caché en IndexedDB (30 min, async — no bloquea el hilo principal)
 *  - Accesos siguientes: IndexedDB (0 lecturas a Firestore, 0 costos de servidor)
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http      = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _products = signal<CatalogProduct[]>([]);
  private readonly _stores   = signal<Store[]>([]);
  private readonly _loaded   = signal(false);

  /** Todos los productos del catálogo (señal reactiva). */
  readonly products = this._products.asReadonly();

  /** Todas las tiendas activas (señal reactiva). */
  readonly stores = this._stores.asReadonly();

  /** True cuando el catálogo ya fue cargado. */
  readonly loaded = this._loaded.asReadonly();

  /** Mapa slug → CatalogProduct para búsquedas O(1). */
  readonly productMap = computed(() =>
    new Map(this._products().map(p => [p.slug, p]))
  );

  /**
   * Carga el catálogo si aún no fue cargado.
   * Devuelve un Observable que emite el catálogo (desde caché o HTTP).
   * Llamar varias veces es idempotente.
   */
  load(): Observable<CatalogData> {
    if (!this.isBrowser) return of(this.emptyData());

    if (this._loaded()) {
      return of({
        meta: { generatedAt: '', productCount: this._products().length },
        stores: this._stores(),
        products: this._products(),
      });
    }

    // Leer caché de IndexedDB de forma asíncrona (no bloquea el hilo principal)
    return from(this.readIdbCache()).pipe(
      switchMap(cached => {
        if (cached) {
          this.applyData(cached);
          return of(cached);
        }
        return this.http.get<CatalogData>('/assets/data/catalog.json').pipe(
          tap(data => {
            this.applyData(data);
            this.writeIdbCache(data); // fire-and-forget
          }),
        );
      }),
      catchError(() =>
        // IDB no disponible — fallback directo a HTTP
        this.http.get<CatalogData>('/assets/data/catalog.json').pipe(
          tap(data => this.applyData(data)),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers internos
  // ─────────────────────────────────────────────────────────────

  private applyData(data: CatalogData): void {
    this._products.set(data.products ?? []);
    this._stores.set(data.stores ?? []);
    this._loaded.set(true);
  }

  private emptyData(): CatalogData {
    return { meta: { generatedAt: '', productCount: 0 }, stores: [], products: [] };
  }

  // ── IndexedDB con TTL ─────────────────────────────────────────

  private async readIdbCache(): Promise<CatalogData | null> {
    try {
      const db   = await idbOpen();
      const item = await idbGet<CachedItem<CatalogData>>(db, IDB_KEY);
      db.close();
      if (!item) return null;
      if (Date.now() > item.expiresAt) return null;
      return item.value;
    } catch {
      return null;
    }
  }

  private writeIdbCache(data: CatalogData): void {
    const item: CachedItem<CatalogData> = {
      value: data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    idbOpen()
      .then(db => idbPut(db, IDB_KEY, item).then(() => db.close()))
      .catch(() => { /* IDB no disponible — ignorar */ });
  }
}
