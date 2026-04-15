import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type { AppLanguage } from '@app/core/i18n/app-language';
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
  imports: [FormsModule, AzureLoginComponent, TranslatePipe],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly azure = inject(AzureService);
  private readonly i18n = inject(AppI18nService);
  private readonly settings = inject(SettingsService);
  private readonly connections = inject(ConnectionsService);

  // Azure auth
  readonly authStep = this.azure.authStep;
  readonly authError = this.azure.authError;
  readonly azureCliMissing = this.azure.azureCliMissing;

  // General settings
  readonly general = this.settings.general;
  readonly refreshOptions = computed(() =>
    ([5, 15, 60] as const).map((value) => ({
      value,
      label:
        value < 60
          ? this.i18n.translate('settings.page.refreshInterval.minutes', { count: value })
          : this.i18n.translate('settings.page.refreshInterval.hour'),
    }))
  );
  readonly retentionOptions = computed<{ value: RetentionPolicy; label: string }[]>(() => [
    { value: '30d', label: this.i18n.translate('settings.page.retention.30d') },
    { value: '90d', label: this.i18n.translate('settings.page.retention.90d') },
    { value: 'manual', label: this.i18n.translate('settings.page.retention.manual') },
  ]);
  readonly languageOptions = computed<{ value: AppLanguage; label: string }[]>(() => [
    { value: 'en', label: this.i18n.translate('common.languageNames.en') },
    { value: 'de', label: this.i18n.translate('common.languageNames.de') },
  ]);

  // Auth status badge
  readonly statusBadge = computed(() => {
    const step = this.authStep();
    switch (step) {
      case 'authenticated':
        return {
          label: this.i18n.translate('settings.page.authBadge.authenticated'),
          class: 'bg-primary-container text-on-primary-container',
        };
      case 'authenticating':
        return {
          label: this.i18n.translate('settings.page.authBadge.authenticating'),
          class: 'bg-tertiary-container text-on-surface',
        };
      case 'error':
        return {
          label: this.i18n.translate('settings.page.authBadge.authFailed'),
          class: 'bg-error-container text-on-surface',
        };
      case 'disconnected':
        return {
          label: this.i18n.translate('settings.page.authBadge.disconnected'),
          class: 'bg-surface-container-highest text-on-surface-variant',
        };
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

  setLanguage(value: AppLanguage): void {
    this.settings.updateGeneral({ language: value });
    void this.i18n.setLanguage(value);
  }

  resetSettings(): void {
    this.settings.reset();
    void this.i18n.setLanguage(this.general().language);
  }

  removeConnection(id: string): void {
    this.connections.remove(id);
  }

  private mapStatusLabel(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return this.i18n.translate('settings.page.savedConnections.status.active');
      case 'syncing':
        return this.i18n.translate('settings.page.savedConnections.status.standby');
      case 'offline':
        return this.i18n.translate('settings.page.savedConnections.status.offline');
      case 'error':
        return this.i18n.translate('settings.page.savedConnections.status.authExpired');
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
