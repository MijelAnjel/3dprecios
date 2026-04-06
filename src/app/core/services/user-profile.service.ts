import { Injectable, inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { UserProfile } from '../models';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private firestore  = inject(Firestore);
  private platformId = inject(PLATFORM_ID);

  readonly currentProfile = signal<UserProfile | null>(null);

  /**
   * Verifica si existe el perfil en Firestore. Si no, lo crea.
   * Se llama tras un login exitoso.
   */
  async ensureProfile(firebaseUser: User): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const ref      = doc(this.firestore, 'users', firebaseUser.uid);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      this.currentProfile.set(this.fromFirestore(snapshot.data(), firebaseUser.uid));
    } else {
      const newProfile: Omit<UserProfile, 'createdAt'> & { createdAt: unknown } = {
        uid:         firebaseUser.uid,
        displayName: firebaseUser.displayName ?? 'Usuario',
        photoURL:    firebaseUser.photoURL ?? '',
        role:        'user',
        createdAt:   serverTimestamp(),
        postCount:   0,
        replyCount:  0,
        banned:      false,
      };
      await setDoc(ref, newProfile);
      this.currentProfile.set({
        ...newProfile,
        createdAt: new Date(),
      });
    }
  }

  clearProfile(): void {
    this.currentProfile.set(null);
  }

  private fromFirestore(data: Record<string, unknown>, uid: string): UserProfile {
    return {
      uid,
      displayName: (data['displayName'] as string) ?? 'Usuario',
      photoURL:    (data['photoURL'] as string) ?? '',
      role:        (data['role'] as UserProfile['role']) ?? 'user',
      createdAt:   (data['createdAt'] as { toDate(): Date } | null)?.toDate() ?? new Date(),
      postCount:   (data['postCount'] as number) ?? 0,
      replyCount:  (data['replyCount'] as number) ?? 0,
      banned:      (data['banned'] as boolean) ?? false,
    };
  }
}
