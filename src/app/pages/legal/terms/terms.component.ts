import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {
  private readonly title = inject(Title);
  private readonly meta  = inject(Meta);

  constructor() {
    this.title.setTitle('Términos de Uso — 3DPrecios');
    this.meta.updateTag({ name: 'description', content: 'Términos y condiciones de uso de 3DPrecios.' });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
