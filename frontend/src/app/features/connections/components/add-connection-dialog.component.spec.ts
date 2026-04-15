import { computed, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
} from 'primeng/dynamicdialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageConnection } from '../models/storage-connection.model';
import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import { AzureService } from '@app/features/settings/services/azure.service';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import {
  AddConnectionDialogComponent,
  type ConnectionDialogData,
} from './add-connection-dialog.component';

class DynamicDialogRefStub implements Partial<DynamicDialogRef> {
  readonly close = vi.fn<(result?: unknown) => void>();
}

class DynamicDialogConfigStub implements Partial<DynamicDialogConfig> {
  data?: ConnectionDialogData;
}

class AzureServiceStub implements Partial<AzureService> {
  readonly subscriptionsState = signal<AzureSubscription[]>([]);
  readonly subscriptionsStatusState = signal<'idle' | 'loading' | 'success' | 'error'>('success');
  readonly subscriptionsStatus = computed(() => this.subscriptionsStatusState());
  readonly subscriptions = computed(() => this.subscriptionsState());
  readonly subscriptionsError = computed(() => null);
  readonly selectedSubscription = signal<AzureSubscription | null>(null);

  readonly storageAccountsState = signal<AzureStorageAccount[]>([]);
  readonly storageAccountsStatusState = signal<'idle' | 'loading' | 'success' | 'error'>('success');
  readonly storageAccountsStatus = computed(() => this.storageAccountsStatusState());
  readonly storageAccounts = computed(() => this.storageAccountsState());
  readonly storageAccountsError = computed(() => null);
  readonly selectedStorageAccount = signal<AzureStorageAccount | null>(null);

  readonly containersState = signal<AzureContainer[]>([]);
  readonly containersStatusState = signal<'idle' | 'loading' | 'success' | 'error'>('success');
  readonly containersStatus = computed(() => this.containersStatusState());
  readonly containers = computed(() => this.containersState());
  readonly containersError = computed(() => null);
  readonly selectedContainer = signal<AzureContainer | null>(null);

  readonly loadSubscriptions = vi.fn<() => Promise<void>>(async () => {
    this.subscriptionsStatusState.set('loading');
    await Promise.resolve();
    this.subscriptionsStatusState.set('success');
  });
  readonly selectSubscription = vi.fn((subscription: AzureSubscription | null) => {
    this.selectedSubscription.set(subscription);
    this.selectedStorageAccount.set(null);
    this.selectedContainer.set(null);
    this.containersStatusState.set('idle');
    if (!subscription) {
      this.storageAccountsStatusState.set('idle');
    }
  });
  readonly loadStorageAccounts = vi.fn<(_subscriptionId: string) => Promise<void>>(async () => {
    this.storageAccountsStatusState.set('loading');
    await Promise.resolve();
    this.storageAccountsStatusState.set('success');
  });
  readonly selectStorageAccount = vi.fn((account: AzureStorageAccount | null) => {
    this.selectedStorageAccount.set(account);
    this.selectedContainer.set(null);
    if (!account) {
      this.containersStatusState.set('idle');
    }
  });
  readonly loadContainers = vi.fn<
    (_subscriptionId: string, _resourceGroup: string, _accountName: string) => Promise<void>
  >(async () => {
    this.containersStatusState.set('loading');
    await Promise.resolve();
    this.containersStatusState.set('success');
  });
  readonly selectContainer = vi.fn((container: AzureContainer | null) => {
    this.selectedContainer.set(container);
  });
}

