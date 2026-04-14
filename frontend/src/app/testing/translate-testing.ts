import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TranslateLoader,
  provideTranslateLoader,
  provideTranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of } from 'rxjs';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type { AppLanguage } from '@app/core/i18n/app-language';

const TRANSLATIONS_DIR = resolve(process.cwd(), 'src/assets/i18n');

function readTranslation(language: AppLanguage): TranslationObject {
  return JSON.parse(
    readFileSync(resolve(TRANSLATIONS_DIR, `${language}.json`), 'utf8'),
  ) as TranslationObject;
}

const TEST_TRANSLATIONS: Record<AppLanguage, TranslationObject> = {
  en: readTranslation('en'),
  de: readTranslation('de'),
};

class StaticTranslateLoader extends TranslateLoader {
  getTranslation(language: string) {
    return of(TEST_TRANSLATIONS[language as AppLanguage] ?? {});
  }
}

export function provideTranslateTesting(): Provider[] {
  return [
    provideTranslateService({
      loader: provideTranslateLoader(StaticTranslateLoader),
      fallbackLang: 'en',
    }),
    AppI18nService,
  ];
}

export async function initializeI18nForTests(language: AppLanguage = 'en'): Promise<AppI18nService> {
  const service = TestBed.inject(AppI18nService);
  await service.initialize(language);
  return service;
}
