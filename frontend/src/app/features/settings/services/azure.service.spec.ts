import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppApiService } from '@app/core/services/app-api.service';
import type {
  AzureBlobItem,
  AzureBlobTextChunk,
  AzureBlobTextChunkRequest,
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { AzureService } from './azure.service';

class AppApiServiceStub implements Partial<AppApiService> {
  startAzureLogin = vi.fn<
    () => Promise<{ authenticated: boolean; errorMessage?: string; failureReason?: '' | 'cli_not_available' | 'not_logged_in' | 'token_request_failed' }>
  >();
  restoreAzureSession = vi.fn<
    () => Promise<{ authenticated: boolean; errorMessage?: string; failureReason?: '' | 'cli_not_available' | 'not_logged_in' | 'token_request_failed' }>
  >();
  azureLogout = vi.fn<() => Promise<void>>();
  getAzureAuthState = vi.fn<() => Promise<{ authenticated: boolean }>>();
  listSubscriptions = vi.fn<() => Promise<AzureSubscription[]>>();
  listStorageAccounts = vi.fn<(subscriptionId: string) => Promise<AzureStorageAccount[]>>();
  listContainers = vi.fn<
    (subscriptionId: string, resourceGroup: string, accountName: string) => Promise<AzureContainer[]>
  >();
  listBlobs = vi.fn<(accountName: string, containerName: string, prefix: string) => Promise<AzureBlobItem[]>>();
  readBlobTextChunk = vi.fn<
    (request: AzureBlobTextChunkRequest) => Promise<AzureBlobTextChunk>
  >();
}

describe('AzureService', () => {
  let service: AzureService;
  let api: AppApiServiceStub;

  beforeEach(async () => {
    api = new AppApiServiceStub();
    await TestBed.configureTestingModule({
      providers: [
        provideTranslateTesting(),
        AzureService,
        { provide: AppApiService, useValue: api },
      ],
    }).compileComponents();
    await initializeI18nForTests();
    service = TestBed.inject(AzureService);
  });

  it('authenticates successfully and starts loading subscriptions', async () => {
    api.startAzureLogin.mockResolvedValue({ authenticated: true });
    api.listSubscriptions.mockResolvedValue([createSubscription()]);

    await service.login();
    await flushAsync();

    expect(service.authStep()).toBe('authenticated');
    expect(service.authError()).toBeNull();
    expect(service.authFailureReason()).toBe('');
    expect(service.azureCliMissing()).toBe(false);
    expect(api.listSubscriptions).toHaveBeenCalledOnce();
    expect(service.subscriptions()).toEqual([createSubscription()]);
  });

  it('stores an authentication error when login is rejected by the backend', async () => {
    api.startAzureLogin.mockResolvedValue({
      authenticated: false,
      failureReason: 'not_logged_in',
    });

    await service.login();

    expect(service.authStep()).toBe('error');
    expect(service.authError()).toBe('Azure CLI is not logged in. Run `az login` and try again.');
    expect(service.authFailureReason()).toBe('not_logged_in');
    expect(service.azureCliMissing()).toBe(false);
  });

  it('tracks Azure CLI missing separately from the generic auth error state', async () => {
    api.startAzureLogin.mockResolvedValue({
      authenticated: false,
      failureReason: 'cli_not_available',
    });

    await service.login();

    expect(service.authStep()).toBe('error');
    expect(service.authError()).toBe('Azure CLI is not available on this machine.');
    expect(service.authFailureReason()).toBe('cli_not_available');
    expect(service.azureCliMissing()).toBe(true);
  });

  it('stores an authentication error when login throws', async () => {
    api.startAzureLogin.mockRejectedValue(new Error('boom'));

    await service.login();

    expect(service.authStep()).toBe('error');
    expect(service.authError()).toBe('Authentication failed');
    expect(service.authFailureReason()).toBe('');
  });

  it('logs out and resets all resource state even when logout fails', async () => {
    const subscription = createSubscription();
    const account = createStorageAccount();
    const container = createContainer();
    const blob = createBlob();
    api.azureLogout.mockRejectedValue(new Error('ignored'));
    api.listStorageAccounts.mockResolvedValue([account]);
    api.listContainers.mockResolvedValue([container]);
    api.listBlobs.mockResolvedValue([blob]);

    service.authStep.set('authenticated');
    service.selectedSubscription.set(subscription);
    service.selectedStorageAccount.set(account);
    service.selectedContainer.set(container);
    service.blobContent.set('log line 1');
    service.blobContentChunk.set(createBlobChunk());
    service.blobContentError.set('preview failed');
    service.selectedBlobName.set(blob.name);

    await service.logout();

    expect(service.authStep()).toBe('disconnected');
    expect(service.authError()).toBeNull();
    expect(service.authFailureReason()).toBe('');
    expect(service.azureCliMissing()).toBe(false);
    expect(service.selectedSubscription()).toBeNull();
    expect(service.selectedStorageAccount()).toBeNull();
    expect(service.selectedContainer()).toBeNull();
    expect(service.blobContent()).toBeNull();
    expect(service.blobContentChunk()).toBeNull();
    expect(service.blobContentError()).toBeNull();
    expect(service.selectedBlobName()).toBeNull();
    expect(service.subscriptionsStatus()).toBe('idle');
    expect(service.storageAccountsStatus()).toBe('idle');
    expect(service.containersStatus()).toBe('idle');
    expect(service.blobsStatus()).toBe('idle');
  });

  it('restores the startup session once without eagerly loading subscriptions', async () => {
    let resolveRestore: ((value: { authenticated: boolean; failureReason?: '' | 'cli_not_available' | 'not_logged_in' | 'token_request_failed' }) => void) | null = null;
    api.restoreAzureSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRestore = resolve;
        })
    );
    api.listSubscriptions.mockResolvedValue([createSubscription()]);

    const firstCall = service.initializeStartupAuth();
    const secondCall = service.initializeStartupAuth();
    resolveRestore?.({ authenticated: true });
    await firstCall;
    await secondCall;
    await flushAsync();

    expect(service.authStep()).toBe('authenticated');
    expect(service.authError()).toBeNull();
    expect(service.authFailureReason()).toBe('');
    expect(api.restoreAzureSession).toHaveBeenCalledOnce();
    expect(api.listSubscriptions).not.toHaveBeenCalled();
    expect(service.subscriptionsStatus()).toBe('idle');
    expect(service.subscriptions()).toEqual([]);
  });

  it('keeps the service disconnected and silent when startup restore fails', async () => {
    api.restoreAzureSession.mockRejectedValue(new Error('boom'));

    await service.initializeStartupAuth();

    expect(service.authStep()).toBe('disconnected');
    expect(service.authError()).toBeNull();
    expect(service.authFailureReason()).toBe('');
    expect(service.azureCliMissing()).toBe(false);
    expect(service.subscriptionsStatus()).toBe('idle');
  });

  it('tracks Azure CLI missing during silent startup restore without entering the error auth step', async () => {
    api.restoreAzureSession.mockResolvedValue({
      authenticated: false,
      failureReason: 'cli_not_available',
    });

    await service.initializeStartupAuth();

    expect(service.authStep()).toBe('disconnected');
    expect(service.authError()).toBeNull();
    expect(service.authFailureReason()).toBe('cli_not_available');
    expect(service.azureCliMissing()).toBe(true);
  });

  it('cascades subscription, storage account, and container selection into downstream loads', async () => {
    const subscription = createSubscription();
    const account = createStorageAccount();
    const container = createContainer();
    const blob = createBlob();
    api.listStorageAccounts.mockResolvedValue([account]);
    api.listContainers.mockResolvedValue([container]);
    api.listBlobs.mockResolvedValue([blob]);

    service.selectSubscription(subscription);
    await flushAsync();
    expect(service.selectedSubscription()).toEqual(subscription);
    expect(api.listStorageAccounts).toHaveBeenCalledWith(subscription.id);
    expect(service.storageAccounts()).toEqual([account]);

    service.selectStorageAccount(account);
    await flushAsync();
    expect(service.selectedStorageAccount()).toEqual(account);
    expect(api.listContainers).toHaveBeenCalledWith(subscription.id, account.resourceGroup, account.name);
    expect(service.containers()).toEqual([container]);

    service.selectContainer(container);
    await flushAsync();
    expect(service.selectedContainer()).toEqual(container);
    expect(api.listBlobs).toHaveBeenCalledWith(account.name, container.name, '');
    expect(service.blobs()).toEqual([blob]);
  });

  it('reuses in-flight storage account and container loads for the same target', async () => {
    const subscription = createSubscription();
    const account = createStorageAccount();
    let resolveStorageAccounts: ((value: AzureStorageAccount[]) => void) | null = null;
    let resolveContainers: ((value: AzureContainer[]) => void) | null = null;

    api.listStorageAccounts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStorageAccounts = resolve;
        }),
    );
    api.listContainers.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveContainers = resolve;
        }),
    );

    const firstStorageLoad = service.loadStorageAccounts(subscription.id);
    const secondStorageLoad = service.loadStorageAccounts(subscription.id);
    resolveStorageAccounts?.([account]);
    await firstStorageLoad;
    await secondStorageLoad;

    const firstContainerLoad = service.loadContainers(subscription.id, account.resourceGroup, account.name);
    const secondContainerLoad = service.loadContainers(subscription.id, account.resourceGroup, account.name);
    resolveContainers?.([createContainer()]);
    await firstContainerLoad;
    await secondContainerLoad;

    expect(api.listStorageAccounts).toHaveBeenCalledOnce();
    expect(api.listContainers).toHaveBeenCalledOnce();
  });

  it('stores resource-loading errors for subscriptions, accounts, containers, and blobs', async () => {
    api.listSubscriptions.mockRejectedValue(new Error('subscriptions failed'));
    api.listStorageAccounts.mockRejectedValue(new Error('accounts failed'));
    api.listContainers.mockRejectedValue(new Error('containers failed'));
    api.listBlobs.mockRejectedValue(new Error('blobs failed'));

    await service.loadSubscriptions();
    await service.loadStorageAccounts('sub-1');
    await service.loadContainers('sub-1', 'rg-1', 'storage-a');
    await service.loadBlobs('storage-a', 'logs');

    expect(service.subscriptionsStatus()).toBe('error');
    expect(service.subscriptionsError()).toBe('Failed to load subscriptions');
    expect(service.storageAccountsStatus()).toBe('error');
    expect(service.storageAccountsError()).toBe('Failed to load storage accounts');
    expect(service.containersStatus()).toBe('error');
    expect(service.containersError()).toBe('Failed to load containers');
    expect(service.blobsStatus()).toBe('error');
    expect(service.blobsError()).toBe('Failed to load blobs');
  });

  it('downloads selected blob content and exposes errors as text when the download fails', async () => {
    const account = createStorageAccount();
    const container = createContainer();
    service.selectedStorageAccount.set(account);
    service.selectedContainer.set(container);
    api.readBlobTextChunk.mockResolvedValueOnce(
      createBlobChunk({ content: 'line 1\nline 2', blobSize: 1024, endOffsetExclusive: 1024 }),
    );
    api.readBlobTextChunk.mockRejectedValueOnce(new Error('network failed'));

    await service.downloadBlobContent('app.log');

    expect(service.selectedBlobName()).toBe('app.log');
    expect(service.blobContent()).toBe('line 1\nline 2');
    expect(service.blobContentChunk()).toEqual(
      createBlobChunk({ content: 'line 1\nline 2', blobSize: 1024, endOffsetExclusive: 1024 }),
    );
    expect(service.blobContentError()).toBeNull();
    expect(service.blobContentLoading()).toBe(false);

    await service.downloadBlobContent('error.log');

    expect(service.selectedBlobName()).toBe('error.log');
    expect(service.blobContent()).toBeNull();
    expect(service.blobContentChunk()).toBeNull();
    expect(service.blobContentError()).toBe('Error loading blob.');
    expect(service.blobContentLoading()).toBe(false);
    expect(api.readBlobTextChunk).toHaveBeenCalledWith({
      accountName: account.name,
      containerName: container.name,
      blobName: 'app.log',
    });
    expect(api.readBlobTextChunk).toHaveBeenCalledWith({
      accountName: account.name,
      containerName: container.name,
      blobName: 'error.log',
    });
  });

  it('surfaces blob failure reasons without exposing raw backend messages', async () => {
    const account = createStorageAccount();
    const container = createContainer();
    service.selectedStorageAccount.set(account);
    service.selectedContainer.set(container);
    api.readBlobTextChunk.mockResolvedValue(
      createBlobChunk({
        failureReason: 'too_large',
        errorMessage: 'The requested blob exceeds the supported size limit.',
      }),
    );

    await service.downloadBlobContent('oversized.log');

    expect(service.blobContent()).toBeNull();
    expect(service.blobContentChunk()).toBeNull();
    expect(service.blobContentError()).toBe('The selected blob exceeds the supported size limit.');
  });

  it('skips blob download when no storage account or container is selected', async () => {
    await service.downloadBlobContent('app.log');

    expect(api.readBlobTextChunk).not.toHaveBeenCalled();
    expect(service.selectedBlobName()).toBeNull();
  });
});

