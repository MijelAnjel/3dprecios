import { Injectable, inject, computed } from '@angular/core';
import {
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
  user,
} from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserProfileService } from './user-profile.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth           = inject(Auth);
  private profileService = inject(UserProfileService);

  /** Signal del usuario Firebase Auth (null = sesión cerrada). */
  readonly firebaseUser = toSignal(user(this.auth), { initialValue: null });

  /** Signal del perfil extendido cargado desde Firestore. */
  readonly userProfile = this.profileService.currentProfile;

  readonly isLoggedIn  = computed(() => this.firebaseUser() !== null);
  readonly isAdmin     = computed(() => this.userProfile()?.role === 'admin');
  readonly isModerator = computed(() =>
    ['admin', 'moderator'].includes(this.userProfile()?.role ?? ''),
  );

  async loginWithGoogle(): Promise<void> {
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    await this.profileService.ensureProfile(credential.user);
  }

  async loginWithGitHub(): Promise<void> {
    const credential = await signInWithPopup(this.auth, new GithubAuthProvider());
    await this.profileService.ensureProfile(credential.user);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.profileService.clearProfile();
  }
}
