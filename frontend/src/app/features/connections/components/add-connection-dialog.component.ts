import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
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
  imports: [FormsModule, AzureResourcePickerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-connection-dialog.component.html',
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

  get draftNameValue(): string {
    return this.draftName();
  }

  get subscriptionsValue(): AzureSubscription[] {
    return this.subscriptions();
  }

  get subscriptionsLoadingValue(): boolean {
    return this.subscriptionsLoading();
  }

  get subscriptionsErrorValue(): string | null {
    return this.subscriptionsError();
  }

  get selectedSubscriptionValue(): AzureSubscription | null {
    return this.selectedSubscription();
  }

  get storageAccountsValue(): AzureStorageAccount[] {
    return this.storageAccounts();
  }

  get storageAccountsLoadingValue(): boolean {
    return this.storageAccountsLoading();
  }

  get storageAccountsErrorValue(): string | null {
    return this.storageAccountsError();
  }

  get selectedStorageAccountValue(): AzureStorageAccount | null {
    return this.selectedStorageAccount();
  }

  get containersValue(): AzureContainer[] {
    return this.containers();
  }

  get containersLoadingValue(): boolean {
    return this.containersLoading();
  }

  get containersErrorValue(): string | null {
    return this.containersError();
  }

  get selectedContainerValue(): AzureContainer | null {
    return this.selectedContainer();
  }

  get canSaveValue(): boolean {
    return this.canSave();
  }

  onDraftNameChange(value: string): void {
    this.draftName.set(value);
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
    const name = this.draftNameValue.trim();
    const subscription = this.selectedSubscriptionValue;
    const storageAccount = this.selectedStorageAccountValue;
    const container = this.selectedContainerValue;
    if (!name || !subscription || !storageAccount || !container) return;

    const result: AddConnectionResult = { name, subscription, storageAccount, container };
    this.ref.close(result);
  }

  cancel(): void {
    this.ref.close(null);
  }
}
