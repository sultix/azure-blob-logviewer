import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { FormControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';

import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '../../models/azure.model';

@Component({
  selector: 'app-azure-resource-picker',
  imports: [ReactiveFormsModule, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './azure-resource-picker.component.html',
})
export class AzureResourcePickerComponent {
  readonly subscriptionControl =
    input.required<FormControl<AzureSubscription | null>>();
  readonly subscriptions = input.required<AzureSubscription[]>();
  readonly subscriptionsLoading = input(false);
  readonly subscriptionsError = input<string | null>(null);

  readonly storageAccountControl =
    input.required<FormControl<AzureStorageAccount | null>>();
  readonly storageAccounts = input.required<AzureStorageAccount[]>();
  readonly storageAccountsLoading = input(false);
  readonly storageAccountsError = input<string | null>(null);

  readonly containerControl =
    input.required<FormControl<AzureContainer | null>>();
  readonly containers = input.required<AzureContainer[]>();
  readonly containersLoading = input(false);
  readonly containersError = input<string | null>(null);
  readonly hasSubscriptions = computed(() => this.subscriptions().length > 0);
}
