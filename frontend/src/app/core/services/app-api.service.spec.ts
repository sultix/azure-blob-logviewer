import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogEntry } from '@app/features/logs/models/log-entry.model';
import type {
  BlobViewLinesResponse,
  BlobViewSearchResponse,
  BlobViewSessionStatus,
  OpenBlobViewSessionRequest,
} from '@app/features/logs/models/blob-view.model';
import type {
  AzureBlobItem,
  AzureBlobTextChunk,
  AzureBlobTextChunkRequest,
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { AppApiService } from './app-api.service';

interface MockBridge {
  GetVersion: ReturnType<typeof vi.fn<() => Promise<string>>>;
  ListLogEntries: ReturnType<typeof vi.fn<() => Promise<LogEntry[] | null>>>;
  GetLogEntry: ReturnType<typeof vi.fn<(id: string) => Promise<LogEntry | null>>>;
  StartAzureLogin: ReturnType<
    typeof vi.fn<
      () => Promise<{ authenticated: boolean; errorMessage?: string; failureReason?: string } | null>
    >
  >;
  RestoreAzureSession: ReturnType<
    typeof vi.fn<
      () => Promise<{ authenticated: boolean; errorMessage?: string; failureReason?: string } | null>
    >
  >;
  AzureLogout: ReturnType<typeof vi.fn<() => Promise<void>>>;
  GetAzureAuthState: ReturnType<
    typeof vi.fn<
      () => Promise<{ authenticated: boolean; errorMessage?: string; failureReason?: string } | null>
    >
  >;
  ListSubscriptions: ReturnType<typeof vi.fn<() => Promise<AzureSubscription[] | null>>>;
  ListStorageAccounts: ReturnType<
    typeof vi.fn<(subscriptionId: string) => Promise<AzureStorageAccount[] | null>>
  >;
  ListContainers: ReturnType<
    typeof vi.fn<
      (subscriptionId: string, resourceGroup: string, accountName: string) => Promise<AzureContainer[] | null>
    >
  >;
  ListBlobs: ReturnType<
    typeof vi.fn<(accountName: string, containerName: string, prefix: string) => Promise<AzureBlobItem[] | null>>
  >;
  ReadBlobTextChunk: ReturnType<
    typeof vi.fn<(request: AzureBlobTextChunkRequest) => Promise<AzureBlobTextChunk | null>>
  >;
  OpenBlobViewSession: ReturnType<
    typeof vi.fn<(request: OpenBlobViewSessionRequest) => Promise<BlobViewSessionStatus | null>>
  >;
  GetBlobViewStatus: ReturnType<
    typeof vi.fn<(sessionId: string) => Promise<BlobViewSessionStatus | null>>
  >;
  GetBlobViewLines: ReturnType<
    typeof vi.fn<
      (sessionId: string, startLine: number, lineCount: number) => Promise<BlobViewLinesResponse | null>
    >
  >;
  SearchBlobView: ReturnType<
    typeof vi.fn<(request: { sessionId: string; query: string; cursor: number }) => Promise<BlobViewSearchResponse | null>>
  >;
  ExportBlobViewSession: ReturnType<
    typeof vi.fn<(sessionId: string) => Promise<{ cancelled: boolean } | null>>
  >;
  CloseBlobViewSession: ReturnType<typeof vi.fn<(sessionId: string) => Promise<void>>>;
  ImportConnectionsFile: ReturnType<
    typeof vi.fn<() => Promise<{ cancelled: boolean; content: string } | null>>
  >;
  ExportConnectionsFile: ReturnType<
    typeof vi.fn<(content: string) => Promise<{ cancelled: boolean } | null>>
  >;
}

interface RuntimeWindow extends Window {
  go?: {
    app?: {
      App?: Partial<MockBridge>;
    };
  };
}

describe('AppApiService', () => {
  let service: AppApiService;
  let runtimeWindow: RuntimeWindow;
  let bridge: MockBridge;

  beforeEach(async () => {
    runtimeWindow = window as RuntimeWindow;
    bridge = createMockBridge();
    runtimeWindow.go = {
      app: {
        App: bridge,
      },
    };

    await TestBed.configureTestingModule({
      providers: [provideTranslateTesting()],
    }).compileComponents();
    await initializeI18nForTests();
    service = TestBed.inject(AppApiService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    delete runtimeWindow.go;
  });

  it('throws a clear error when the Wails bridge is unavailable', async () => {
    delete runtimeWindow.go;

    await expect(service.getVersion()).rejects.toThrow(
      'Wails bridge unavailable. Run `wails dev` to generate bindings.',
    );
  });

  it('normalizes null responses to safe defaults', async () => {
    bridge.ListLogEntries.mockResolvedValue(null);
    bridge.StartAzureLogin.mockResolvedValue(null);
    bridge.RestoreAzureSession.mockResolvedValue(null);
    bridge.GetAzureAuthState.mockResolvedValue(null);
    bridge.ListSubscriptions.mockResolvedValue(null);
    bridge.ListStorageAccounts.mockResolvedValue(null);
    bridge.ListContainers.mockResolvedValue(null);
    bridge.ListBlobs.mockResolvedValue(null);
    bridge.ReadBlobTextChunk.mockResolvedValue(null);
    bridge.ImportConnectionsFile.mockResolvedValue(null);
    bridge.ExportConnectionsFile.mockResolvedValue(null);

    await expect(service.listLogEntries()).resolves.toEqual([]);
    await expect(service.startAzureLogin()).resolves.toEqual({
      authenticated: false,
      errorMessage: 'No response from backend',
    });
    await expect(service.restoreAzureSession()).resolves.toEqual({ authenticated: false });
    await expect(service.getAzureAuthState()).resolves.toEqual({ authenticated: false });
    await expect(service.listSubscriptions()).resolves.toEqual([]);
    await expect(service.listStorageAccounts('sub-1')).resolves.toEqual([]);
    await expect(service.listContainers('sub-1', 'rg-1', 'storage-a')).resolves.toEqual([]);
    await expect(service.listBlobs('storage-a', 'logs', 'prefix/')).resolves.toEqual([]);
    await expect(
      service.readBlobTextChunk({
        accountName: 'storage-a',
        containerName: 'logs',
        blobName: 'app.log',
      }),
    ).rejects.toThrow('No response from backend');
    await expect(service.importConnectionsFile()).resolves.toEqual({ cancelled: true, content: '' });
    await expect(service.exportConnectionsFile('[]')).resolves.toEqual({ cancelled: true });
  });

  it('passes through non-null bridge responses and forwards method arguments', async () => {
    const entry: LogEntry = {
      id: 'log-1',
      container: 'logs',
      blobName: 'app.log',
      createdAt: '2026-04-13T10:30:00Z',
      lastModified: '2026-04-13T10:30:00Z',
      createdLabel: 'Today, 10:30',
      lastModifiedLabel: 'Today, 10:30',
      size: 42,
    };
    const subscriptions: AzureSubscription[] = [
      { id: 'sub-1', displayName: 'Prod', tenantId: 'tenant-1', state: 'Enabled' },
    ];
    const accounts: AzureStorageAccount[] = [
      {
        id: 'acc-1',
        name: 'storage-a',
        location: 'westeurope',
        kind: 'StorageV2',
        resourceGroup: 'rg-1',
        subscriptionId: 'sub-1',
      },
    ];
    const containers: AzureContainer[] = [
      { name: 'logs', lastModified: '2026-04-13T10:30:00Z', leaseState: 'available' },
    ];
    const blobs: AzureBlobItem[] = [
      {
        name: '2026/04/13/app.log',
        size: 1024,
        contentType: 'text/plain',
        createdAt: '2026-04-13T10:00:00Z',
        lastModified: '2026-04-13T10:30:00Z',
        blobType: 'BlockBlob',
      },
    ];
    const chunk: AzureBlobTextChunk = {
      content: 'line 1',
      blobSize: 1024,
      contentType: 'text/plain',
      etag: '"etag-1"',
      lastModified: '2026-04-13T10:30:00Z',
      startOffset: 0,
      endOffsetExclusive: 1024,
      truncatedStart: false,
      truncatedEnd: false,
      isLargeBlob: false,
    };
    const sessionStatus: BlobViewSessionStatus = {
      sessionId: 'session-1',
      blobName: 'app.log',
      blobSize: 1024,
      contentType: 'text/plain',
      bytesDownloaded: 1024,
      indexedLineCount: 2,
      indexedThrough: 1024,
      isComplete: true,
      canEnableWordWrap: true,
      hasPendingBefore: false,
      hasPendingAfter: false,
      focus: 'start',
      tailPreviewLines: [],
    };
    const linesResponse: BlobViewLinesResponse = {
      startLine: 0,
      totalLines: 2,
      isComplete: true,
      lines: [{ lineNumber: 0, content: 'line 1' }],
    };
    const searchResponse: BlobViewSearchResponse = {
      query: 'line',
      matches: [{ lineNumber: 0, preview: 'line 1' }],
      nextCursor: -1,
      isComplete: true,
    };

    bridge.GetVersion.mockResolvedValue('0.1.1');
    bridge.ListLogEntries.mockResolvedValue([entry]);
    bridge.GetLogEntry.mockResolvedValue(entry);
    bridge.StartAzureLogin.mockResolvedValue({ authenticated: true, failureReason: '' });
    bridge.RestoreAzureSession.mockResolvedValue({ authenticated: true, failureReason: '' });
    bridge.GetAzureAuthState.mockResolvedValue({ authenticated: true, failureReason: '' });
    bridge.ListSubscriptions.mockResolvedValue(subscriptions);
    bridge.ListStorageAccounts.mockResolvedValue(accounts);
    bridge.ListContainers.mockResolvedValue(containers);
    bridge.ListBlobs.mockResolvedValue(blobs);
    bridge.ReadBlobTextChunk.mockResolvedValue(chunk);
    bridge.OpenBlobViewSession.mockResolvedValue(sessionStatus);
    bridge.GetBlobViewStatus.mockResolvedValue(sessionStatus);
    bridge.GetBlobViewLines.mockResolvedValue(linesResponse);
    bridge.SearchBlobView.mockResolvedValue(searchResponse);
    bridge.ExportBlobViewSession.mockResolvedValue({ cancelled: false });
    bridge.ImportConnectionsFile.mockResolvedValue({ cancelled: false, content: '[\n  {}\n]' });
    bridge.ExportConnectionsFile.mockResolvedValue({ cancelled: false });

    await expect(service.getVersion()).resolves.toBe('0.1.1');
    await expect(service.listLogEntries()).resolves.toEqual([entry]);
    await expect(service.getLogEntry('log-1')).resolves.toEqual(entry);
    await expect(service.startAzureLogin()).resolves.toEqual({ authenticated: true, failureReason: '' });
    await expect(service.restoreAzureSession()).resolves.toEqual({ authenticated: true, failureReason: '' });
    await expect(service.getAzureAuthState()).resolves.toEqual({ authenticated: true, failureReason: '' });
    await expect(service.listSubscriptions()).resolves.toEqual(subscriptions);
    await expect(service.listStorageAccounts('sub-1')).resolves.toEqual(accounts);
    await expect(service.listContainers('sub-1', 'rg-1', 'storage-a')).resolves.toEqual(containers);
    await expect(service.listBlobs('storage-a', 'logs', 'prefix/')).resolves.toEqual(blobs);
    await expect(
      service.readBlobTextChunk({
        accountName: 'storage-a',
        containerName: 'logs',
        blobName: 'app.log',
      }),
    ).resolves.toEqual(chunk);
    await expect(
      service.openBlobViewSession({
        accountName: 'storage-a',
        containerName: 'logs',
        blobName: 'app.log',
        focus: 'start',
      }),
    ).resolves.toEqual(sessionStatus);
    await expect(service.getBlobViewStatus('session-1')).resolves.toEqual(sessionStatus);
    await expect(service.getBlobViewLines('session-1', 0, 100)).resolves.toEqual(linesResponse);
    await expect(
      service.searchBlobView({ sessionId: 'session-1', query: 'line', cursor: 0 }),
    ).resolves.toEqual(searchResponse);
    await expect(service.exportBlobViewSession('session-1')).resolves.toEqual({ cancelled: false });
    await expect(service.importConnectionsFile()).resolves.toEqual({
      cancelled: false,
      content: '[\n  {}\n]',
    });
    await expect(service.exportConnectionsFile('[]')).resolves.toEqual({ cancelled: false });

    await service.azureLogout();

    expect(bridge.GetLogEntry).toHaveBeenCalledWith('log-1');
    expect(bridge.ListStorageAccounts).toHaveBeenCalledWith('sub-1');
    expect(bridge.ListContainers).toHaveBeenCalledWith('sub-1', 'rg-1', 'storage-a');
    expect(bridge.ListBlobs).toHaveBeenCalledWith('storage-a', 'logs', 'prefix/');
    expect(bridge.ReadBlobTextChunk).toHaveBeenCalledWith({
      accountName: 'storage-a',
      containerName: 'logs',
      blobName: 'app.log',
    });
    expect(bridge.OpenBlobViewSession).toHaveBeenCalledWith({
      accountName: 'storage-a',
      containerName: 'logs',
      blobName: 'app.log',
      focus: 'start',
    });
    expect(bridge.GetBlobViewStatus).toHaveBeenCalledWith('session-1');
    expect(bridge.GetBlobViewLines).toHaveBeenCalledWith('session-1', 0, 100);
    expect(bridge.SearchBlobView).toHaveBeenCalledWith({
      sessionId: 'session-1',
      query: 'line',
      cursor: 0,
    });
    expect(bridge.ExportBlobViewSession).toHaveBeenCalledWith('session-1');
    expect(bridge.ExportConnectionsFile).toHaveBeenCalledWith('[]');
    expect(bridge.AzureLogout).toHaveBeenCalledOnce();
  });

  it('normalizes missing blob-view arrays to empty arrays', async () => {
    bridge.OpenBlobViewSession.mockResolvedValue({
      sessionId: 'session-1',
      blobName: 'app.log',
      blobSize: 1024,
      contentType: 'text/plain',
      bytesDownloaded: 1024,
      indexedLineCount: 2,
      indexedThrough: 1024,
      isComplete: true,
      canEnableWordWrap: true,
      hasPendingBefore: false,
      hasPendingAfter: false,
      focus: 'start',
      tailPreviewLines: undefined as unknown as string[],
    });
    bridge.GetBlobViewStatus.mockResolvedValue({
      sessionId: 'session-1',
      blobName: 'app.log',
      blobSize: 1024,
      contentType: 'text/plain',
      bytesDownloaded: 1024,
      indexedLineCount: 2,
      indexedThrough: 1024,
      isComplete: true,
      canEnableWordWrap: true,
      hasPendingBefore: false,
      hasPendingAfter: false,
      focus: 'start',
      tailPreviewLines: undefined as unknown as string[],
    });
    bridge.GetBlobViewLines.mockResolvedValue({
      startLine: 0,
      totalLines: 0,
      isComplete: true,
      lines: undefined as unknown as BlobViewLinesResponse['lines'],
    });
    bridge.SearchBlobView.mockResolvedValue({
      query: 'line',
      matches: undefined as unknown as BlobViewSearchResponse['matches'],
      nextCursor: -1,
      isComplete: true,
    });

    await expect(
      service.openBlobViewSession({
        accountName: 'storage-a',
        containerName: 'logs',
        blobName: 'app.log',
        focus: 'start',
      }),
    ).resolves.toMatchObject({ tailPreviewLines: [] });
    await expect(service.getBlobViewStatus('session-1')).resolves.toMatchObject({
      tailPreviewLines: [],
    });
    await expect(service.getBlobViewLines('session-1', 0, 100)).resolves.toMatchObject({
      lines: [],
    });
    await expect(
      service.searchBlobView({ sessionId: 'session-1', query: 'line', cursor: 0 }),
    ).resolves.toMatchObject({
      matches: [],
    });
  });
});

function createMockBridge(): MockBridge {
  return {
    GetVersion: vi.fn(),
    ListLogEntries: vi.fn(),
    GetLogEntry: vi.fn(),
    StartAzureLogin: vi.fn(),
    RestoreAzureSession: vi.fn(),
    AzureLogout: vi.fn().mockResolvedValue(undefined),
    GetAzureAuthState: vi.fn(),
    ListSubscriptions: vi.fn(),
    ListStorageAccounts: vi.fn(),
    ListContainers: vi.fn(),
    ListBlobs: vi.fn(),
    ReadBlobTextChunk: vi.fn(),
    OpenBlobViewSession: vi.fn(),
    GetBlobViewStatus: vi.fn(),
    GetBlobViewLines: vi.fn(),
    SearchBlobView: vi.fn(),
    ExportBlobViewSession: vi.fn(),
    CloseBlobViewSession: vi.fn().mockResolvedValue(undefined),
    ImportConnectionsFile: vi.fn(),
    ExportConnectionsFile: vi.fn(),
  };
}
