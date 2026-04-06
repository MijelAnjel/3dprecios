import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { UserProfile } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (profile()) {
      <button
        class="user-avatar"
        type="button"
        [attr.aria-label]="'Menú de ' + profile()!.displayName"
        (click)="toggleMenu()"
      >
        @if (profile()!.photoURL) {
          <img
            class="user-avatar__img"
            [src]="profile()!.photoURL"
            [alt]="profile()!.displayName"
            width="32"
            height="32"
            referrerpolicy="no-referrer"
          />
        } @else {
          <span class="user-avatar__fallback" aria-hidden="true">
            {{ profile()!.displayName.charAt(0).toUpperCase() }}
          </span>
        }
      </button>

      @if (menuOpen()) {
        <div class="user-avatar__menu" role="menu" aria-label="Menú de usuario">
          <div class="user-avatar__menu-name">{{ profile()!.displayName }}</div>
          <hr class="user-avatar__menu-divider" />
          <button
            class="user-avatar__menu-item"
            type="button"
            role="menuitem"
            (click)="logout()"
          >
            Cerrar sesión
          </button>
        </div>
      }
    }
  `,
  styleUrl: './user-avatar.component.scss',
  host: {
    class: 'user-avatar-host',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class UserAvatarComponent {
  private auth = inject(AuthService);

  readonly profile   = input<UserProfile | null>(null);
  readonly menuOpen  = signal(false);

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-avatar-host')) {
      this.menuOpen.set(false);
    }
  }

  async logout(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.logout();
  }
}
