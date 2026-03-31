import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: '3DPrecios — Compara precios de impresión 3D en Chile',
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./pages/category/category.component').then((m) => m.CategoryComponent),
    title: 'Categorías — 3DPrecios',
  },
  {
    path: 'categorias/:slug',
    loadComponent: () =>
      import('./pages/catalog/catalog.component').then((m) => m.CatalogComponent),
  },
  {
    path: 'productos/:slug',
    loadComponent: () =>
      import('./pages/product-detail/product-detail.component').then(
        (m) => m.ProductDetailComponent,
      ),
  },
  {
    path: 'tiendas',
    loadComponent: () =>
      import('./pages/store/store.component').then((m) => m.StoreComponent),
    title: 'Tiendas — 3DPrecios',
  },
  {
    path: 'tiendas/:slug',
    loadComponent: () =>
      import('./pages/store/store.component').then((m) => m.StoreComponent),
  },
  {
    path: 'privacidad',
    loadComponent: () =>
      import('./pages/legal/privacy/privacy.component').then((m) => m.PrivacyComponent),
    title: 'Política de Privacidad — 3DPrecios',
  },
  {
    path: 'terminos',
    loadComponent: () =>
      import('./pages/legal/terms/terms.component').then((m) => m.TermsComponent),
    title: 'Términos de Uso — 3DPrecios',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
