import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LogSortBasis } from '@app/features/logs/models/logs-view.model';

import { createDefaultAppConfig } from '../models/app-config.model';

import { SettingsService } from './settings.service';

const STORAGE_KEY = 'obsidian-console:config';

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

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    setNavigatorLanguages(['en-US']);
    TestBed.resetTestingModule();
  });

  it('starts with the detected default configuration when nothing is stored', () => {
    setNavigatorLanguages(['de-DE']);

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.azure()).toEqual(createDefaultAppConfig('de').azure);
    expect(service.general()).toEqual(createDefaultAppConfig('de').general);
    expect(service.logs()).toEqual(createDefaultAppConfig('de').logs);
  });

  it('merges stored partial configuration with detected defaults when language is missing', () => {
    setNavigatorLanguages(['de-DE']);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        azure: { lastSubscriptionId: 'sub-1' },
        general: { retentionPolicy: 'manual' },
        logs: { wordWrapEnabled: true },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.azure()).toEqual({
      lastSubscriptionId: 'sub-1',
      lastStorageAccountName: '',
      lastContainerName: '',
    });
    expect(service.general()).toEqual({
      refreshIntervalMinutes: 15,
      retentionPolicy: 'manual',
      language: 'de',
    });
    expect(service.logs()).toEqual({
      wordWrapEnabled: true,
      tailRefreshIntervalSeconds: 10,
      sortBasis: LogSortBasis.LastModified,
    });
  });

  it('falls back to defaults when persisted JSON is invalid', () => {
    setNavigatorLanguages(['de-DE']);
    localStorage.setItem(STORAGE_KEY, '{not-json');

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    const defaults = createDefaultAppConfig('de');
    expect(service.azure()).toEqual(defaults.azure);
    expect(service.general()).toEqual(defaults.general);
    expect(service.logs()).toEqual(defaults.logs);
  });

  it('updates and persists azure, general, and logs preferences', () => {
    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    service.updateAzurePreferences({
      lastSubscriptionId: 'sub-1',
      lastStorageAccountName: 'storage-a',
    });
    service.updateGeneral({
      refreshIntervalMinutes: 60,
      retentionPolicy: '90d',
      language: 'de',
    });
    service.updateLogsPreferences({
      wordWrapEnabled: true,
      sortBasis: LogSortBasis.Created,
    });

    expect(service.azure()).toEqual({
      lastSubscriptionId: 'sub-1',
      lastStorageAccountName: 'storage-a',
      lastContainerName: '',
    });
    expect(service.general()).toEqual({
      refreshIntervalMinutes: 60,
      retentionPolicy: '90d',
      language: 'de',
    });
    expect(service.logs()).toEqual({
      wordWrapEnabled: true,
      tailRefreshIntervalSeconds: 10,
      sortBasis: LogSortBasis.Created,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({
        azure: service.azure(),
        general: service.general(),
        logs: service.logs(),
      }),
    );
  });

  it('resets the configuration back to detected defaults and persists it', () => {
    setNavigatorLanguages(['de-DE']);

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);
    service.updateAzurePreferences({ lastSubscriptionId: 'sub-1' });
    service.updateGeneral({ retentionPolicy: 'manual' });

    service.reset();

    const defaults = createDefaultAppConfig('de');
    expect(service.azure()).toEqual(defaults.azure);
    expect(service.general()).toEqual(defaults.general);
    expect(service.logs()).toEqual(defaults.logs);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(defaults));
  });
});
