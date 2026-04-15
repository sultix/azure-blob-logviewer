import { computed, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import { AzureService } from '@app/features/settings/services/azure.service';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { AddConnectionDialogComponent } from './add-connection-dialog.component';

class DynamicDialogRefStub implements Partial<DynamicDialogRef> {
  readonly close = vi.fn<(result?: unknown) => void>();
}

class AzureServiceStub implements Partial<AzureService> {
  readonly subscriptionsState = signal<AzureSubscription[]>([]);
  readonly subscriptionsStatus = computed(() => 'success');
  readonly subscriptions = computed(() => this.subscriptionsState());
  readonly subscriptionsError = computed(() => null);
  readonly selectedSubscription = signal<AzureSubscription | null>(null);

  readonly storageAccountsState = signal<AzureStorageAccount[]>([]);
  readonly storageAccountsStatus = computed(() => 'success');
  readonly storageAccounts = computed(() => this.storageAccountsState());
  readonly storageAccountsError = computed(() => null);
  readonly selectedStorageAccount = signal<AzureStorageAccount | null>(null);

  readonly containersState = signal<AzureContainer[]>([]);
  readonly containersStatus = computed(() => 'success');
  readonly containers = computed(() => this.containersState());
  readonly containersError = computed(() => null);
  readonly selectedContainer = signal<AzureContainer | null>(null);

  readonly loadSubscriptions = vi.fn<() => Promise<void>>(async () => undefined);
  readonly selectSubscription = vi.fn((subscription: AzureSubscription | null) => {
    this.selectedSubscription.set(subscription);
  });
  readonly selectStorageAccount = vi.fn((account: AzureStorageAccount | null) => {
    this.selectedStorageAccount.set(account);
  });
  readonly selectContainer = vi.fn((container: AzureContainer | null) => {
    this.selectedContainer.set(container);
  });
}

describe('AddConnectionDialogComponent', () => {
  let fixture: ComponentFixture<AddConnectionDialogComponent>;
  let component: AddConnectionDialogComponent;
  let dialogRef: DynamicDialogRefStub;
  let azure: AzureServiceStub;

  beforeEach(async () => {
    dialogRef = new DynamicDialogRefStub();
    azure = new AzureServiceStub();

    await TestBed.configureTestingModule({
      imports: [AddConnectionDialogComponent],
      providers: [
        provideTranslateTesting(),
        { provide: DynamicDialogRef, useValue: dialogRef },
        { provide: AzureService, useValue: azure },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(AddConnectionDialogComponent);
    component = fixture.componentInstance;
  });

  it('renders the optional category field directly after the name field', () => {
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll('label span')].map((element) =>
      element.textContent?.trim()
    );

    expect(labels.slice(0, 2)).toEqual(['Connection Name', 'Category']);
  });

  it('is invalid until name, subscription, storage account, and container are set', () => {
    fixture.detectChanges();

    expect(component.form.valid).toBe(false);
    expect(component.canSaveValue).toBe(false);

    component.form.controls.name.setValue('prod');
    component.form.controls.subscription.setValue(createSubscription());
    component.form.controls.storageAccount.setValue(createStorageAccount());
    component.form.controls.container.setValue(createContainer());

    expect(component.form.valid).toBe(true);
    expect(component.canSaveValue).toBe(true);
  });

  it('saves a trimmed category when one is provided', () => {
    const subscription = createSubscription();
    const storageAccount = createStorageAccount();
    const container = createContainer();

    component.form.controls.name.setValue('prod');
    component.form.controls.category.setValue('  Operations  ');
    component.form.controls.subscription.setValue(subscription);
    component.form.controls.storageAccount.setValue(storageAccount);
    component.form.controls.container.setValue(container);

    component.save();

    expect(dialogRef.close).toHaveBeenCalledWith({
      name: 'prod',
      category: 'Operations',
      subscription,
      storageAccount,
      container,
    });
  });

  it('omits category when the input is empty or whitespace-only', () => {
    const subscription = createSubscription();
    const storageAccount = createStorageAccount();
    const container = createContainer();

    component.form.controls.name.setValue('prod');
    component.form.controls.category.setValue('   ');
    component.form.controls.subscription.setValue(subscription);
    component.form.controls.storageAccount.setValue(storageAccount);
    component.form.controls.container.setValue(container);

    component.save();

    expect(dialogRef.close).toHaveBeenCalledWith({
      name: 'prod',
      subscription,
      storageAccount,
      container,
    });
  });

  it('renders the save button disabled until the form is valid', () => {
    fixture.detectChanges();

    const saveButton: HTMLButtonElement = fixture.debugElement.queryAll(By.css('button'))[1]
      .nativeElement as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    component.form.controls.name.setValue('prod');
    component.form.controls.subscription.setValue(createSubscription());
    component.form.controls.storageAccount.setValue(createStorageAccount());
    component.form.controls.container.setValue(createContainer());
    fixture.detectChanges();

    expect(saveButton.disabled).toBe(false);
  });
});

function createSubscription(): AzureSubscription {
  return {
    id: 'sub-1',
    displayName: 'Production',
    tenantId: 'tenant-1',
    state: 'Enabled',
  };
}

function createStorageAccount(): AzureStorageAccount {
  return {
    id: 'acc-1',
    name: 'storage-a',
    location: 'westeurope',
    kind: 'StorageV2',
    resourceGroup: 'rg-1',
    subscriptionId: 'sub-1',
  };
}

function createContainer(): AzureContainer {
  return {
    name: 'logs',
    lastModified: '2026-04-13T10:30:00Z',
    leaseState: 'available',
  };
}
