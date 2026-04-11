export interface AzureAuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  storageAccount: string;
  defaultContainer: string;
}

export type RefreshInterval = 5 | 15 | 60;
export type RetentionPolicy = '30d' | '90d' | 'manual';

export interface GeneralConfig {
  refreshIntervalMinutes: RefreshInterval;
  retentionPolicy: RetentionPolicy;
}

export type AuthStatus = 'awaiting' | 'testing' | 'authenticated' | 'failed';

export interface AppConfig {
  auth: AzureAuthConfig;
  general: GeneralConfig;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  auth: {
    tenantId: '',
    clientId: '',
    clientSecret: '',
    storageAccount: '',
    defaultContainer: '',
  },
  general: {
    refreshIntervalMinutes: 15,
    retentionPolicy: '30d',
  },
};
