import type { AppLanguage } from '@app/core/i18n/app-language';
import { detectPreferredLanguage } from '@app/core/i18n/app-language';

export interface AzurePreferences {
  lastSubscriptionId: string;
  lastStorageAccountName: string;
  lastContainerName: string;
}

export type RefreshInterval = 5 | 15 | 60;
export type RetentionPolicy = '30d' | '90d' | 'manual';

export interface GeneralConfig {
  refreshIntervalMinutes: RefreshInterval;
  retentionPolicy: RetentionPolicy;
  language: AppLanguage;
}

export interface AppConfig {
  azure: AzurePreferences;
  general: GeneralConfig;
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
    },
  };
}
