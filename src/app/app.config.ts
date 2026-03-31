import { ApplicationConfig, provideZonelessChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, withViewTransitions } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { FirebaseApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes,
      withPreloading(PreloadAllModules),
      withViewTransitions(),
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore((injector) => getFirestore(injector.get(FirebaseApp) as any)),
    provideAuth(() => getAuth()), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
};
