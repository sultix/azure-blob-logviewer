import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
} from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';

import { AzureResourcePickerComponent } from '../azure-resource-picker/azure-resource-picker.component';
import { AzureService } from '@app/features/settings/services/azure.service';
import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import type { StorageConnection } from '../../models/storage-connection.model';

export type ConnectionDialogMode = 'create' | 'edit';

export interface ConnectionDialogResult {
  name: string;
  category?: string;
  subscription: AzureSubscription;
  storageAccount: AzureStorageAccount;
  container: AzureContainer;
}

export interface ConnectionDialogData {
  mode?: ConnectionDialogMode;
  initialConnection?: StorageConnection;
}

interface AddConnectionForm {
  name: FormControl<string>;
  category: FormControl<string>;
  subscription: FormControl<AzureSubscription | null>;
  storageAccount: FormControl<AzureStorageAccount | null>;
  container: FormControl<AzureContainer | null>;
}

@Component({
  selector: 'app-add-connection-dialog',
  imports: [ReactiveFormsModule, InputText, AzureResourcePickerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-connection-dialog.component.html',
})
export class AddConnectionDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);
  private readonly azure = inject(AzureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogData = (this.config.data ?? {}) as ConnectionDialogData;
  private readonly initialConnection = this.dialogData.initialConnection;

  readonly mode: ConnectionDialogMode = this.dialogData.mode ?? 'create';
  readonly descriptionKey =
    this.mode === 'edit'
      ? 'connections.dialog.editDescription'
      : 'connections.dialog.description';
  readonly submitLabelKey =
    this.mode === 'edit'
      ? 'connections.dialog.update'
      : 'connections.dialog.save';

  readonly form = new FormGroup<AddConnectionForm>({
    name: new FormControl('', {
      nonNullable: true,
      validators: [trimmedRequiredValidator],
    }),
    category: new FormControl('', {
      nonNullable: true,
    }),
    subscription: new FormControl<AzureSubscription | null>(
      this.mode === 'edit' ? null : this.azure.selectedSubscription(),
      {
        validators: [Validators.required],
      },
    ),
    storageAccount: new FormControl<AzureStorageAccount | null>(
      {
        value: this.mode === 'edit' ? null : this.azure.selectedStorageAccount(),
        disabled:
          this.mode === 'edit' ? true : this.azure.selectedSubscription() === null,
      },
      { validators: [Validators.required] },
    ),
    container: new FormControl<AzureContainer | null>(
      {
        value: this.mode === 'edit' ? null : this.azure.selectedContainer(),
        disabled:
          this.mode === 'edit' ? true : this.azure.selectedStorageAccount() === null,
      },
      { validators: [Validators.required] },
    ),
  });

  readonly subscriptions = this.azure.subscriptions;
  readonly subscriptionsLoading = computed(() => this.azure.subscriptionsStatus() === 'loading');
  readonly subscriptionsError = this.azure.subscriptionsError;

  readonly storageAccounts = this.azure.storageAccounts;
  readonly storageAccountsLoading = computed(() => this.azure.storageAccountsStatus() === 'loading');
  readonly storageAccountsError = this.azure.storageAccountsError;

  readonly containers = this.azure.containers;
  readonly containersLoading = computed(() => this.azure.containersStatus() === 'loading');
  readonly containersError = this.azure.containersError;

  readonly nameControl = this.form.controls.name;
  readonly categoryControl = this.form.controls.category;
  readonly subscriptionControl = this.form.controls.subscription;
  readonly storageAccountControl = this.form.controls.storageAccount;
  readonly containerControl = this.form.controls.container;

  constructor() {
    this.watchSelectionChanges();
    void this.initializeForm();
  }

  save(): void {
    const name = this.nameControl.value.trim();
    const category = this.categoryControl.value.trim();
    const subscription = this.subscriptionControl.value;
    const storageAccount = this.storageAccountControl.value;
    const container = this.containerControl.value;
    if (!name || !subscription || !storageAccount || !container) return;

    const result: ConnectionDialogResult = category
      ? { name, category, subscription, storageAccount, container }
      : { name, subscription, storageAccount, container };
    this.ref.close(result);
  }

  cancel(): void {
    this.ref.close(null);
  }

  private async initializeForm(): Promise<void> {
    if (this.initialConnection) {
      this.nameControl.setValue(this.initialConnection.name);
      this.categoryControl.setValue(this.initialConnection.category ?? '');
    }

    if (this.subscriptions().length === 0) {
      await this.azure.loadSubscriptions();
    }

    if (!this.initialConnection) return;

    await this.applyInitialSelection(this.initialConnection);
  }

  private watchSelectionChanges(): void {
    this.subscriptionControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((subscription) => {
        this.storageAccountControl.reset(null, { emitEvent: false });
        this.containerControl.reset(null, { emitEvent: false });
        if (subscription) {
          this.storageAccountControl.enable({ emitEvent: false });
        } else {
          this.storageAccountControl.disable({ emitEvent: false });
        }
        this.containerControl.disable({ emitEvent: false });
        this.azure.selectSubscription(subscription);
      });

    this.storageAccountControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((storageAccount) => {
        this.containerControl.reset(null, { emitEvent: false });
        if (storageAccount) {
          this.containerControl.enable({ emitEvent: false });
        } else {
          this.containerControl.disable({ emitEvent: false });
        }
        this.azure.selectStorageAccount(storageAccount);
      });

    this.containerControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((container) => {
        this.azure.selectContainer(container);
      });
  }

  private async applyInitialSelection(connection: StorageConnection): Promise<void> {
    const subscription = this.subscriptions().find((item) => item.id === connection.subscriptionId);
    if (!subscription) {
      this.clearAzureSelection();
      return;
    }

    this.subscriptionControl.setValue(subscription, { emitEvent: false });
    this.storageAccountControl.reset(null, { emitEvent: false });
    this.storageAccountControl.enable({ emitEvent: false });
    this.containerControl.reset(null, { emitEvent: false });
    this.containerControl.disable({ emitEvent: false });
    this.azure.selectSubscription(subscription);
    await this.azure.loadStorageAccounts(subscription.id);

    const storageAccount = this.storageAccounts().find(
      (item) =>
        item.name === connection.storageAccountName &&
        item.resourceGroup === connection.resourceGroup,
    );
    if (!storageAccount) return;

    this.storageAccountControl.setValue(storageAccount, { emitEvent: false });
    this.containerControl.reset(null, { emitEvent: false });
    this.containerControl.enable({ emitEvent: false });
    this.azure.selectStorageAccount(storageAccount);
    await this.azure.loadContainers(
      subscription.id,
      storageAccount.resourceGroup,
      storageAccount.name,
    );

    const container = this.containers().find((item) => item.name === connection.containerName);
    if (!container) return;

    this.containerControl.setValue(container, { emitEvent: false });
  }

  private clearAzureSelection(): void {
    this.subscriptionControl.setValue(null, { emitEvent: false });
    this.storageAccountControl.reset(null, { emitEvent: false });
    this.storageAccountControl.disable({ emitEvent: false });
    this.containerControl.reset(null, { emitEvent: false });
    this.containerControl.disable({ emitEvent: false });
    this.azure.selectSubscription(null);
  }
}

function trimmedRequiredValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}
