import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { AppI18nService } from './app-i18n.service';

function setNavigatorLanguages(languages: string[]): void {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: languages[0] ?? 'en-US',
  });
}

describe('AppI18nService', () => {
  beforeEach(() => {
    setNavigatorLanguages(['en-US']);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideTranslateTesting()],
    });
  });

  it('detects the initial language from the browser and syncs the html lang attribute', async () => {
    setNavigatorLanguages(['de-DE']);
    const service = TestBed.inject(AppI18nService);

    await service.initialize();

    expect(service.currentLanguage()).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('switches language at runtime for TS-side translations and document metadata', async () => {
    const service = await initializeI18nForTests('en');

    expect(service.translate('shell.navigation.settings')).toBe('Settings');
    expect(document.title).toBe('Azure Blob Log Viewer');

    await service.setLanguage('de');

    expect(service.translate('shell.navigation.settings')).toBe('Einstellungen');
    expect(document.documentElement.lang).toBe('de');
    expect(document.title).toBe('Azure Blob Log Viewer');
  });
});
