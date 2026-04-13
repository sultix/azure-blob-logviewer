import { Injectable } from '@angular/core';

import type { LogEntry } from '@app/features/logs/models/log-entry.model';
import type {
  AzureAuthState,
  AzureBlobItem,
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';

export interface AppApi {
  getVersion(): Promise<string>;
  listLogEntries(): Promise<LogEntry[]>;
  getLogEntry(id: string): Promise<LogEntry | null>;
  startAzureLogin(): Promise<AzureAuthState>;
  azureLogout(): Promise<void>;
  getAzureAuthState(): Promise<AzureAuthState>;
  listSubscriptions(): Promise<AzureSubscription[]>;
  listStorageAccounts(subscriptionId: string): Promise<AzureStorageAccount[]>;
  listContainers(subscriptionId: string, resourceGroup: string, accountName: string): Promise<AzureContainer[]>;
  listBlobs(accountName: string, containerName: string, prefix: string): Promise<AzureBlobItem[]>;
  downloadBlobContent(accountName: string, containerName: string, blobName: string): Promise<string>;
}

interface WailsAppBridge {
  GetVersion(): Promise<string>;
  ListLogEntries(): Promise<LogEntry[] | null>;
  GetLogEntry(id: string): Promise<LogEntry | null>;
  StartAzureLogin(): Promise<AzureAuthState | null>;
  AzureLogout(): Promise<void>;
  GetAzureAuthState(): Promise<AzureAuthState | null>;
  ListSubscriptions(): Promise<AzureSubscription[] | null>;
  ListStorageAccounts(subscriptionId: string): Promise<AzureStorageAccount[] | null>;
  ListContainers(subscriptionId: string, resourceGroup: string, accountName: string): Promise<AzureContainer[] | null>;
  ListBlobs(accountName: string, containerName: string, prefix: string): Promise<AzureBlobItem[] | null>;
  DownloadBlobContent(accountName: string, containerName: string, blobName: string): Promise<string>;
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
    return result ?? { authenticated: false, errorMessage: 'No response from backend' };
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

  private bridge(): WailsAppBridge {
    const bridge = (window as unknown as WailsWindow).go?.app?.App;
    if (!bridge) {
      throw new Error(
        'Wails bridge unavailable. Run `wails dev` to generate bindings.'
      );
    }
    return bridge;
  }
}
