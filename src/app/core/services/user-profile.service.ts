import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models';

interface WorkerUserResponse {
  uid:         string;
  displayName: string;
  photoURL:    string | null;
  role:        'user' | 'moderator' | 'admin';
  banned:      number;
  createdAt:   string;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly currentProfile = signal<UserProfile | null>(null);

  /**
   * Crea o actualiza el perfil en D1 a través del Worker.
   * Se llama tras un login exitoso.
   */
  async ensureProfile(firebaseUser: User): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const token = await firebaseUser.getIdToken();
    const res   = await fetch(`${environment.workerUrl}/api/users/me`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        displayName: firebaseUser.displayName ?? 'Usuario',
        photoURL:    firebaseUser.photoURL,
      }),
    });

    if (!res.ok) return;

    const data = (await res.json()) as WorkerUserResponse;
    this.currentProfile.set(this.fromWorker(data));
  }

  clearProfile(): void {
    this.currentProfile.set(null);
  }

  private fromWorker(data: WorkerUserResponse): UserProfile {
    return {
      uid:         data.uid,
      displayName: data.displayName,
      photoURL:    data.photoURL ?? '',
      role:        data.role,
      createdAt:   new Date(data.createdAt),
      postCount:   0,
      replyCount:  0,
      banned:      data.banned === 1,
    };
  }
}
