import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ForumApiService } from '../../../core/services/forum-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ForumCategory, ForumPost } from '../../../core/models';

@Component({
  selector: 'app-forum-category',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './forum-category.component.html',
  styleUrl: './forum-category.component.scss',
})
export class ForumCategoryComponent implements OnInit {
  private readonly api   = inject(ForumApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  readonly auth          = inject(AuthService);

  readonly category  = signal<ForumCategory | null>(null);
  readonly posts     = signal<ForumPost[]>([]);
  readonly page      = signal(1);
  readonly total     = signal(0);
  readonly pageSize  = signal(20);
  readonly loading   = signal(true);
  readonly loadingMore = signal(false);
  readonly error     = signal<string | null>(null);

  readonly hasMore = computed(() => this.posts().length < this.total());
  readonly slug    = this.route.snapshot.paramMap.get('slug')!;

  ngOnInit(): void {
    this.loadPage(1);
  }

  async loadPage(page: number): Promise<void> {
    if (page === 1) this.loading.set(true);
    else this.loadingMore.set(true);
    this.error.set(null);

    try {
      const res = await this.api.getPosts(this.slug, page);
      this.total.set(res.total);
      this.pageSize.set(res.pageSize);
      this.page.set(page);
      this.posts.update((prev) => page === 1 ? res.posts as unknown as ForumPost[] : [...prev, ...res.posts as unknown as ForumPost[]]);

      // Cargar categoría para el título (solo primera vez)
      if (page === 1 && !this.category()) {
        const cats = await this.api.getCategories();
        const cat  = cats.find((c) => c.slug === this.slug) ?? null;
        this.category.set(cat);
        if (cat) this.title.setTitle(`${cat.name} — Foro 3DPrecios`);
      }
    } catch {
      this.error.set('No se pudieron cargar los posts.');
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  loadMore(): void {
    this.loadPage(this.page() + 1);
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'ahora mismo';
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `hace ${d} d`;
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }
}
