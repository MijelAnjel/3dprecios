import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';
import { ForumCategory, ForumPost, ForumReply } from '../models';

export interface PostsPage   { posts: ForumPost[];   total: number; page: number; pageSize: number; }
export interface RepliesPage { replies: ForumReply[]; total: number; page: number; pageSize: number; }

@Injectable({ providedIn: 'root' })
export class ForumApiService {
  private readonly auth       = inject(Auth);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly BASE       = environment.workerUrl;

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.auth.currentUser?.getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.BASE}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? `POST ${path} → ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'PUT',
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? `PUT ${path} → ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'DELETE',
      headers: await this.authHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? `DELETE ${path} → ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Categorías ─────────────────────────────────────────────────────────────

  getCategories(): Promise<ForumCategory[]> {
    return this.get('/api/forum/categories');
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  getPosts(categorySlug: string, page = 1): Promise<PostsPage> {
    const params = new URLSearchParams({ categorySlug, page: String(page) });
    return this.get(`/api/forum/posts?${params}`);
  }

  getPost(id: string): Promise<ForumPost> {
    return this.get(`/api/forum/posts/${id}`);
  }

  createPost(data: { categoryId: string; title: string; body: string }): Promise<ForumPost> {
    return this.post('/api/forum/posts', data);
  }

  updatePost(id: string, data: { body?: string; isSolved?: boolean; isPinned?: boolean; isLocked?: boolean }): Promise<{ id: string; updatedAt: string }> {
    return this.put(`/api/forum/posts/${id}`, data);
  }

  deletePost(id: string): Promise<{ deleted: boolean }> {
    return this.delete(`/api/forum/posts/${id}`);
  }

  // ── Replies ────────────────────────────────────────────────────────────────

  getReplies(postId: string, page = 1): Promise<RepliesPage> {
    return this.get(`/api/forum/posts/${postId}/replies?page=${page}`);
  }

  createReply(postId: string, body: string): Promise<ForumReply> {
    return this.post(`/api/forum/posts/${postId}/replies`, { body });
  }

  updateReply(replyId: string, body: string): Promise<{ id: string; updatedAt: string }> {
    return this.put(`/api/forum/replies/${replyId}`, { body });
  }

  deleteReply(replyId: string): Promise<{ deleted: boolean }> {
    return this.delete(`/api/forum/replies/${replyId}`);
  }

  toggleLike(replyId: string): Promise<{ liked: boolean }> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve({ liked: false });
    return this.post(`/api/forum/replies/${replyId}/like`, {});
  }
}
