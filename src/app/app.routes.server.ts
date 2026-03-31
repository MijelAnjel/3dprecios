import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas con parámetros dinámicos → CSR (Firestore data ≠ compatible con Node.js SSR)
  {
    path: 'categorias/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'productos/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tiendas/:slug',
    renderMode: RenderMode.Client,
  },
  // Resto → prerender estático
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