describe('AddConnectionDialogComponent', () => {
  let dialogRef: DynamicDialogRefStub;
  let dialogConfig: DynamicDialogConfigStub;
  let azure: AzureServiceStub;

  beforeEach(async () => {
    dialogRef = new DynamicDialogRefStub();
    dialogConfig = new DynamicDialogConfigStub();
    azure = new AzureServiceStub();

    await TestBed.configureTestingModule({
      imports: [AddConnectionDialogComponent],
      providers: [
        provideTranslateTesting(),
        { provide: DynamicDialogRef, useValue: dialogRef },
        { provide: DynamicDialogConfig, useValue: dialogConfig },
        { provide: AzureService, useValue: azure },
      ],
    }).compileComponents();

    await initializeI18nForTests();
  });

  it('renders the optional category field directly after the name field', async () => {
    const { fixture } = await createComponent();

    const labels = [...fixture.nativeElement.querySelectorAll('label span')].map((element) =>
      element.textContent?.trim()
    );

    expect(labels.slice(0, 2)).toEqual(['Connection Name', 'Category']);
  });

  it('is invalid until name, subscription, storage account, and container are set', async () => {
    const { component } = await createComponent();

    expect(component.form.valid).toBe(false);
    expect(component.canSaveValue).toBe(false);

    component.form.controls.name.setValue('prod');
    component.form.controls.subscription.setValue(createSubscription());
    component.form.controls.storageAccount.setValue(createStorageAccount());
    component.form.controls.container.setValue(createContainer());

    expect(component.form.valid).toBe(true);
    expect(component.canSaveValue).toBe(true);
  });

  it('saves a trimmed category when one is provided', async () => {
    const { component } = await createComponent();
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

  it('omits category when the input is empty or whitespace-only', async () => {
    const { component } = await createComponent();
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

  it('renders edit copy and pre-fills the saved connection values', async () => {
    const subscription = createSubscription();
    const storageAccount = createStorageAccount();
    const container = createContainer();
    azure.subscriptionsState.set([subscription]);
    azure.storageAccountsState.set([storageAccount]);
    azure.containersState.set([container]);

    const { component, fixture } = await createComponent({
      mode: 'edit',
      initialConnection: createConnection(),
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Update the connection name, category, and Azure storage target.',
    );
    expect(component.submitLabelKey).toBe('connections.dialog.update');
    expect(component.form.controls.name.value).toBe('prod-storage');
    expect(component.form.controls.category.value).toBe('Operations');
    expect(component.form.controls.subscription.value).toEqual(subscription);
    expect(component.form.controls.storageAccount.value).toEqual(storageAccount);
    expect(component.form.controls.container.value).toEqual(container);
    expect(azure.loadStorageAccounts).toHaveBeenCalledWith('sub-1');
    expect(azure.loadContainers).toHaveBeenCalledWith('sub-1', 'rg-1', 'storage-a');
  });

  it('keeps the name and category but blocks save until a missing Azure target is reselected', async () => {
    azure.subscriptionsState.set([createSubscription({ id: 'sub-2' })]);

    const { component } = await createComponent({
      mode: 'edit',
      initialConnection: createConnection(),
    });

    expect(component.form.controls.name.value).toBe('prod-storage');
    expect(component.form.controls.category.value).toBe('Operations');
    expect(component.form.controls.subscription.value).toBeNull();
    expect(component.form.controls.storageAccount.value).toBeNull();
    expect(component.form.controls.container.value).toBeNull();
    expect(component.canSaveValue).toBe(false);
  });

  it('renders the save button disabled until the form is valid', async () => {
    const { component, fixture } = await createComponent();

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

  async function createComponent(data?: ConnectionDialogData): Promise<{
    fixture: ComponentFixture<AddConnectionDialogComponent>;
    component: AddConnectionDialogComponent;
  }> {
    dialogConfig.data = data;
    const fixture = TestBed.createComponent(AddConnectionDialogComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();
    return { fixture, component };
  }
});

function createSubscription(overrides: Partial<AzureSubscription> = {}): AzureSubscription {
  return {
    id: 'sub-1',
    displayName: 'Production',
    tenantId: 'tenant-1',
    state: 'Enabled',
    ...overrides,
  };
}

function createStorageAccount(
  overrides: Partial<AzureStorageAccount> = {},
): AzureStorageAccount {
  return {
    id: 'acc-1',
    name: 'storage-a',
    location: 'westeurope',
    kind: 'StorageV2',
    resourceGroup: 'rg-1',
    subscriptionId: 'sub-1',
    ...overrides,
  };
}

function createContainer(overrides: Partial<AzureContainer> = {}): AzureContainer {
  return {
    name: 'logs',
    lastModified: '2026-04-13T10:30:00Z',
    leaseState: 'available',
    ...overrides,
  };
}

function createConnection(overrides: Partial<StorageConnection> = {}): StorageConnection {
  return {
    id: 'conn-1',
    name: 'prod-storage',
    category: 'Operations',
    displayName: 'storage-a / logs',
    environment: 'production',
    status: 'online',
    lastUsed: '2026-04-13T10:30:00Z',
    accessTier: 'Hot',
    stateText: 'Connected',
    containerCount: 1,
    subscriptionId: 'sub-1',
    resourceGroup: 'rg-1',
    storageAccountName: 'storage-a',
    containerName: 'logs',
    ...overrides,
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
