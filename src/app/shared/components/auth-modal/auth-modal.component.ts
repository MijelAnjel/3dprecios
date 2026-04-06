import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'auth-modal-title',
    class: 'auth-modal-backdrop',
    '(click)': 'onBackdropClick($event)',
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="auth-modal" #panel>
      <button
        class="auth-modal__close"
        type="button"
        aria-label="Cerrar"
        (click)="closed.emit()"
      >✕</button>

      <div class="auth-modal__logo" aria-hidden="true">⬡</div>
      <h2 id="auth-modal-title" class="auth-modal__title">Únete a la comunidad</h2>
      <p class="auth-modal__sub">Inicia sesión para publicar, responder y participar.</p>

      @if (error()) {
        <p class="auth-modal__error" role="alert">{{ error() }}</p>
      }

      <div class="auth-modal__buttons">
        <button
          class="auth-modal__btn auth-modal__btn--google"
          type="button"
          [disabled]="loading()"
          (click)="loginGoogle()"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.6 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.3C9.7 35.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C40.9 36.2 44 30.5 44 24c0-1.3-.1-2.6-.4-3.5z"/>
          </svg>
          Continuar con Google
        </button>

        <button
          class="auth-modal__btn auth-modal__btn--github"
          type="button"
          [disabled]="loading()"
          (click)="loginGitHub()"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 0a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 5 18 5.3 18 5.3c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 0z"/>
          </svg>
          Continuar con GitHub
        </button>
      </div>

      <p class="auth-modal__legal">
        Al iniciar sesión aceptas nuestra
        <a routerLink="/politica-comentarios" (click)="closed.emit()">política de comunidad</a>.
      </p>
    </div>
  `,
  styleUrl: './auth-modal.component.scss',
})
export class AuthModalComponent {
  private auth = inject(AuthService);

  readonly closed  = output<void>();
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      const panel = (inject(ElementRef).nativeElement as HTMLElement)
        .querySelector<HTMLElement>('.auth-modal__close');
      panel?.focus();
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('auth-modal-backdrop')) {
      this.closed.emit();
    }
  }

  async loginGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginWithGoogle();
      this.closed.emit();
    } catch {
      this.error.set('No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  async loginGitHub(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginWithGitHub();
      this.closed.emit();
    } catch {
      this.error.set('No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
