import type { AppLanguage } from '@app/core/i18n/app-language';
import { detectPreferredLanguage } from '@app/core/i18n/app-language';
import { LogSortBasis } from '@app/features/logs/models/logs-view.model';

export interface AzurePreferences {
  lastSubscriptionId: string;
  lastStorageAccountName: string;
  lastContainerName: string;
}

export type RefreshInterval = 5 | 15 | 60;
export type RetentionPolicy = '30d' | '90d' | 'manual';
export type LiveRefreshIntervalSeconds = 5 | 10 | 30 | 60;
export type AppAppearance = 'system' | 'dark' | 'light';

const APP_APPEARANCES = ['system', 'dark', 'light'] as const;

export interface GeneralConfig {
  refreshIntervalMinutes: RefreshInterval;
  retentionPolicy: RetentionPolicy;
  language: AppLanguage;
  appearance: AppAppearance;
}

export interface AppConfig {
  azure: AzurePreferences;
  general: GeneralConfig;
  logs: LogsPreferences;
}

export interface LogsPreferences {
  logLevelHighlightingEnabled: boolean;
  liveRefreshIntervalSeconds: LiveRefreshIntervalSeconds;
  sortBasis: LogSortBasis;
}

export const DEFAULT_APP_CONFIG: AppConfig = createDefaultAppConfig('en');

export function createDefaultAppConfig(language = detectPreferredLanguage()): AppConfig {
  return {
    azure: {
      lastSubscriptionId: '',
      lastStorageAccountName: '',
      lastContainerName: '',
    },
    general: {
      refreshIntervalMinutes: 15,
      retentionPolicy: '30d',
      language,
      appearance: 'system',
    },
    logs: {
      logLevelHighlightingEnabled: true,
      liveRefreshIntervalSeconds: 5,
      sortBasis: LogSortBasis.LastModified,
    },
  };
}

export function isAppAppearance(value: unknown): value is AppAppearance {
  return typeof value === 'string' && APP_APPEARANCES.includes(value as AppAppearance);
}
