import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogEntry } from '@app/features/logs/models/log-entry.model';
import type {
  AzureBlobItem,
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';

import { AppApiService } from './app-api.service';

interface MockBridge {
  GetVersion: ReturnType<typeof vi.fn<() => Promise<string>>>;
  ListLogEntries: ReturnType<typeof vi.fn<() => Promise<LogEntry[] | null>>>;
  GetLogEntry: ReturnType<typeof vi.fn<(id: string) => Promise<LogEntry | null>>>;
  StartAzureLogin: ReturnType<
    typeof vi.fn<() => Promise<{ authenticated: boolean; errorMessage?: string } | null>>
  >;
  RestoreAzureSession: ReturnType<
    typeof vi.fn<() => Promise<{ authenticated: boolean; errorMessage?: string } | null>>
  >;
  AzureLogout: ReturnType<typeof vi.fn<() => Promise<void>>>;
  GetAzureAuthState: ReturnType<
    typeof vi.fn<() => Promise<{ authenticated: boolean; errorMessage?: string } | null>>
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
  DownloadBlobContent: ReturnType<
    typeof vi.fn<(accountName: string, containerName: string, blobName: string) => Promise<string>>
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

  beforeEach(() => {
    runtimeWindow = window as RuntimeWindow;
    bridge = createMockBridge();
    runtimeWindow.go = {
      app: {
        App: bridge,
      },
    };

    TestBed.configureTestingModule({});
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
  });

  it('passes through non-null bridge responses and forwards method arguments', async () => {
    const entry: LogEntry = {
      id: 'log-1',
      container: 'logs',
      blobName: 'app.log',
      timestamp: 'Today, 10:30',
      lastModified: '2026-04-13T10:30:00Z',
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
        lastModified: '2026-04-13T10:30:00Z',
        blobType: 'BlockBlob',
      },
    ];

    bridge.GetVersion.mockResolvedValue('0.1.0');
    bridge.ListLogEntries.mockResolvedValue([entry]);
    bridge.GetLogEntry.mockResolvedValue(entry);
    bridge.StartAzureLogin.mockResolvedValue({ authenticated: true });
    bridge.RestoreAzureSession.mockResolvedValue({ authenticated: true });
    bridge.GetAzureAuthState.mockResolvedValue({ authenticated: true });
    bridge.ListSubscriptions.mockResolvedValue(subscriptions);
    bridge.ListStorageAccounts.mockResolvedValue(accounts);
    bridge.ListContainers.mockResolvedValue(containers);
    bridge.ListBlobs.mockResolvedValue(blobs);
    bridge.DownloadBlobContent.mockResolvedValue('log line 1');

    await expect(service.getVersion()).resolves.toBe('0.1.0');
    await expect(service.listLogEntries()).resolves.toEqual([entry]);
    await expect(service.getLogEntry('log-1')).resolves.toEqual(entry);
    await expect(service.startAzureLogin()).resolves.toEqual({ authenticated: true });
    await expect(service.restoreAzureSession()).resolves.toEqual({ authenticated: true });
    await expect(service.getAzureAuthState()).resolves.toEqual({ authenticated: true });
    await expect(service.listSubscriptions()).resolves.toEqual(subscriptions);
    await expect(service.listStorageAccounts('sub-1')).resolves.toEqual(accounts);
    await expect(service.listContainers('sub-1', 'rg-1', 'storage-a')).resolves.toEqual(containers);
    await expect(service.listBlobs('storage-a', 'logs', 'prefix/')).resolves.toEqual(blobs);
    await expect(service.downloadBlobContent('storage-a', 'logs', 'app.log')).resolves.toBe(
      'log line 1',
    );

    await service.azureLogout();

    expect(bridge.GetLogEntry).toHaveBeenCalledWith('log-1');
    expect(bridge.ListStorageAccounts).toHaveBeenCalledWith('sub-1');
    expect(bridge.ListContainers).toHaveBeenCalledWith('sub-1', 'rg-1', 'storage-a');
    expect(bridge.ListBlobs).toHaveBeenCalledWith('storage-a', 'logs', 'prefix/');
    expect(bridge.DownloadBlobContent).toHaveBeenCalledWith('storage-a', 'logs', 'app.log');
    expect(bridge.AzureLogout).toHaveBeenCalledOnce();
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
    DownloadBlobContent: vi.fn(),
  };
}
