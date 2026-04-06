import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ForumApiService } from '../../../core/services/forum-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ForumCategory } from '../../../core/models';

@Component({
  selector: 'app-forum-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './forum-home.component.html',
  styleUrl: './forum-home.component.scss',
})
export class ForumHomeComponent implements OnInit {
  private readonly api   = inject(ForumApiService);
  private readonly title = inject(Title);
  private readonly meta  = inject(Meta);
  readonly auth          = inject(AuthService);

  readonly categories = signal<ForumCategory[]>([]);
  readonly loading    = signal(true);
  readonly error      = signal<string | null>(null);

  ngOnInit(): void {
    this.title.setTitle('Foro Comunidad — 3DPrecios');
    this.meta.updateTag({ name: 'description', content: 'Foro de la comunidad de impresión 3D en Chile. Comparte proyectos, preguntas y descuentos.' });

    this.api.getCategories().then((cats) => {
      this.categories.set(cats);
      this.loading.set(false);
    }).catch(() => {
      this.error.set('No se pudieron cargar las categorías. Intenta de nuevo.');
      this.loading.set(false);
    });
  }
}
