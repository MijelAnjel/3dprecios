import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { CatalogData, CatalogProduct, Store } from '../models';

interface CachedItem<T> {
  value: T;
  expiresAt: number;
}

const CACHE_KEY = 'catalog_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Fuente de datos principal de la app.
 * Lee /assets/data/catalog.json (archivo estático generado por el scraper
 * y servido desde Firebase Hosting CDN).
 *
 * Estrategia Zero Cost:
 *  - Primer acceso: HTTP GET → caché en localStorage (30 min)
 *  - Accesos siguientes: localStorage (0 lecturas a Firestore, 0 costos de servidor)
 *  - Firestore se usa ÚNICAMENTE para escrituras del scraper (Admin SDK)
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http       = inject(HttpClient);
  private readonly isBrowser  = isPlatformBrowser(inject(PLATFORM_ID));

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

    const cached = this.readCache();
    if (cached) {
      this.applyData(cached);
      return of(cached);
    }

    return this.http.get<CatalogData>('/assets/data/catalog.json').pipe(
      tap(data => {
        this.applyData(data);
        this.writeCache(data);
      }),
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

  // ── localStorage con TTL ──────────────────────────────────────

  private readCache(): CatalogData | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const item: CachedItem<CatalogData> = JSON.parse(raw);
      if (Date.now() > item.expiresAt) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return item.value;
    } catch {
      return null;
    }
  }

  private writeCache(data: CatalogData): void {
    try {
      const item: CachedItem<CatalogData> = {
        value: data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(item));
    } catch {
      // localStorage lleno o no disponible — ignorar silenciosamente
    }
  }
}
