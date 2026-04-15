import { Injectable, computed, inject, signal } from '@angular/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { AppApiService } from '@app/core/services/app-api.service';
import type {
  AzureBlobItem,
  AzureContainer,
  AzureAuthFailureReason,
  AzureStorageAccount,
  AzureSubscription,
} from '../models/azure.model';

export type AzureAuthStep = 'disconnected' | 'authenticating' | 'authenticated' | 'error';

type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; items: T[] }
  | { status: 'error'; message: string };

@Injectable({ providedIn: 'root' })
export class AzureService {
  private readonly api = inject(AppApiService);
  private readonly i18n = inject(AppI18nService);
  private startupRestorePromise: Promise<void> | null = null;
  private startupRestoreCompleted = false;
  private subscriptionsLoadPromise: Promise<void> | null = null;

  // --- Authentication state ---
  readonly authStep = signal<AzureAuthStep>('disconnected');
  readonly authError = signal<string | null>(null);
  readonly authFailureReason = signal<AzureAuthFailureReason>('');

  readonly isAuthenticated = computed(() => this.authStep() === 'authenticated');
  readonly azureCliMissing = computed(() => this.authFailureReason() === 'cli_not_available');

  // --- Subscriptions ---
  private readonly subscriptionsState = signal<ResourceState<AzureSubscription>>({ status: 'idle' });
  readonly subscriptionsStatus = computed(() => this.subscriptionsState().status);
  readonly subscriptions = computed(() => {
    const s = this.subscriptionsState();
    return s.status === 'success' ? s.items : [];
  });
  readonly subscriptionsError = computed(() => {
    const s = this.subscriptionsState();
    return s.status === 'error' ? s.message : null;
  });
  readonly selectedSubscription = signal<AzureSubscription | null>(null);

  // --- Storage Accounts ---
  private readonly storageAccountsState = signal<ResourceState<AzureStorageAccount>>({ status: 'idle' });
  readonly storageAccountsStatus = computed(() => this.storageAccountsState().status);
  readonly storageAccounts = computed(() => {
    const s = this.storageAccountsState();
    return s.status === 'success' ? s.items : [];
  });
  readonly storageAccountsError = computed(() => {
    const s = this.storageAccountsState();
    return s.status === 'error' ? s.message : null;
  });
  readonly selectedStorageAccount = signal<AzureStorageAccount | null>(null);

  // --- Containers ---
  private readonly containersState = signal<ResourceState<AzureContainer>>({ status: 'idle' });
  readonly containersStatus = computed(() => this.containersState().status);
  readonly containers = computed(() => {
    const s = this.containersState();
    return s.status === 'success' ? s.items : [];
  });
  readonly containersError = computed(() => {
    const s = this.containersState();
    return s.status === 'error' ? s.message : null;
  });
  readonly selectedContainer = signal<AzureContainer | null>(null);

  // --- Blobs ---
  private readonly blobsState = signal<ResourceState<AzureBlobItem>>({ status: 'idle' });
  readonly blobsStatus = computed(() => this.blobsState().status);
  readonly blobs = computed(() => {
    const s = this.blobsState();
    return s.status === 'success' ? s.items : [];
  });
  readonly blobsError = computed(() => {
    const s = this.blobsState();
    return s.status === 'error' ? s.message : null;
  });

  // --- Blob content ---
  readonly blobContent = signal<string | null>(null);
  readonly blobContentLoading = signal(false);
  readonly selectedBlobName = signal<string | null>(null);

  // --- Authentication actions ---

  async login(): Promise<void> {
    this.authStep.set('authenticating');
    this.authError.set(null);

    try {
      const result = await this.api.startAzureLogin();
      this.authFailureReason.set(result.failureReason ?? '');

      if (result.authenticated) {
        this.authStep.set('authenticated');
        this.authError.set(null);
        void this.loadSubscriptions();
      } else {
        this.authStep.set('error');
        this.authError.set(result.errorMessage ?? this.i18n.translate('common.errors.authFailed'));
      }
    } catch (err) {
      this.authStep.set('error');
      this.authFailureReason.set('');
      this.authError.set(
        err instanceof Error ? err.message : this.i18n.translate('common.errors.authFailed'),
      );
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.azureLogout();
    } catch {
      // Ignore logout errors
    }
    this.authStep.set('disconnected');
    this.authError.set(null);
    this.authFailureReason.set('');
    this.resetAllResources();
  }

