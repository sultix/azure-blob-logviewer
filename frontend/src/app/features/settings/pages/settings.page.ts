import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConnectionsService } from '@app/features/connections/services/connections.service';
import type { ConnectionStatus } from '@app/features/connections/models/storage-connection.model';

import { SettingsService } from '../services/settings.service';
import type {
  AuthStatus,
  AzureAuthConfig,
  RefreshInterval,
  RetentionPolicy,
} from '../models/app-config.model';

interface SavedConnectionRowVm {
  id: string;
  name: string;
  redactedId: string;
  statusLabel: string;
  statusClass: string;
  icon: string;
}

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly connections = inject(ConnectionsService);

  readonly auth = this.settings.auth;
  readonly general = this.settings.general;
  readonly authStatus = this.settings.authStatus;
  readonly statusMessage = this.settings.statusMessage;
  readonly lastSuccessfulSync = this.settings.lastSuccessfulSync;

  readonly secretVisible = signal(false);
  readonly pristine = signal(true);

  readonly refreshOptions: RefreshInterval[] = [5, 15, 60];
  readonly retentionOptions: { value: RetentionPolicy; label: string }[] = [
    { value: '30d', label: 'Keep for 30 days' },
    { value: '90d', label: 'Keep for 90 days' },
    { value: 'manual', label: 'Persistent (Manual purge)' },
  ];

  readonly isFormValid = computed(() => {
    const a = this.auth();
    return !!(
      a.tenantId &&
      a.clientId &&
      a.clientSecret &&
      a.storageAccount &&
      a.defaultContainer
    );
  });

  readonly canApply = computed(() => this.isFormValid() && !this.pristine());

  readonly savedConnections = computed<SavedConnectionRowVm[]>(() =>
    this.connections.connections().map((c) => ({
      id: c.id,
      name: c.name.toUpperCase().replace(/-/g, '_'),
      redactedId: this.redactId(c.id),
      statusLabel: this.mapStatusLabel(c.status),
      statusClass: this.mapStatusClass(c.status),
      icon: this.mapStatusIcon(c.status),
    }))
  );

  readonly statusBadge = computed(() => {
    const status = this.authStatus();
    switch (status) {
      case 'authenticated':
        return { label: 'AUTHENTICATED', class: 'bg-primary-container text-on-primary-container' };
      case 'testing':
        return { label: 'TESTING', class: 'bg-tertiary-container text-on-surface' };
      case 'failed':
        return { label: 'AUTH FAILED', class: 'bg-error-container text-on-surface' };
      case 'awaiting':
        return { label: 'AWAITING AUTH', class: 'bg-surface-container-highest text-on-surface-variant' };
    }
  });

  ngOnInit(): void {
    void this.connections.load();
  }

  updateAuthField<K extends keyof AzureAuthConfig>(
    key: K,
    value: AzureAuthConfig[K]
  ): void {
    this.settings.updateAuth({ [key]: value } as Partial<AzureAuthConfig>);
    this.pristine.set(false);
  }

  setRefreshInterval(value: RefreshInterval): void {
    this.settings.updateGeneral({ refreshIntervalMinutes: value });
  }

  setRetentionPolicy(value: RetentionPolicy): void {
    this.settings.updateGeneral({ retentionPolicy: value });
  }

  toggleSecret(): void {
    this.secretVisible.update((v) => !v);
  }

  testConnection(): void {
    void this.settings.testConnection();
  }

  applyCredentials(): void {
    this.settings.applyCredentials();
    this.pristine.set(true);
  }

  reset(): void {
    this.settings.reset();
    this.pristine.set(true);
  }

  removeConnection(id: string): void {
    this.connections.remove(id);
  }

  formatAuthStatus(status: AuthStatus): string {
    return status.toUpperCase();
  }

  private mapStatusLabel(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return 'Active';
      case 'syncing':
        return 'Standby';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Auth Expired';
    }
  }

  private mapStatusClass(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return 'bg-primary-container text-on-primary-container';
      case 'syncing':
        return 'bg-tertiary-container text-on-surface';
      case 'offline':
        return 'bg-surface-container-highest text-on-surface-variant';
      case 'error':
        return 'bg-error-container text-on-surface';
    }
  }

  private mapStatusIcon(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return 'pi-check-circle';
      case 'syncing':
        return 'pi-sync pi-spin';
      case 'offline':
        return 'pi-power-off';
      case 'error':
        return 'pi-exclamation-triangle';
    }
  }

  private redactId(id: string): string {
    if (id.length <= 8) return id;
    return `${id.slice(0, 4)}…${id.slice(-4)}`;
  }
}
