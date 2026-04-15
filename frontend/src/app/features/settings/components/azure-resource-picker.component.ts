import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';

import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '../models/azure.model';

@Component({
  selector: 'app-azure-resource-picker',
  imports: [FormsModule, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './azure-resource-picker.component.html',
})
export class AzureResourcePickerComponent {
  readonly subscriptions = input.required<AzureSubscription[]>();
  readonly subscriptionsLoading = input(false);
  readonly subscriptionsError = input<string | null>(null);
  readonly selectedSubscription = input<AzureSubscription | null>(null);

  readonly storageAccounts = input.required<AzureStorageAccount[]>();
  readonly storageAccountsLoading = input(false);
  readonly storageAccountsError = input<string | null>(null);
  readonly selectedStorageAccount = input<AzureStorageAccount | null>(null);

  readonly containers = input.required<AzureContainer[]>();
  readonly containersLoading = input(false);
  readonly containersError = input<string | null>(null);
  readonly selectedContainer = input<AzureContainer | null>(null);

  readonly subscriptionSelected = output<AzureSubscription | null>();
  readonly storageAccountSelected = output<AzureStorageAccount | null>();
  readonly containerSelected = output<AzureContainer | null>();

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

  get hasSubscriptions(): boolean {
    return this.subscriptionsValue.length > 0;
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

  get canSelectStorageAccount(): boolean {
    return this.selectedSubscriptionValue !== null;
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

  get canSelectContainer(): boolean {
    return this.selectedStorageAccountValue !== null;
  }
}
