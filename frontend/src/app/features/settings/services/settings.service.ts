import { Injectable, signal } from '@angular/core';

import { isAppLanguage } from '@app/core/i18n/app-language';
import { isLogSortBasis } from '@app/features/logs/models/logs-view.model';

import type {
  AppConfig,
  AzurePreferences,
  GeneralConfig,
  LogsPreferences,
} from '../models/app-config.model';
import { createDefaultAppConfig, isAppAppearance } from '../models/app-config.model';

const STORAGE_KEY = 'obsidian-console:config';

function loadFromStorage(): AppConfig {
  const defaults = createDefaultAppConfig();

  if (typeof localStorage === 'undefined') {
    return structuredClone(defaults);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      azure: { ...defaults.azure, ...(parsed.azure ?? {}) },
      general: {
        ...defaults.general,
        ...(parsed.general ?? {}),
        language: isAppLanguage(parsed.general?.language)
          ? parsed.general.language
          : defaults.general.language,
        appearance: isAppAppearance(parsed.general?.appearance)
          ? parsed.general.appearance
          : defaults.general.appearance,
      },
      logs: {
        ...defaults.logs,
        ...(parsed.logs ?? {}),
        sortBasis: isLogSortBasis(parsed.logs?.sortBasis)
          ? parsed.logs.sortBasis
          : defaults.logs.sortBasis,
      },
    };
  } catch {
    return structuredClone(defaults);
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly initial = loadFromStorage();

  readonly azure = signal<AzurePreferences>(this.initial.azure);
  readonly general = signal<GeneralConfig>(this.initial.general);
  readonly logs = signal<LogsPreferences>(this.initial.logs);

  updateAzurePreferences(partial: Partial<AzurePreferences>): void {
    this.azure.update((current) => ({ ...current, ...partial }));
    this.persist();
  }

  updateGeneral(partial: Partial<GeneralConfig>): void {
    this.general.update((current) => ({ ...current, ...partial }));
    this.persist();
  }

  updateLogsPreferences(partial: Partial<LogsPreferences>): void {
    this.logs.update((current) => ({ ...current, ...partial }));
    this.persist();
  }

  reset(): void {
    const defaults = createDefaultAppConfig();
    this.azure.set(structuredClone(defaults.azure));
    this.general.set(structuredClone(defaults.general));
    this.logs.set(structuredClone(defaults.logs));
    this.persist();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    const payload: AppConfig = {
      azure: this.azure(),
      general: this.general(),
      logs: this.logs(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}
