import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { CategoryService } from '../../core/services/category.service';

@Component({
  selector: 'app-category',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="cat-hub container" id="main-content">
      <h1 class="cat-hub__title">Explorar categorías</h1>
      <p class="cat-hub__sub">Filamentos, impresoras, resinas y más en tiendas chilenas.</p>
      <ul class="cat-hub__grid" role="list">
        @for (cat of categories; track cat.id) {
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
  private readonly titleService   = inject(Title);
  private readonly meta           = inject(Meta);
  private readonly categoryService = inject(CategoryService);

  readonly categories = this.categoryService.categories;

  constructor() {
    this.titleService.setTitle('Categorías — 3DPrecios');
    this.meta.updateTag({ name: 'description', content: 'Explora filamentos, impresoras 3D, resinas y repuestos en tiendas chilenas.' });
  }
}
