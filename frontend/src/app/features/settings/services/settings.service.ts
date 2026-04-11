import { Injectable, signal } from '@angular/core';

import type {
  AppConfig,
  AuthStatus,
  AzureAuthConfig,
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
      auth: { ...DEFAULT_APP_CONFIG.auth, ...(parsed.auth ?? {}) },
      general: { ...DEFAULT_APP_CONFIG.general, ...(parsed.general ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_APP_CONFIG);
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly initial = loadFromStorage();

  readonly auth = signal<AzureAuthConfig>(this.initial.auth);
  readonly general = signal<GeneralConfig>(this.initial.general);
  readonly authStatus = signal<AuthStatus>(
    this.initial.auth.tenantId && this.initial.auth.clientId
      ? 'authenticated'
      : 'awaiting'
  );
  readonly statusMessage = signal<string | null>(null);
  readonly lastSuccessfulSync = signal<string | null>(null);

  updateAuth(partial: Partial<AzureAuthConfig>): void {
    this.auth.update((current) => ({ ...current, ...partial }));
    if (this.authStatus() === 'authenticated') {
      this.authStatus.set('awaiting');
      this.statusMessage.set('Credentials changed — test to re-authenticate.');
    }
  }

  updateGeneral(partial: Partial<GeneralConfig>): void {
    this.general.update((current) => ({ ...current, ...partial }));
    this.persist();
  }

  async testConnection(): Promise<void> {
    const auth = this.auth();
    if (
      !auth.tenantId ||
      !auth.clientId ||
      !auth.clientSecret ||
      !auth.storageAccount
    ) {
      this.authStatus.set('failed');
      this.statusMessage.set('Missing required credentials.');
      return;
    }
    this.authStatus.set('testing');
    this.statusMessage.set('Contacting Azure...');
    await new Promise((resolve) => setTimeout(resolve, 600));
    // TODO: call AppApiService.testAzureConnection() once backend lands.
    this.authStatus.set('failed');
    this.statusMessage.set('Azure backend not yet wired up — stub response.');
  }

  applyCredentials(): void {
    this.persist();
    this.authStatus.set('authenticated');
    this.statusMessage.set('Credentials saved locally.');
    this.lastSuccessfulSync.set(new Date().toISOString());
  }

  reset(): void {
    this.auth.set(structuredClone(DEFAULT_APP_CONFIG.auth));
    this.general.set(structuredClone(DEFAULT_APP_CONFIG.general));
    this.authStatus.set('awaiting');
    this.statusMessage.set(null);
    this.persist();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    const payload: AppConfig = {
      auth: this.auth(),
      general: this.general(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}
