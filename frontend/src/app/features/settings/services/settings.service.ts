import { Injectable, signal } from '@angular/core';

import type {
  AppConfig,
  AzurePreferences,
  GeneralConfig,
} from '../models/app-config.model';
import { DEFAULT_APP_CONFIG } from '../models/app-config.model';

const STORAGE_KEY = 'obsidian-console:config';

function loadFromStorage(): AppConfig {
  if (typeof localStorage === 'undefined') {
    return structuredClone(DEFAULT_APP_CONFIG);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_APP_CONFIG);
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      azure: { ...DEFAULT_APP_CONFIG.azure, ...(parsed.azure ?? {}) },
      general: { ...DEFAULT_APP_CONFIG.general, ...(parsed.general ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_APP_CONFIG);
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly initial = loadFromStorage();

  readonly azure = signal<AzurePreferences>(this.initial.azure);
  readonly general = signal<GeneralConfig>(this.initial.general);

  updateAzurePreferences(partial: Partial<AzurePreferences>): void {
    this.azure.update((current) => ({ ...current, ...partial }));
    this.persist();
  }

  updateGeneral(partial: Partial<GeneralConfig>): void {
    this.general.update((current) => ({ ...current, ...partial }));
    this.persist();
  }

  reset(): void {
    this.azure.set(structuredClone(DEFAULT_APP_CONFIG.azure));
    this.general.set(structuredClone(DEFAULT_APP_CONFIG.general));
    this.persist();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    const payload: AppConfig = {
      azure: this.azure(),
      general: this.general(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}
