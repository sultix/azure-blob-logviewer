import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { SettingsService } from '@app/features/settings/services/settings.service';
import type { AppAppearance } from '@app/features/settings/models/app-config.model';

type ResolvedTheme = Exclude<AppAppearance, 'system'>;

const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(SettingsService);
  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  readonly appearance = computed(() => this.settings.general().appearance);
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const appearance = this.appearance();
    if (appearance === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }

    return appearance;
  });

  constructor() {
    effect((onCleanup) => {
      if (this.appearance() !== 'system') {
        return;
      }

      const mediaQuery = this.getSystemThemeQuery();
      if (!mediaQuery) {
        return;
      }

      this.systemPrefersDark.set(mediaQuery.matches);
      const handleChange = (event: MediaQueryListEvent): void => {
        this.systemPrefersDark.set(event.matches);
      };

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
        onCleanup(() => mediaQuery.removeEventListener('change', handleChange));
        return;
      }

      mediaQuery.addListener(handleChange);
      onCleanup(() => mediaQuery.removeListener(handleChange));
    });

    effect(() => {
      this.applyTheme(this.resolvedTheme());
    });
  }

  initialize(): void {
    this.systemPrefersDark.set(this.readSystemPrefersDark());
    this.applyTheme(this.resolvedTheme());
  }

  private readSystemPrefersDark(): boolean {
    return this.getSystemThemeQuery()?.matches ?? false;
  }

  private getSystemThemeQuery(): MediaQueryList | null {
    const view = this.document.defaultView;
    if (!view || typeof view.matchMedia !== 'function') {
      return null;
    }

    return view.matchMedia(SYSTEM_THEME_QUERY);
  }

  private applyTheme(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    const body = this.document.body;

    root.classList.toggle('dark', theme === 'dark');
    root.dataset['theme'] = theme;
    root.style.colorScheme = theme;

    if (!body) {
      return;
    }

    body.dataset['theme'] = theme;
    body.style.colorScheme = theme;
  }
}
