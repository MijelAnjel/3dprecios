import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const forumRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./forum-home/forum-home.component').then((m) => m.ForumHomeComponent),
    title: 'Foro — 3DPrecios',
  },
  {
    path: 'c/:slug',
    loadComponent: () =>
      import('./forum-category/forum-category.component').then((m) => m.ForumCategoryComponent),
  },
  {
    path: 'post/:id',
    loadComponent: () =>
      import('./forum-post/forum-post.component').then((m) => m.ForumPostComponent),
  },
  {
    path: 'nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./new-post/new-post.component').then((m) => m.NewPostComponent),
    title: 'Nuevo Post — Foro 3DPrecios',
  },
];
