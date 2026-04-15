import { Injectable, inject } from '@angular/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type { LogEntry } from '@app/features/logs/models/log-entry.model';
import type {
  AzureAuthState,
  AzureBlobItem,
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';

export interface ConnectionsImportResult {
  cancelled: boolean;
  content: string;
}

export interface ConnectionsExportResult {
  cancelled: boolean;
}

export interface AppApi {
  getVersion(): Promise<string>;
  listLogEntries(): Promise<LogEntry[]>;
  getLogEntry(id: string): Promise<LogEntry | null>;
  startAzureLogin(): Promise<AzureAuthState>;
  restoreAzureSession(): Promise<AzureAuthState>;
  azureLogout(): Promise<void>;
  getAzureAuthState(): Promise<AzureAuthState>;
  listSubscriptions(): Promise<AzureSubscription[]>;
  listStorageAccounts(subscriptionId: string): Promise<AzureStorageAccount[]>;
  listContainers(subscriptionId: string, resourceGroup: string, accountName: string): Promise<AzureContainer[]>;
  listBlobs(accountName: string, containerName: string, prefix: string): Promise<AzureBlobItem[]>;
  downloadBlobContent(accountName: string, containerName: string, blobName: string): Promise<string>;
  importConnectionsFile(): Promise<ConnectionsImportResult>;
  exportConnectionsFile(content: string): Promise<ConnectionsExportResult>;
}

interface WailsAppBridge {
  GetVersion(): Promise<string>;
  ListLogEntries(): Promise<LogEntry[] | null>;
  GetLogEntry(id: string): Promise<LogEntry | null>;
  StartAzureLogin(): Promise<AzureAuthState | null>;
  RestoreAzureSession(): Promise<AzureAuthState | null>;
  AzureLogout(): Promise<void>;
  GetAzureAuthState(): Promise<AzureAuthState | null>;
  ListSubscriptions(): Promise<AzureSubscription[] | null>;
  ListStorageAccounts(subscriptionId: string): Promise<AzureStorageAccount[] | null>;
  ListContainers(subscriptionId: string, resourceGroup: string, accountName: string): Promise<AzureContainer[] | null>;
  ListBlobs(accountName: string, containerName: string, prefix: string): Promise<AzureBlobItem[] | null>;
  DownloadBlobContent(accountName: string, containerName: string, blobName: string): Promise<string>;
  ImportConnectionsFile(): Promise<ConnectionsImportResult | null>;
  ExportConnectionsFile(content: string): Promise<ConnectionsExportResult | null>;
}

interface WailsWindow {
  go?: {
    app?: {
      App?: WailsAppBridge;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class AppApiService implements AppApi {
  private readonly i18n = inject(AppI18nService);

  async getVersion(): Promise<string> {
    return this.bridge().GetVersion();
  }

  async listLogEntries(): Promise<LogEntry[]> {
    const result = await this.bridge().ListLogEntries();
    return result ?? [];
  }

  async getLogEntry(id: string): Promise<LogEntry | null> {
    return this.bridge().GetLogEntry(id);
  }

  async startAzureLogin(): Promise<AzureAuthState> {
    const result = await this.bridge().StartAzureLogin();
    return result ?? {
      authenticated: false,
      errorMessage: this.i18n.translate('common.errors.noResponseFromBackend'),
    };
  }

  async restoreAzureSession(): Promise<AzureAuthState> {
    const result = await this.bridge().RestoreAzureSession();
    return result ?? { authenticated: false };
  }

  async azureLogout(): Promise<void> {
    return this.bridge().AzureLogout();
  }

  async getAzureAuthState(): Promise<AzureAuthState> {
    const result = await this.bridge().GetAzureAuthState();
    return result ?? { authenticated: false };
  }

  async listSubscriptions(): Promise<AzureSubscription[]> {
    const result = await this.bridge().ListSubscriptions();
    return result ?? [];
  }

  async listStorageAccounts(subscriptionId: string): Promise<AzureStorageAccount[]> {
    const result = await this.bridge().ListStorageAccounts(subscriptionId);
    return result ?? [];
  }

  async listContainers(subscriptionId: string, resourceGroup: string, accountName: string): Promise<AzureContainer[]> {
    const result = await this.bridge().ListContainers(subscriptionId, resourceGroup, accountName);
    return result ?? [];
  }

  async listBlobs(accountName: string, containerName: string, prefix: string): Promise<AzureBlobItem[]> {
    const result = await this.bridge().ListBlobs(accountName, containerName, prefix);
    return result ?? [];
  }

  async downloadBlobContent(accountName: string, containerName: string, blobName: string): Promise<string> {
    return this.bridge().DownloadBlobContent(accountName, containerName, blobName);
  }

  async importConnectionsFile(): Promise<ConnectionsImportResult> {
    const result = await this.bridge().ImportConnectionsFile();
    return result ?? { cancelled: true, content: '' };
  }

  async exportConnectionsFile(content: string): Promise<ConnectionsExportResult> {
    const result = await this.bridge().ExportConnectionsFile(content);
    return result ?? { cancelled: true };
  }

  private bridge(): WailsAppBridge {
    const bridge = (window as unknown as WailsWindow).go?.app?.App;
    if (!bridge) {
      throw new Error(this.i18n.translate('common.errors.wailsBridgeUnavailable'));
    }
    return bridge;
  }
}
