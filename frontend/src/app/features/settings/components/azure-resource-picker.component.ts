import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';

import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '../models/azure.model';

@Component({
  selector: 'app-azure-resource-picker',
  imports: [FormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">

      <!-- Subscription -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Subscription
        </label>
        @if (subscriptionsLoading()) {
          <div class="flex items-center gap-2 text-sm text-on-surface-variant">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Lade Subscriptions...
          </div>
        } @else if (subscriptionsError()) {
          <p class="text-sm text-error">{{ subscriptionsError() }}</p>
        } @else {
          <p-select
            [options]="subscriptions()"
            optionLabel="displayName"
            [ngModel]="selectedSubscription()"
            (ngModelChange)="subscriptionSelected.emit($event)"
            [filter]="true"
            filterBy="displayName,id"
            placeholder="Subscription auswaehlen..."
            [showClear]="true"
            appendTo="body"
            styleClass="w-full"
          />
          @if (subscriptions().length === 0) {
            <p class="text-xs text-on-surface-variant">Keine Subscriptions gefunden.</p>
          }
        }
      </div>

      <!-- Storage Account -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Storage Account
        </label>
        @if (storageAccountsLoading()) {
          <div class="flex items-center gap-2 text-sm text-on-surface-variant">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Lade Storage Accounts...
          </div>
        } @else if (storageAccountsError()) {
          <p class="text-sm text-error">{{ storageAccountsError() }}</p>
        } @else {
          <p-select
            [options]="storageAccounts()"
            optionLabel="name"
            [ngModel]="selectedStorageAccount()"
            (ngModelChange)="storageAccountSelected.emit($event)"
            [filter]="true"
            filterBy="name,location"
            placeholder="Storage Account auswaehlen..."
            [showClear]="true"
            [disabled]="!selectedSubscription()"
            appendTo="body"
            styleClass="w-full"
          />
        }
      </div>

      <!-- Container -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Blob Container
        </label>
        @if (containersLoading()) {
          <div class="flex items-center gap-2 text-sm text-on-surface-variant">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Lade Container...
          </div>
        } @else if (containersError()) {
          <p class="text-sm text-error">{{ containersError() }}</p>
        } @else {
          <p-select
            [options]="containers()"
            optionLabel="name"
            [ngModel]="selectedContainer()"
            (ngModelChange)="containerSelected.emit($event)"
            [filter]="true"
            filterBy="name"
            placeholder="Container auswaehlen..."
            [showClear]="true"
            [disabled]="!selectedStorageAccount()"
            appendTo="body"
            styleClass="w-full"
          />
        }
      </div>

    </div>
  `,
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
}
