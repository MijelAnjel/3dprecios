import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    const router = inject(Router);
    const scrollPositions = new Map<string, number>();
    let trigger = 'imperative';
    let currentUrl = '/';

    afterNextRender(() => {
      router.events.subscribe(e => {
        if (e instanceof NavigationStart) {
          trigger = e.navigationTrigger ?? 'imperative';
          scrollPositions.set(currentUrl, window.scrollY);
        }
        if (e instanceof NavigationEnd) {
          currentUrl = e.urlAfterRedirects;
          // Fragment navigations are handled by each component via ActivatedRoute.fragment
          if (currentUrl.includes('#')) return;

          if (trigger === 'popstate' && scrollPositions.has(currentUrl)) {
            window.scrollTo({ top: scrollPositions.get(currentUrl)!, behavior: 'instant' });
          } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
          }
        }
      });
    });
  }
}

