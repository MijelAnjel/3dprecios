import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'pdv2';

@Injectable({ providedIn: 'root' })
export class ViewTrackingService {
  private readonly platformId = inject(PLATFORM_ID);

  private getMap(): Record<string, number> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  track(slug: string): void {
    if (!isPlatformBrowser(this.platformId) || !slug) return;
    const map = this.getMap();
    map[slug] = (map[slug] ?? 0) + 1;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // quota exceeded or private browsing
    }
  }

  getMostViewed(limit: number): Array<{ slug: string; count: number }> {
    const map = this.getMap();
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([slug, count]) => ({ slug, count }));
  }
}
