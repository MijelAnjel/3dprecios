import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Category } from '../../core/models';

const ALL_CATEGORIES: Category[] = [
  { id: '1', slug: 'filamentos-pla',    name: 'Filamentos PLA',    icon: '🧵', specFields: [] },
  { id: '2', slug: 'filamentos-abs',    name: 'Filamentos ABS',    icon: '🔶', specFields: [] },
  { id: '3', slug: 'filamentos-petg',   name: 'Filamentos PETG',   icon: '🟦', specFields: [] },
  { id: '4', slug: 'impresoras-fdm',    name: 'Impresoras FDM',    icon: '🖨️', specFields: [] },
  { id: '5', slug: 'impresoras-resina', name: 'Impresoras Resina', icon: '💧', specFields: [] },
  { id: '6', slug: 'resinas',           name: 'Resinas',           icon: '🧪', specFields: [] },
  { id: '7', slug: 'repuestos',         name: 'Repuestos',         icon: '🔧', specFields: [] },
  { id: '8', slug: 'herramientas',      name: 'Herramientas',      icon: '🛠️', specFields: [] },
];

@Component({
  selector: 'app-category',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="cat-hub container" id="main-content">
      <h1 class="cat-hub__title">Explorar categorías</h1>
      <p class="cat-hub__sub">Filamentos, impresoras, resinas y más en tiendas chilenas.</p>
      <ul class="cat-hub__grid" role="list">
        @for (cat of categories(); track cat.id) {
          <li>
            <a class="cat-hub__card" [routerLink]="['/categorias', cat.slug]" [attr.aria-label]="'Ver ' + cat.name">
              <span class="cat-hub__icon" aria-hidden="true">{{ cat.icon }}</span>
              <h2 class="cat-hub__name">{{ cat.name }}</h2>
              <span class="cat-hub__arrow" aria-hidden="true">→</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `,
  styleUrl: './category.component.scss',
})
export class CategoryComponent {
  private readonly titleService = inject(Title);
  private readonly meta         = inject(Meta);
  readonly categories = signal<Category[]>(ALL_CATEGORIES);

  constructor() {
    this.titleService.setTitle('Categorías — 3DPrecios');
    this.meta.updateTag({ name: 'description', content: 'Explora filamentos, impresoras 3D, resinas y repuestos en tiendas chilenas.' });
  }
}
