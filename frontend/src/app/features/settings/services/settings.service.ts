import { Injectable, signal } from '@angular/core';

import { isAppLanguage } from '@app/core/i18n/app-language';
import { isLogSortBasis } from '@app/features/logs/models/logs-view.model';

import type {
  AppConfig,
  AzurePreferences,
  GeneralConfig,
  LiveRefreshIntervalSeconds,
  LogsPreferences,
} from '../models/app-config.model';
import { createDefaultAppConfig, isAppAppearance } from '../models/app-config.model';

const STORAGE_KEY = 'obsidian-console:config';
const LIVE_REFRESH_INTERVALS = [5, 10, 30, 60] as const;

// Persisted shape: the current keys plus the ones retired by past renames.
type StoredLogsPreferences = Partial<LogsPreferences> & {
  // Retired when tail mode became live mode; still read once so an upgrading
  // user keeps the interval they picked.
  tailRefreshIntervalSeconds?: unknown;
};

function isLiveRefreshIntervalSeconds(
  value: unknown,
): value is LiveRefreshIntervalSeconds {
  return LIVE_REFRESH_INTERVALS.includes(value as LiveRefreshIntervalSeconds);
}

function resolveLiveRefreshInterval(
  stored: StoredLogsPreferences,
  fallback: LiveRefreshIntervalSeconds,
): LiveRefreshIntervalSeconds {
  if (isLiveRefreshIntervalSeconds(stored.liveRefreshIntervalSeconds)) {
    return stored.liveRefreshIntervalSeconds;
  }

  if (isLiveRefreshIntervalSeconds(stored.tailRefreshIntervalSeconds)) {
    return stored.tailRefreshIntervalSeconds;
  }

  return fallback;
}

function loadFromStorage(): AppConfig {
  const defaults = createDefaultAppConfig();

  if (typeof localStorage === 'undefined') {
    return structuredClone(defaults);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const storedLogs: StoredLogsPreferences = parsed.logs ?? {};
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
      // Built key by key rather than spread: a blindly spread legacy key would
      // be copied into the in-memory object and written back by every persist().
      logs: {
        logLevelHighlightingEnabled:
          typeof storedLogs.logLevelHighlightingEnabled === 'boolean'
            ? storedLogs.logLevelHighlightingEnabled
            : defaults.logs.logLevelHighlightingEnabled,
        liveRefreshIntervalSeconds: resolveLiveRefreshInterval(
          storedLogs,
          defaults.logs.liveRefreshIntervalSeconds,
        ),
        sortBasis: isLogSortBasis(storedLogs.sortBasis)
          ? storedLogs.sortBasis
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
