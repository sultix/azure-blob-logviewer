import { Injectable, inject } from '@angular/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type {
  BlobViewExportResult,
  BlobViewMode,
  BlobViewLinesResponse,
  BlobViewSearchRequest,
  BlobViewSearchResponse,
  BlobViewSessionStatus,
  OpenBlobViewSessionRequest,
} from '@app/features/logs/models/blob-view.model';
import type { LogEntry } from '@app/features/logs/models/log-entry.model';
import type {
  AzureAuthState,
  AzureBlobItem,
  AzureBlobTextChunk,
  AzureBlobTextChunkRequest,
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
  readBlobTextChunk(request: AzureBlobTextChunkRequest): Promise<AzureBlobTextChunk>;
  openBlobViewSession(request: OpenBlobViewSessionRequest): Promise<BlobViewSessionStatus>;
  getBlobViewStatus(sessionId: string): Promise<BlobViewSessionStatus>;
  setBlobViewSessionMode(sessionId: string, mode: BlobViewMode): Promise<BlobViewSessionStatus>;
  getBlobViewLines(sessionId: string, startLine: number, lineCount: number): Promise<BlobViewLinesResponse>;
  searchBlobView(request: BlobViewSearchRequest): Promise<BlobViewSearchResponse>;
  exportBlobViewSession(sessionId: string): Promise<BlobViewExportResult>;
  closeBlobViewSession(sessionId: string): Promise<void>;
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
  ReadBlobTextChunk(request: AzureBlobTextChunkRequest): Promise<AzureBlobTextChunk | null>;
  OpenBlobViewSession(request: OpenBlobViewSessionRequest): Promise<BlobViewSessionStatus | null>;
  GetBlobViewStatus(sessionId: string): Promise<BlobViewSessionStatus | null>;
  SetBlobViewSessionMode(sessionId: string, mode: BlobViewMode): Promise<BlobViewSessionStatus | null>;
  GetBlobViewLines(sessionId: string, startLine: number, lineCount: number): Promise<BlobViewLinesResponse | null>;
  SearchBlobView(request: BlobViewSearchRequest): Promise<BlobViewSearchResponse | null>;
  ExportBlobViewSession(sessionId: string): Promise<BlobViewExportResult | null>;
  CloseBlobViewSession(sessionId: string): Promise<void>;
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

  async readBlobTextChunk(request: AzureBlobTextChunkRequest): Promise<AzureBlobTextChunk> {
    const result = await this.bridge().ReadBlobTextChunk(request);
    if (!result) {
      throw new Error(this.i18n.translate('common.errors.noResponseFromBackend'));
    }
    return result;
  }

  async openBlobViewSession(request: OpenBlobViewSessionRequest): Promise<BlobViewSessionStatus> {
    const result = await this.bridge().OpenBlobViewSession(request);
    if (!result) {
      throw new Error(this.i18n.translate('common.errors.noResponseFromBackend'));
    }
    return normalizeBlobViewSessionStatus(result);
  }

  async getBlobViewStatus(sessionId: string): Promise<BlobViewSessionStatus> {
    const result = await this.bridge().GetBlobViewStatus(sessionId);
    if (!result) {
      throw new Error(this.i18n.translate('common.errors.noResponseFromBackend'));
    }
    return normalizeBlobViewSessionStatus(result);
  }

  async setBlobViewSessionMode(
    sessionId: string,
    mode: BlobViewMode,
  ): Promise<BlobViewSessionStatus> {
    const result = await this.bridge().SetBlobViewSessionMode(sessionId, mode);
    if (!result) {
      throw new Error(this.i18n.translate('common.errors.noResponseFromBackend'));
    }
    return normalizeBlobViewSessionStatus(result);
  }

  async getBlobViewLines(sessionId: string, startLine: number, lineCount: number): Promise<BlobViewLinesResponse> {
    const result = await this.bridge().GetBlobViewLines(sessionId, startLine, lineCount);
    if (!result) {
      throw new Error(this.i18n.translate('common.errors.noResponseFromBackend'));
    }
    return normalizeBlobViewLinesResponse(result);
  }

  async searchBlobView(request: BlobViewSearchRequest): Promise<BlobViewSearchResponse> {
    const result = await this.bridge().SearchBlobView(request);
    if (!result) {
      throw new Error(this.i18n.translate('common.errors.noResponseFromBackend'));
    }
    return normalizeBlobViewSearchResponse(result);
  }

  async exportBlobViewSession(sessionId: string): Promise<BlobViewExportResult> {
    const result = await this.bridge().ExportBlobViewSession(sessionId);
    return result ?? { cancelled: true };
  }

  async closeBlobViewSession(sessionId: string): Promise<void> {
    return this.bridge().CloseBlobViewSession(sessionId);
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

function normalizeBlobViewSessionStatus(status: BlobViewSessionStatus): BlobViewSessionStatus {
  return {
    ...status,
    mode: status.mode ?? 'snapshot',
    tailPreviewLines: status.tailPreviewLines ?? [],
  };
}

function normalizeBlobViewLinesResponse(response: BlobViewLinesResponse): BlobViewLinesResponse {
  return {
    ...response,
    lines: response.lines ?? [],
  };
}

function normalizeBlobViewSearchResponse(response: BlobViewSearchResponse): BlobViewSearchResponse {
  return {
    ...response,
    matches: response.matches ?? [],
  };
}
