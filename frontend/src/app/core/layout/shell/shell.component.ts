import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Toast } from 'primeng/toast';
import { filter } from 'rxjs';

import { AppApiService } from '@app/core/services/app-api.service';
import { WindowControlsService } from '@app/core/services/window-controls.service';

interface NavigationHistoryState {
  readonly history: string[];
  readonly pendingBackTarget: string | null;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, Toast, TranslatePipe],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  private readonly appApi = inject(AppApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly navigationHistory = signal(this.initialNavigationHistoryState());
  protected readonly controls = inject(WindowControlsService);
  protected readonly appLogoPath = 'assets/branding/app-logo-80.png';
  protected readonly appVersion = signal<string | null>(null);
  protected readonly isMaximized = computed(() => this.controls.isMaximized());
  protected readonly currentUrl = computed(() => this.navigationHistory().history.at(-1) ?? '');
  protected readonly showBackButton = computed(() =>
    this.isBackButtonRoute(this.currentUrl()),
  );
  protected readonly maximizeButtonLabel = computed(() =>
    this.controls.isMaximized()
      ? 'shell.window.restore'
      : 'shell.window.maximize',
  );

  ngOnInit(): void {
    this.trackNavigationHistory();
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

  protected onBack(): void {
    const history = this.navigationHistory().history;
    if (history.length > 1) {
      const nextHistory = history.slice(0, -1);
      const targetUrl = nextHistory.at(-1) ?? '/connections';
      this.navigationHistory.set({
        history: nextHistory,
        pendingBackTarget: targetUrl,
      });
      void this.router.navigateByUrl(targetUrl);
      return;
    }

    this.navigationHistory.set({
      history: ['/connections'],
      pendingBackTarget: '/connections',
    });
    void this.router.navigateByUrl('/connections');
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

  private trackNavigationHistory(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.updateNavigationHistory(event.urlAfterRedirects);
      });
  }

  private updateNavigationHistory(url: string): void {
    const state = this.navigationHistory();
    const currentUrl = state.history.at(-1) ?? null;
    if (url === currentUrl) {
      if (state.pendingBackTarget !== null) {
        this.navigationHistory.set({
          ...state,
          pendingBackTarget: null,
        });
      }
      return;
    }

    if (state.pendingBackTarget !== null) {
      this.navigationHistory.set({
        history: state.history,
        pendingBackTarget: null,
      });
      return;
    }

    this.navigationHistory.set({
      history: [...state.history, url],
      pendingBackTarget: null,
    });
  }

  private initialNavigationHistoryState(): NavigationHistoryState {
    return {
      history: [this.router.url],
      pendingBackTarget: null,
    };
  }
}
