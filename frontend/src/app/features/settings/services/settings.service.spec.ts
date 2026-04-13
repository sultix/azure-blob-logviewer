import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_APP_CONFIG } from '../models/app-config.model';

import { SettingsService } from './settings.service';

const STORAGE_KEY = 'obsidian-console:config';

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts with the default configuration when nothing is stored', () => {
    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.azure()).toEqual(DEFAULT_APP_CONFIG.azure);
    expect(service.general()).toEqual(DEFAULT_APP_CONFIG.general);
  });

  it('merges stored partial configuration with defaults', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        azure: { lastSubscriptionId: 'sub-1' },
        general: { retentionPolicy: 'manual' },
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
    });
  });

  it('falls back to defaults when persisted JSON is invalid', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.azure()).toEqual(DEFAULT_APP_CONFIG.azure);
    expect(service.general()).toEqual(DEFAULT_APP_CONFIG.general);
  });

  it('updates and persists azure and general preferences', () => {
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
    });

    expect(service.azure()).toEqual({
      lastSubscriptionId: 'sub-1',
      lastStorageAccountName: 'storage-a',
      lastContainerName: '',
    });
    expect(service.general()).toEqual({
      refreshIntervalMinutes: 60,
      retentionPolicy: '90d',
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({
        azure: service.azure(),
        general: service.general(),
      }),
    );
  });

  it('resets the configuration back to defaults and persists it', () => {
    TestBed.configureTestingModule({
      providers: [SettingsService],
    });
    const service = TestBed.inject(SettingsService);
    service.updateAzurePreferences({ lastSubscriptionId: 'sub-1' });
    service.updateGeneral({ retentionPolicy: 'manual' });

    service.reset();

    expect(service.azure()).toEqual(DEFAULT_APP_CONFIG.azure);
    expect(service.general()).toEqual(DEFAULT_APP_CONFIG.general);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(DEFAULT_APP_CONFIG));
  });
});
