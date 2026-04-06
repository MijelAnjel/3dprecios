import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ForumApiService } from '../../../core/services/forum-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ForumPost, ForumReply } from '../../../core/models';

@Component({
  selector: 'app-forum-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './forum-post.component.html',
  styleUrl: './forum-post.component.scss',
})
export class ForumPostComponent implements OnInit {
  private readonly api   = inject(ForumApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta  = inject(Meta);
  readonly auth          = inject(AuthService);

  readonly post          = signal<ForumPost | null>(null);
  readonly replies       = signal<ForumReply[]>([]);
  readonly repliesTotal  = signal(0);
  readonly repliesPage   = signal(1);
  readonly loading       = signal(true);
  readonly loadingReplies = signal(false);
  readonly error         = signal<string | null>(null);

  readonly replyBody     = signal('');
  readonly submitting    = signal(false);
  readonly replyError    = signal<string | null>(null);

  private readonly postId = this.route.snapshot.paramMap.get('id')!;

  ngOnInit(): void {
    this.loadPost();
  }

  async loadPost(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [post, repliesPage] = await Promise.all([
        this.api.getPost(this.postId),
        this.api.getReplies(this.postId, 1),
      ]);
      this.post.set(post);
      this.replies.set(repliesPage.replies);
      this.repliesTotal.set(repliesPage.total);
      this.title.setTitle(`${post.title} — Foro 3DPrecios`);
      this.meta.updateTag({ name: 'description', content: post.body.slice(0, 160) });
    } catch {
      this.error.set('No se pudo cargar el post.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMoreReplies(): Promise<void> {
    this.loadingReplies.set(true);
    try {
      const next = this.repliesPage() + 1;
      const res  = await this.api.getReplies(this.postId, next);
      this.replies.update((prev) => [...prev, ...res.replies]);
      this.repliesPage.set(next);
    } finally {
      this.loadingReplies.set(false);
    }
  }

  async submitReply(): Promise<void> {
    const body = this.replyBody().trim();
    if (body.length < 10) {
      this.replyError.set('La respuesta debe tener al menos 10 caracteres.');
      return;
    }
    this.submitting.set(true);
    this.replyError.set(null);
    try {
      const reply = await this.api.createReply(this.postId, body);
      this.replies.update((prev) => [...prev, reply]);
      this.replyBody.set('');
    } catch (e: unknown) {
      this.replyError.set(e instanceof Error ? e.message : 'Error al enviar la respuesta.');
    } finally {
      this.submitting.set(false);
    }
  }

  async toggleLike(reply: ForumReply): Promise<void> {
    if (!this.auth.isLoggedIn()) return;
    try {
      const res = await this.api.toggleLike(reply.id);
      this.replies.update((prev) =>
        prev.map((r) =>
          r.id === reply.id
            ? { ...r, likedByMe: res.liked, likes: res.liked ? r.likes + 1 : r.likes - 1 }
            : r,
        ),
      );
    } catch { /* silencio */ }
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
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  hasMoreReplies(): boolean {
    return this.replies().length < this.repliesTotal();
  }
}
