import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  private readonly title = inject(Title);
  private readonly meta  = inject(Meta);

  constructor() {
    this.title.setTitle('Política de Privacidad — 3DPrecios');
    this.meta.updateTag({ name: 'description', content: 'Política de privacidad de 3DPrecios. Información sobre cómo recopilamos y usamos tus datos.' });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
