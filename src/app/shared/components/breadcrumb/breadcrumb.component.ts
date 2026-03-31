import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Ruta de navegación">
      <ol class="breadcrumb__list">
        <li class="breadcrumb__item">
          <a class="breadcrumb__link" routerLink="/">Inicio</a>
        </li>
        @for (item of items(); track item.label; let last = $last) {
          <li class="breadcrumb__item" [attr.aria-current]="last ? 'page' : null">
            <span class="breadcrumb__separator" aria-hidden="true">/</span>
            @if (item.url && !last) {
              <a class="breadcrumb__link" [routerLink]="item.url">{{ item.label }}</a>
            } @else {
              <span class="breadcrumb__current">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>

    <!-- JSON-LD BreadcrumbList -->
    <script type="application/ld+json">{{ jsonLd() }}</script>
  `,
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  readonly items = input.required<BreadcrumbItem[]>();

  readonly jsonLd = computed(() => {
    const allItems = [{ label: 'Inicio', url: '/' }, ...this.items()];
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: allItems.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.label,
        item: item.url ? `https://3dprecios.cl${item.url}` : undefined,
      })),
    });
  });
}
