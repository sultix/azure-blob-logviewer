import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type { AppLanguage } from '@app/core/i18n/app-language';
import {
  AppApiService,
  type ConnectionsExportResult,
  type ConnectionsImportResult,
} from '@app/core/services/app-api.service';
import {
  ConnectionsImportError,
  ConnectionsService,
} from '@app/features/connections/services/connections.service';

import { AzureService } from '../services/azure.service';
import { SettingsService } from '../services/settings.service';
import type {
  InitialLargeFileFocus,
  RefreshInterval,
  RetentionPolicy,
} from '../models/app-config.model';

import { AzureLoginComponent } from '../components/azure-login/azure-login.component';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, RouterLink, AzureLoginComponent, TranslatePipe],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(AppApiService);
  private readonly azure = inject(AzureService);
  private readonly i18n = inject(AppI18nService);
  private readonly messageService = inject(MessageService);
  private readonly settings = inject(SettingsService);
  private readonly connections = inject(ConnectionsService);

  // Azure auth
  readonly authStep = this.azure.authStep;
  readonly authError = this.azure.authError;
  readonly azureCliMissing = this.azure.azureCliMissing;

  // General settings
  readonly general = this.settings.general;
  readonly logs = this.settings.logs;
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
  readonly largeFileFocusOptions = computed<{ value: InitialLargeFileFocus; label: string }[]>(() => [
    { value: 'start', label: this.i18n.translate('settings.page.largeFileFocus.start') },
    { value: 'end', label: this.i18n.translate('settings.page.largeFileFocus.end') },
  ]);
  readonly savedConnectionsCount = computed(() => this.connections.connections().length);
  readonly hasSavedConnections = computed(() => this.savedConnectionsCount() > 0);

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

  setInitialLargeFileFocus(value: InitialLargeFileFocus): void {
    this.settings.updateLogsPreferences({ initialLargeFileFocus: value });
  }

  resetSettings(): void {
    this.settings.reset();
    void this.i18n.setLanguage(this.general().language);
  }

  async importConnections(): Promise<void> {
    try {
      const result: ConnectionsImportResult = await this.api.importConnectionsFile();
      if (result.cancelled) return;

      const importedCount = this.connections.importFromJson(result.content);
      this.messageService.add({
        severity: 'success',
        summary: this.i18n.translate('settings.page.savedConnections.toasts.importSuccessTitle'),
        detail: this.i18n.translate('settings.page.savedConnections.toasts.importSuccessDetail', {
          count: importedCount,
        }),
      });
    } catch (error) {
      this.showImportError(error);
    }
  }

  async exportConnections(): Promise<void> {
    if (!this.hasSavedConnections()) return;

    try {
      const result: ConnectionsExportResult = await this.api.exportConnectionsFile(
        this.connections.exportJson()
      );
      if (result.cancelled) return;

      this.messageService.add({
        severity: 'success',
        summary: this.i18n.translate('settings.page.savedConnections.toasts.exportSuccessTitle'),
        detail: this.i18n.translate('settings.page.savedConnections.toasts.exportSuccessDetail', {
          count: this.savedConnectionsCount(),
        }),
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.i18n.translate('settings.page.savedConnections.toasts.exportFileErrorTitle'),
        detail: this.i18n.translate('settings.page.savedConnections.toasts.exportFileErrorDetail'),
      });
    }
  }

  private showImportError(error: unknown): void {
    if (error instanceof ConnectionsImportError) {
      const messageKey =
        error.code === 'invalid_json'
          ? 'settings.page.savedConnections.toasts.invalidJson'
          : 'settings.page.savedConnections.toasts.invalidFile';

      this.messageService.add({
        severity: 'error',
        summary: this.i18n.translate(`${messageKey}Title`),
        detail: this.i18n.translate(`${messageKey}Detail`),
      });
      return;
    }

    this.messageService.add({
      severity: 'error',
      summary: this.i18n.translate('settings.page.savedConnections.toasts.importFileErrorTitle'),
      detail: this.i18n.translate('settings.page.savedConnections.toasts.importFileErrorDetail'),
    });
  }
}
