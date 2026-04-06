import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-comments-policy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './comments-policy.component.html',
  styleUrl: './comments-policy.component.scss',
})
export class CommentsPolicyComponent {
  private readonly title = inject(Title);
  private readonly meta  = inject(Meta);

  constructor() {
    this.title.setTitle('Política de Comentarios — 3DPrecios');
    this.meta.updateTag({ name: 'description', content: 'Normas de la comunidad y política de comentarios de 3DPrecios.' });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
