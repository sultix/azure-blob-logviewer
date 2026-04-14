import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConnectionsService } from '@app/features/connections/services/connections.service';
import type { ConnectionStatus } from '@app/features/connections/models/storage-connection.model';

import { AzureService } from '../services/azure.service';
import { SettingsService } from '../services/settings.service';
import type { RefreshInterval, RetentionPolicy } from '../models/app-config.model';

import { AzureLoginComponent } from '../components/azure-login.component';

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
  imports: [FormsModule, AzureLoginComponent],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly azure = inject(AzureService);
  private readonly settings = inject(SettingsService);
  private readonly connections = inject(ConnectionsService);

  // Azure auth
  readonly authStep = this.azure.authStep;
  readonly authError = this.azure.authError;

  // General settings
  readonly general = this.settings.general;
  readonly refreshOptions: RefreshInterval[] = [5, 15, 60];
  readonly retentionOptions: { value: RetentionPolicy; label: string }[] = [
    { value: '30d', label: 'Keep for 30 days' },
    { value: '90d', label: 'Keep for 90 days' },
    { value: 'manual', label: 'Persistent (Manual purge)' },
  ];

  // Auth status badge
  readonly statusBadge = computed(() => {
    const step = this.authStep();
    switch (step) {
      case 'authenticated':
        return { label: 'AUTHENTICATED', class: 'bg-primary-container text-on-primary-container' };
      case 'authenticating':
        return { label: 'AUTHENTICATING', class: 'bg-tertiary-container text-on-surface' };
      case 'error':
        return { label: 'AUTH FAILED', class: 'bg-error-container text-on-surface' };
      case 'disconnected':
        return { label: 'DISCONNECTED', class: 'bg-surface-container-highest text-on-surface-variant' };
    }
  });

  // Saved connections
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

  ngOnInit(): void {
    void this.connections.load();
  }

  onLogin(): void {
    void this.azure.login();
  }

  onLogout(): void {
    void this.azure.logout();
  }

  setRefreshInterval(value: RefreshInterval): void {
    this.settings.updateGeneral({ refreshIntervalMinutes: value });
  }

  setRetentionPolicy(value: RetentionPolicy): void {
    this.settings.updateGeneral({ retentionPolicy: value });
  }

  resetSettings(): void {
    this.settings.reset();
  }

  removeConnection(id: string): void {
    this.connections.remove(id);
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
