import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import {
  SUPPORTED_APP_LANGUAGES,
  appLanguageToLocale,
  detectPreferredLanguage,
  type AppLanguage,
} from './app-language';

@Injectable({ providedIn: 'root' })
export class AppI18nService {
  private readonly document = inject(DOCUMENT);
  private readonly translateService = inject(TranslateService);

  readonly supportedLanguages = SUPPORTED_APP_LANGUAGES;
  readonly currentLanguage = signal<AppLanguage>('en');
  readonly currentLocale = computed(() => appLanguageToLocale(this.currentLanguage()));

  async initialize(preferredLanguage?: AppLanguage): Promise<void> {
    this.translateService.addLangs([...this.supportedLanguages]);
    await lastValueFrom(this.translateService.setFallbackLang('en'));
    await this.setLanguage(preferredLanguage ?? detectPreferredLanguage());
  }

  async setLanguage(language: AppLanguage): Promise<void> {
    await lastValueFrom(this.translateService.use(language));
    this.currentLanguage.set(language);
    this.document.documentElement.lang = language;
    this.document.title = this.translateService.instant('shell.appName');
  }

  translate(key: string, params?: Record<string, unknown>): string {
    this.currentLanguage();
    return this.translateService.instant(key, params);
  }

  formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLocale(), options).format(value);
  }

  formatRelativeFromNow(value: string | number | Date): string {
    const then = typeof value === 'string' ? new Date(value).getTime() : new Date(value).getTime();
    if (isNaN(then)) {
      return '';
    }

    const diffMs = Date.now() - then;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) {
      return this.translate('common.relativeTime.justNow');
    }
    if (diffMin < 60) {
      return this.translate('common.relativeTime.minutesAgo', { count: diffMin });
    }

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
      return this.translate('common.relativeTime.hoursAgo', { count: diffHr });
    }

    const diffDay = Math.floor(diffHr / 24);
    return this.translate(
      diffDay === 1 ? 'common.relativeTime.dayAgo' : 'common.relativeTime.daysAgo',
      { count: diffDay },
    );
  }
}
