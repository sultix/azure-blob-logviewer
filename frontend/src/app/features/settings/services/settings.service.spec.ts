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
        logs: { logLevelHighlightingEnabled: false },
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
      appearance: 'system',
    });
    expect(service.logs()).toEqual({
      logLevelHighlightingEnabled: false,
      liveRefreshIntervalSeconds: 5,
      sortBasis: LogSortBasis.LastModified,
    });
  });

  it('adopts the retired tail refresh interval and drops the legacy key', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logs: { tailRefreshIntervalSeconds: 30 },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    // toEqual fails on extra properties, so this also proves the legacy key
    // never reaches the in-memory preferences.
    expect(service.logs()).toEqual({
      logLevelHighlightingEnabled: true,
      liveRefreshIntervalSeconds: 30,
      sortBasis: LogSortBasis.LastModified,
    });
  });

  it('prefers the live refresh interval over the retired tail key', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logs: { tailRefreshIntervalSeconds: 30, liveRefreshIntervalSeconds: 5 },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.logs().liveRefreshIntervalSeconds).toBe(5);
  });

  it('purges the retired tail key from storage on the next write', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logs: { tailRefreshIntervalSeconds: 30 },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    service.updateLogsPreferences({ logLevelHighlightingEnabled: false });

    const persisted = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(persisted).not.toContain('tailRefreshIntervalSeconds');
    expect(persisted).toContain('"liveRefreshIntervalSeconds":30');
  });

  it('falls back to the default refresh interval for an unsupported stored value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logs: { liveRefreshIntervalSeconds: 999 },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.logs().liveRefreshIntervalSeconds).toBe(5);
  });

  it('falls back to the default for the retired one-second live refresh interval', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logs: { liveRefreshIntervalSeconds: 1 },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.logs().liveRefreshIntervalSeconds).toBe(5);
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
      appearance: 'dark',
    });
    service.updateLogsPreferences({
      logLevelHighlightingEnabled: false,
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
      appearance: 'dark',
    });
    expect(service.logs()).toEqual({
      logLevelHighlightingEnabled: false,
      liveRefreshIntervalSeconds: 5,
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

  it('falls back to the default appearance when the persisted value is invalid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        general: {
          appearance: 'sepia',
        },
      }),
    );

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.general().appearance).toBe('system');
  });
});
