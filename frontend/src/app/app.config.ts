import {
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { AppI18nService } from './core/i18n/app-i18n.service';
import { ObsidianConsolePreset } from './core/theme/primeng-preset';
import { ThemeService } from './core/theme/theme.service';
import { appRoutes } from './app.routes';
import { SettingsService } from './features/settings/services/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
    }),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    provideAppInitializer(() => {
      const settings = inject(SettingsService);
      return inject(AppI18nService).initialize(settings.general().language);
    }),
    MessageService,
    providePrimeNG({
      theme: {
        preset: ObsidianConsolePreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
  ],
};
