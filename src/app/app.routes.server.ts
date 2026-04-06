import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas con parámetros dinámicos → CSR (datos externos ≠ disponibles en SSR)
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
  // Foro — rutas dinámicas renderizadas en el cliente
  {
    path: 'foro/c/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'foro/post/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'foro/nuevo',
    renderMode: RenderMode.Client,
  },
  // Resto → prerender estático
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
