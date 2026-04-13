import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

import { AzureService } from '@app/features/settings/services/azure.service';
import { AzureResourcePickerComponent } from '@app/features/settings/components/azure-resource-picker.component';
import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';

export interface AddConnectionResult {
  name: string;
  subscription: AzureSubscription;
  storageAccount: AzureStorageAccount;
  container: AzureContainer;
}

@Component({
  selector: 'app-add-connection-dialog',
  imports: [FormsModule, AzureResourcePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5">
      <p class="text-xs text-on-surface-variant">
        Select an Azure subscription, storage account, and container.
      </p>

      <!-- Connection Name -->
      <label class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Connection Name
        </span>
        <input
          type="text"
          placeholder="az-prod-logs"
          [ngModel]="draftName()"
          (ngModelChange)="draftName.set($event)"
          class="rounded-lg bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </label>

      <!-- Azure Resource Picker -->
      <app-azure-resource-picker
        [subscriptions]="subscriptions()"
        [subscriptionsLoading]="subscriptionsLoading()"
        [subscriptionsError]="subscriptionsError()"
        [selectedSubscription]="selectedSubscription()"
        [storageAccounts]="storageAccounts()"
        [storageAccountsLoading]="storageAccountsLoading()"
        [storageAccountsError]="storageAccountsError()"
        [selectedStorageAccount]="selectedStorageAccount()"
        [containers]="containers()"
        [containersLoading]="containersLoading()"
        [containersError]="containersError()"
        [selectedContainer]="selectedContainer()"
        (subscriptionSelected)="onSubscriptionSelected($event)"
        (storageAccountSelected)="onStorageAccountSelected($event)"
        (containerSelected)="onContainerSelected($event)"
      />

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          (click)="cancel()"
          class="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          (click)="save()"
          [disabled]="!canSave()"
          class="rounded-lg bg-primary-gradient px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
        >
          Save Connection
        </button>
      </div>
    </div>
  `,
})
export class AddConnectionDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly azure = inject(AzureService);

  readonly draftName = signal('');

  readonly subscriptions = this.azure.subscriptions;
  readonly subscriptionsLoading = computed(() => this.azure.subscriptionsStatus() === 'loading');
  readonly subscriptionsError = this.azure.subscriptionsError;
  readonly selectedSubscription = this.azure.selectedSubscription;

  readonly storageAccounts = this.azure.storageAccounts;
  readonly storageAccountsLoading = computed(() => this.azure.storageAccountsStatus() === 'loading');
  readonly storageAccountsError = this.azure.storageAccountsError;
  readonly selectedStorageAccount = this.azure.selectedStorageAccount;

  readonly containers = this.azure.containers;
  readonly containersLoading = computed(() => this.azure.containersStatus() === 'loading');
  readonly containersError = this.azure.containersError;
  readonly selectedContainer = this.azure.selectedContainer;

  readonly canSave = computed(() => {
    const name = this.draftName().trim();
    return !!(name && this.selectedSubscription() && this.selectedStorageAccount() && this.selectedContainer());
  });

  constructor() {
    if (this.subscriptions().length === 0) {
      void this.azure.loadSubscriptions();
    }
  }

  onSubscriptionSelected(sub: AzureSubscription | null): void {
    this.azure.selectSubscription(sub);
  }

  onStorageAccountSelected(acc: AzureStorageAccount | null): void {
    this.azure.selectStorageAccount(acc);
  }

  onContainerSelected(container: AzureContainer | null): void {
    this.azure.selectContainer(container);
  }

  save(): void {
    const name = this.draftName().trim();
    const subscription = this.selectedSubscription();
    const storageAccount = this.selectedStorageAccount();
    const container = this.selectedContainer();
    if (!name || !subscription || !storageAccount || !container) return;

    const result: AddConnectionResult = { name, subscription, storageAccount, container };
    this.ref.close(result);
  }

  cancel(): void {
    this.ref.close(null);
  }
}
