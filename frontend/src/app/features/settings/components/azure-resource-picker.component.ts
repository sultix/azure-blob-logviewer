import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { FormControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';

import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '../models/azure.model';

@Component({
  selector: 'app-azure-resource-picker',
  imports: [ReactiveFormsModule, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './azure-resource-picker.component.html',
})
export class AzureResourcePickerComponent {
  readonly subscriptionControl = input.required<FormControl<AzureSubscription | null>>();
  readonly subscriptions = input.required<AzureSubscription[]>();
  readonly subscriptionsLoading = input(false);
  readonly subscriptionsError = input<string | null>(null);

  readonly storageAccountControl = input.required<FormControl<AzureStorageAccount | null>>();
  readonly storageAccounts = input.required<AzureStorageAccount[]>();
  readonly storageAccountsLoading = input(false);
  readonly storageAccountsError = input<string | null>(null);

  readonly containerControl = input.required<FormControl<AzureContainer | null>>();
  readonly containers = input.required<AzureContainer[]>();
  readonly containersLoading = input(false);
  readonly containersError = input<string | null>(null);

  get subscriptionsValue(): AzureSubscription[] {
    return this.subscriptions();
  }

  get subscriptionsLoadingValue(): boolean {
    return this.subscriptionsLoading();
  }

  get subscriptionsErrorValue(): string | null {
    return this.subscriptionsError();
  }

  get subscriptionControlValue(): FormControl<AzureSubscription | null> {
    return this.subscriptionControl();
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

  get storageAccountControlValue(): FormControl<AzureStorageAccount | null> {
    return this.storageAccountControl();
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

  get containerControlValue(): FormControl<AzureContainer | null> {
    return this.containerControl();
  }
}
