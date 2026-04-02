import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { environment } from '../../../../environments/environment';

declare let DISQUS: { reset: (config: unknown) => void } | undefined;

@Component({
  selector: 'app-disqus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div id="disqus_thread" aria-label="Comentarios"></div>
    <noscript>
      Activa JavaScript para ver los
      <a href="https://disqus.com/?ref_noscript" rel="noopener noreferrer" target="_blank">comentarios de Disqus</a>.
    </noscript>
  `,
  styles: [`:host { display: block; }`],
})
export class DisqusComponent {
  readonly identifier = input.required<string>();

  private readonly doc        = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    effect(() => {
      const id  = this.identifier();
      const url = this.doc.location?.href ?? '';
      if (!isPlatformBrowser(this.platformId) || !id) return;

      const win = this.doc.defaultView as Window & {
        disqus_config?: () => void;
        DISQUS?: { reset: (cfg: unknown) => void };
      };

      if (win.DISQUS) {
        win.DISQUS.reset({
          reload: true,
          config(this: { page: { identifier: string; url: string } }) {
            this.page.identifier = id;
            this.page.url        = url;
          },
        });
      } else {
        win.disqus_config = function(this: { page: { identifier: string; url: string } }) {
          this.page.url        = url;
          this.page.identifier = id;
        };
        const s = this.doc.createElement('script');
        s.src   = `https://${environment.disqusShortname}.disqus.com/embed.js`;
        s.setAttribute('data-timestamp', String(Date.now()));
        s.async = true;
        this.doc.body.appendChild(s);
      }
    });
  }
}