  initializeStartupAuth(): Promise<void> {
    if (this.startupRestoreCompleted) {
      return Promise.resolve();
    }
    if (this.startupRestorePromise) {
      return this.startupRestorePromise;
    }

    this.startupRestorePromise = (async () => {
      try {
        const state = await this.api.restoreAzureSession();
        this.authFailureReason.set(state.failureReason ?? '');
        if (state.authenticated) {
          this.authStep.set('authenticated');
          this.authError.set(null);
          return;
        }
      } catch {
        // Startup restore stays silent and leaves the app disconnected.
        this.authFailureReason.set('');
      } finally {
        this.authError.set(null);
        if (this.authStep() !== 'authenticated') {
          this.authStep.set('disconnected');
        }
        this.startupRestoreCompleted = true;
        this.startupRestorePromise = null;
      }
    })();

    return this.startupRestorePromise;
  }

  // --- Resource loading ---

  async loadSubscriptions(): Promise<void> {
    if (this.subscriptionsLoadPromise) {
      return this.subscriptionsLoadPromise;
    }

    this.subscriptionsState.set({ status: 'loading' });
    this.resetDownstreamFrom('subscriptions');
    this.subscriptionsLoadPromise = (async () => {
      try {
        const items = await this.api.listSubscriptions();
        this.subscriptionsState.set({ status: 'success', items });
      } catch (err) {
        this.subscriptionsState.set({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : this.i18n.translate('settings.service.loadSubscriptionsFailed'),
        });
      } finally {
        this.subscriptionsLoadPromise = null;
      }
    })();

    return this.subscriptionsLoadPromise;
  }

  selectSubscription(sub: AzureSubscription | null): void {
    this.selectedSubscription.set(sub);
    this.resetDownstreamFrom('storageAccounts');
    if (sub) {
      void this.loadStorageAccounts(sub.id);
    }
  }

  async loadStorageAccounts(subscriptionId: string): Promise<void> {
    this.storageAccountsState.set({ status: 'loading' });
    try {
      const items = await this.api.listStorageAccounts(subscriptionId);
      this.storageAccountsState.set({ status: 'success', items });
    } catch (err) {
      this.storageAccountsState.set({
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : this.i18n.translate('settings.service.loadStorageAccountsFailed'),
      });
    }
  }

  selectStorageAccount(account: AzureStorageAccount | null): void {
    this.selectedStorageAccount.set(account);
    this.resetDownstreamFrom('containers');
    if (account) {
      const sub = this.selectedSubscription();
      if (sub) {
        void this.loadContainers(sub.id, account.resourceGroup, account.name);
      }
    }
  }

  async loadContainers(subscriptionId: string, resourceGroup: string, accountName: string): Promise<void> {
    this.containersState.set({ status: 'loading' });
    try {
      const items = await this.api.listContainers(subscriptionId, resourceGroup, accountName);
      this.containersState.set({ status: 'success', items });
    } catch (err) {
      this.containersState.set({
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : this.i18n.translate('settings.service.loadContainersFailed'),
      });
    }
  }

  selectContainer(container: AzureContainer | null): void {
    this.selectedContainer.set(container);
    this.blobsState.set({ status: 'idle' });
    this.blobContent.set(null);
    this.selectedBlobName.set(null);
    if (container) {
      const account = this.selectedStorageAccount();
      if (account) {
        void this.loadBlobs(account.name, container.name);
      }
    }
  }

  async loadBlobs(accountName: string, containerName: string, prefix = ''): Promise<void> {
    this.blobsState.set({ status: 'loading' });
    try {
      const items = await this.api.listBlobs(accountName, containerName, prefix);
      this.blobsState.set({ status: 'success', items });
    } catch (err) {
      this.blobsState.set({
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : this.i18n.translate('settings.service.loadBlobsFailed'),
      });
    }
  }

  async downloadBlobContent(blobName: string): Promise<void> {
    const account = this.selectedStorageAccount();
    const container = this.selectedContainer();
    if (!account || !container) return;

    this.blobContentLoading.set(true);
    this.selectedBlobName.set(blobName);
    try {
      const content = await this.api.downloadBlobContent(account.name, container.name, blobName);
      this.blobContent.set(content);
    } catch (err) {
      this.blobContent.set(
        this.i18n.translate('settings.service.loadBlobFailed', {
          message:
            err instanceof Error ? err.message : this.i18n.translate('common.errors.unknownError'),
        })
      );
    } finally {
      this.blobContentLoading.set(false);
    }
  }

  // --- Internal helpers ---

  private resetDownstreamFrom(level: 'subscriptions' | 'storageAccounts' | 'containers'): void {
    if (level === 'subscriptions') {
      this.selectedSubscription.set(null);
      this.storageAccountsState.set({ status: 'idle' });
    }
    if (level === 'subscriptions' || level === 'storageAccounts') {
      this.selectedStorageAccount.set(null);
      this.containersState.set({ status: 'idle' });
    }
    this.selectedContainer.set(null);
    this.blobsState.set({ status: 'idle' });
    this.blobContent.set(null);
    this.selectedBlobName.set(null);
  }

  private resetAllResources(): void {
    this.subscriptionsState.set({ status: 'idle' });
    this.resetDownstreamFrom('subscriptions');
  }
}
