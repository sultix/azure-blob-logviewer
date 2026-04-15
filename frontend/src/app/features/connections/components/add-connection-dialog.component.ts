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
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';

import { AzureResourcePickerComponent } from '@app/features/settings/components/azure-resource-picker.component';
import { AzureService } from '@app/features/settings/services/azure.service';
import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';

export interface AddConnectionResult {
  name: string;
  category?: string;
  subscription: AzureSubscription;
  storageAccount: AzureStorageAccount;
  container: AzureContainer;
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
  private readonly azure = inject(AzureService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = new FormGroup<AddConnectionForm>({
    name: new FormControl('', {
      nonNullable: true,
      validators: [trimmedRequiredValidator],
    }),
    category: new FormControl('', {
      nonNullable: true,
    }),
    subscription: new FormControl<AzureSubscription | null>(this.azure.selectedSubscription(), {
      validators: [Validators.required],
    }),
    storageAccount: new FormControl<AzureStorageAccount | null>(
      {
        value: this.azure.selectedStorageAccount(),
        disabled: this.azure.selectedSubscription() === null,
      },
      { validators: [Validators.required] },
    ),
    container: new FormControl<AzureContainer | null>(
      {
        value: this.azure.selectedContainer(),
        disabled: this.azure.selectedStorageAccount() === null,
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

  constructor() {
    this.watchSelectionChanges();

    if (this.subscriptions().length === 0) {
      void this.azure.loadSubscriptions();
    }
  }

  get nameControl(): FormControl<string> {
    return this.form.controls.name;
  }

  get categoryControl(): FormControl<string> {
    return this.form.controls.category;
  }

  get subscriptionControl(): FormControl<AzureSubscription | null> {
    return this.form.controls.subscription;
  }

  get storageAccountControl(): FormControl<AzureStorageAccount | null> {
    return this.form.controls.storageAccount;
  }

  get containerControl(): FormControl<AzureContainer | null> {
    return this.form.controls.container;
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

  get storageAccountsValue(): AzureStorageAccount[] {
    return this.storageAccounts();
  }

  get storageAccountsLoadingValue(): boolean {
    return this.storageAccountsLoading();
  }

  get storageAccountsErrorValue(): string | null {
    return this.storageAccountsError();
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

  get canSaveValue(): boolean {
    return this.form.valid;
  }

  save(): void {
    const name = this.nameControl.value.trim();
    const category = this.categoryControl.value.trim();
    const subscription = this.subscriptionControl.value;
    const storageAccount = this.storageAccountControl.value;
    const container = this.containerControl.value;
    if (!name || !subscription || !storageAccount || !container) return;

    const result: AddConnectionResult = category
      ? { name, category, subscription, storageAccount, container }
      : { name, subscription, storageAccount, container };
    this.ref.close(result);
  }

  cancel(): void {
    this.ref.close(null);
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
}

function trimmedRequiredValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}
