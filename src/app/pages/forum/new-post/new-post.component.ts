import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ForumApiService } from '../../../core/services/forum-api.service';
import { ForumCategory } from '../../../core/models';

@Component({
  selector: 'app-new-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './new-post.component.html',
  styleUrl: './new-post.component.scss',
})
export class NewPostComponent implements OnInit {
  private readonly api    = inject(ForumApiService);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);

  readonly categories  = signal<ForumCategory[]>([]);
  readonly loading     = signal(true);
  readonly submitting  = signal(false);
  readonly error       = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    categoryId: ['', Validators.required],
    title:      ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    body:       ['', [Validators.required, Validators.minLength(20), Validators.maxLength(10000)]],
  });

  ngOnInit(): void {
    this.api.getCategories().then((cats) => {
      this.categories.set(cats);
    }).catch(() => {
      this.error.set('No se pudieron cargar las categorías.');
    }).finally(() => {
      this.loading.set(false);
    });
  }

  get bodyLength(): number {
    return this.form.controls.body.value.length;
  }

  get titleLength(): number {
    return this.form.controls.title.value.length;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const { categoryId, title, body } = this.form.getRawValue();
      const post = await this.api.createPost({ categoryId, title, body });
      await this.router.navigate(['/foro/post', post.id]);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Error al crear el post.');
      this.submitting.set(false);
    }
  }
}
