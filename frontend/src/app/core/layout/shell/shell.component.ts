import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Toast } from 'primeng/toast';
import { filter, map, startWith } from 'rxjs';

import { AppApiService } from '@app/core/services/app-api.service';
import { WindowControlsService } from '@app/core/services/window-controls.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, Toast, TranslatePipe],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  private readonly appApi = inject(AppApiService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly controls = inject(WindowControlsService);
  protected readonly appLogoPath = 'assets/branding/app-logo-80.png';
  protected readonly appVersion = signal<string | null>(null);
  protected readonly isMaximized = computed(() => this.controls.isMaximized());
  protected readonly showBackButton = computed(() =>
    this.isBackButtonRoute(this.currentUrl()),
  );
  protected readonly maximizeButtonLabel = computed(() =>
    this.controls.isMaximized()
      ? 'shell.window.restore'
      : 'shell.window.maximize',
  );

  ngOnInit(): void {
    void this.loadVersion();
  }

  protected onToggleMaximize(): void {
    void this.controls.toggleMaximize();
  }

  protected onMinimize(): void {
    this.controls.minimize();
  }

  protected onClose(): void {
    this.controls.close();
  }

  private isBackButtonRoute(url: string): boolean {
    const segments =
      this.router.parseUrl(url).root.children['primary']?.segments.map(({ path }) => path) ?? [];

    return (
      (segments.length === 1 &&
        (segments[0] === 'logs' || segments[0] === 'settings')) ||
      (segments.length === 2 && segments[0] === 'logs')
    );
  }

  private async loadVersion(): Promise<void> {
    try {
      this.appVersion.set(await this.appApi.getVersion());
    } catch {
      this.appVersion.set(null);
    }
  }
}
