import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppApiService } from '@app/core/services/app-api.service';
import type {
  AzureBlobItem,
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';

import { AzureService } from './azure.service';

class AppApiServiceStub implements Partial<AppApiService> {
  startAzureLogin = vi.fn<() => Promise<{ authenticated: boolean; errorMessage?: string }>>();
  restoreAzureSession = vi.fn<() => Promise<{ authenticated: boolean; errorMessage?: string }>>();
  azureLogout = vi.fn<() => Promise<void>>();
  getAzureAuthState = vi.fn<() => Promise<{ authenticated: boolean }>>();
  listSubscriptions = vi.fn<() => Promise<AzureSubscription[]>>();
  listStorageAccounts = vi.fn<(subscriptionId: string) => Promise<AzureStorageAccount[]>>();
  listContainers = vi.fn<
    (subscriptionId: string, resourceGroup: string, accountName: string) => Promise<AzureContainer[]>
  >();
  listBlobs = vi.fn<(accountName: string, containerName: string, prefix: string) => Promise<AzureBlobItem[]>>();
  downloadBlobContent = vi.fn<
    (accountName: string, containerName: string, blobName: string) => Promise<string>
  >();
}

describe('AzureService', () => {
  let service: AzureService;
  let api: AppApiServiceStub;

  beforeEach(() => {
    api = new AppApiServiceStub();
    TestBed.configureTestingModule({
      providers: [
        AzureService,
        { provide: AppApiService, useValue: api },
      ],
    });
    service = TestBed.inject(AzureService);
  });

  it('authenticates successfully and starts loading subscriptions', async () => {
    api.startAzureLogin.mockResolvedValue({ authenticated: true });
    api.listSubscriptions.mockResolvedValue([createSubscription()]);

    await service.login();
    await flushAsync();

    expect(service.authStep()).toBe('authenticated');
    expect(service.authError()).toBeNull();
    expect(api.listSubscriptions).toHaveBeenCalledOnce();
    expect(service.subscriptions()).toEqual([createSubscription()]);
  });

  it('stores an authentication error when login is rejected by the backend', async () => {
    api.startAzureLogin.mockResolvedValue({
      authenticated: false,
      errorMessage: 'Azure CLI session expired',
    });

    await service.login();

    expect(service.authStep()).toBe('error');
    expect(service.authError()).toBe('Azure CLI session expired');
  });

  it('stores an authentication error when login throws', async () => {
    api.startAzureLogin.mockRejectedValue(new Error('boom'));

    await service.login();

    expect(service.authStep()).toBe('error');
    expect(service.authError()).toBe('boom');
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
    service.selectedBlobName.set(blob.name);

    await service.logout();

    expect(service.authStep()).toBe('disconnected');
    expect(service.authError()).toBeNull();
    expect(service.selectedSubscription()).toBeNull();
    expect(service.selectedStorageAccount()).toBeNull();
    expect(service.selectedContainer()).toBeNull();
    expect(service.blobContent()).toBeNull();
    expect(service.selectedBlobName()).toBeNull();
    expect(service.subscriptionsStatus()).toBe('idle');
    expect(service.storageAccountsStatus()).toBe('idle');
    expect(service.containersStatus()).toBe('idle');
    expect(service.blobsStatus()).toBe('idle');
  });

  it('restores the startup session once without eagerly loading subscriptions', async () => {
    let resolveRestore: ((value: { authenticated: boolean }) => void) | null = null;
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
    expect(service.subscriptionsStatus()).toBe('idle');
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
    expect(service.subscriptionsError()).toBe('subscriptions failed');
    expect(service.storageAccountsStatus()).toBe('error');
    expect(service.storageAccountsError()).toBe('accounts failed');
    expect(service.containersStatus()).toBe('error');
    expect(service.containersError()).toBe('containers failed');
    expect(service.blobsStatus()).toBe('error');
    expect(service.blobsError()).toBe('blobs failed');
  });

  it('downloads selected blob content and exposes errors as text when the download fails', async () => {
    const account = createStorageAccount();
    const container = createContainer();
    service.selectedStorageAccount.set(account);
    service.selectedContainer.set(container);
    api.downloadBlobContent.mockResolvedValueOnce('line 1\nline 2');
    api.downloadBlobContent.mockRejectedValueOnce(new Error('network failed'));

    await service.downloadBlobContent('app.log');

    expect(service.selectedBlobName()).toBe('app.log');
    expect(service.blobContent()).toBe('line 1\nline 2');
    expect(service.blobContentLoading()).toBe(false);

    await service.downloadBlobContent('error.log');

    expect(service.selectedBlobName()).toBe('error.log');
    expect(service.blobContent()).toBe('Error loading blob: network failed');
    expect(service.blobContentLoading()).toBe(false);
    expect(api.downloadBlobContent).toHaveBeenCalledWith(account.name, container.name, 'app.log');
    expect(api.downloadBlobContent).toHaveBeenCalledWith(account.name, container.name, 'error.log');
  });

  it('skips blob download when no storage account or container is selected', async () => {
    await service.downloadBlobContent('app.log');

    expect(api.downloadBlobContent).not.toHaveBeenCalled();
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
    lastModified: '2026-04-13T10:30:00Z',
    blobType: 'BlockBlob',
    ...overrides,
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