function createSubscription(overrides: Partial<AzureSubscription> = {}): AzureSubscription {
  return {
    id: 'sub-1',
    displayName: 'Production',
    tenantId: 'tenant-1',
    state: 'Enabled',
    ...overrides,
  };
}

function createStorageAccount(
  overrides: Partial<AzureStorageAccount> = {},
): AzureStorageAccount {
  return {
    id: 'acc-1',
    name: 'storage-a',
    location: 'westeurope',
    kind: 'StorageV2',
    resourceGroup: 'rg-1',
    subscriptionId: 'sub-1',
    ...overrides,
  };
}

function createContainer(overrides: Partial<AzureContainer> = {}): AzureContainer {
  return {
    name: 'logs',
    lastModified: '2026-04-13T10:30:00Z',
    leaseState: 'available',
    ...overrides,
  };
}

function createBlob(overrides: Partial<AzureBlobItem> = {}): AzureBlobItem {
  return {
    name: '2026/04/13/app.log',
    size: 42,
    contentType: 'text/plain',
    createdAt: '2026-04-13T10:00:00Z',
    lastModified: '2026-04-13T10:30:00Z',
    blobType: 'BlockBlob',
    ...overrides,
  };
}

function createBlobChunk(overrides: Partial<AzureBlobTextChunk> = {}): AzureBlobTextChunk {
  return {
    content: 'preview',
    blobSize: 42,
    contentType: 'text/plain',
    etag: '"etag-1"',
    lastModified: '2026-04-13T10:30:00Z',
    startOffset: 0,
    endOffsetExclusive: 42,
    truncatedStart: false,
    truncatedEnd: false,
    isLargeBlob: false,
    ...overrides,
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
