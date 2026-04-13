import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { DialogService } from 'primeng/dynamicdialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import type {
  AddConnectionResult,
} from '@app/features/connections/components/add-connection-dialog.component';
import type { StorageConnection } from '@app/features/connections/models/storage-connection.model';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import { AzureService } from '@app/features/settings/services/azure.service';

import { ConnectionsPage } from './connections.page';

class ConnectionsServiceStub implements Partial<ConnectionsService> {
  readonly statusState = signal<'idle' | 'loading' | 'success' | 'error'>('success');
  readonly errorState = signal<string | null>(null);
  readonly connectionsState = signal<StorageConnection[]>([]);

  readonly status = computed(() => this.statusState());
  readonly errorMessage = computed(() => this.errorState());
  readonly connections = computed(() => this.connectionsState());
  readonly isEmpty = computed(
    () => this.statusState() === 'success' && this.connectionsState().length === 0,
  );

  readonly load = vi.fn<() => Promise<void>>(async () => undefined);
  readonly select = vi.fn<(id: string | null) => void>();
  readonly add = vi.fn<(connection: StorageConnection) => void>();
}

class AzureServiceStub implements Partial<AzureService> {
  readonly authenticatedState = signal(true);
  readonly isAuthenticated = computed(() => this.authenticatedState());
}

class DialogServiceStub implements Partial<DialogService> {
  onClose$ = new Subject<AddConnectionResult | null | undefined>();
  open = vi.fn(() => ({
    onClose: this.onClose$.asObservable(),
  }));
}

describe('ConnectionsPage', () => {
  let fixture: ComponentFixture<ConnectionsPage>;
  let component: ConnectionsPage;
  let connections: ConnectionsServiceStub;
  let azure: AzureServiceStub;
  let dialog: DialogServiceStub;
  let router: { navigate: ReturnType<typeof vi.fn<(commands: string[]) => Promise<boolean>>> };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T12:00:00Z').getTime());

    connections = new ConnectionsServiceStub();
    azure = new AzureServiceStub();
    dialog = new DialogServiceStub();
    router = {
      navigate: vi.fn(async () => true),
    };

    TestBed.overrideComponent(ConnectionsPage, {
      set: {
        providers: [{ provide: DialogService, useValue: dialog }],
      },
    });

    await TestBed.configureTestingModule({
      imports: [ConnectionsPage],
      providers: [
        { provide: ConnectionsService, useValue: connections },
        { provide: AzureService, useValue: azure },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectionsPage);
    component = fixture.componentInstance;
  });

  it('loads connections on init', () => {
    fixture.detectChanges();

    expect(connections.load).toHaveBeenCalledOnce();
  });

  it('derives stats and filters the visible cards', () => {
    connections.connectionsState.set([
      createConnection({
        id: 'conn-1',
        name: 'prod-logs',
        displayName: 'storage-a / logs',
        status: 'online',
        containerCount: 2,
      }),
      createConnection({
        id: 'conn-2',
        name: 'staging-archive',
        displayName: 'storage-b / archive',
        environment: 'staging',
        status: 'offline',
        containerCount: 1,
      }),
    ]);

    fixture.detectChanges();

    expect(component.stats()).toEqual([
      {
        label: 'Total Containers',
        value: '03',
        icon: 'pi-database',
        accent: 'primary',
      },
      {
        label: 'Active Streams',
        value: '01',
        icon: 'pi-wave-pulse',
        accent: 'secondary',
      },
      {
        label: 'Error Events',
        value: '01',
        icon: 'pi-exclamation-triangle',
        accent: 'error',
      },
      {
        label: 'Uptime',
        value: '99.9%',
        icon: 'pi-clock',
        accent: 'tertiary',
      },
    ]);
    expect(fixture.nativeElement.textContent).toContain('prod-logs');
    expect(fixture.nativeElement.textContent).toContain('staging-archive');

    component.onSearch('staging');
    fixture.detectChanges();

    expect(component.cards()).toHaveLength(1);
    expect(component.cards()[0]?.name).toBe('staging-archive');
    expect(fixture.nativeElement.textContent).not.toContain('prod-logs');
  });

  it('adds a new connection when the dialog closes with a result', async () => {
    const result = createDialogResult();
    fixture.detectChanges();

    component.openDialog();
    dialog.onClose$.next(result);
    dialog.onClose$.complete();
    await flushAsync();

    expect(dialog.open).toHaveBeenCalledOnce();
    expect(connections.add).toHaveBeenCalledWith({
      id: 'storage-a-logs-1776081600000',
      name: 'prod',
      displayName: 'storage-a / logs',
      environment: 'production',
      status: 'online',
      lastUsed: '2026-04-13T12:00:00.000Z',
      accessTier: 'Hot',
      stateText: 'Connected',
      containerCount: 1,
      subscriptionId: 'sub-1',
      resourceGroup: 'rg-1',
      storageAccountName: 'storage-a',
      containerName: 'logs',
    });
  });

  it('ignores dialog close events without a result', async () => {
    fixture.detectChanges();

    component.openDialog();
    dialog.onClose$.next(null);
    dialog.onClose$.complete();
    await flushAsync();

    expect(connections.add).not.toHaveBeenCalled();
  });

  it('selects the connection and navigates to its logs page', async () => {
    const card = component.cards()[0] ?? createCardInput();

    component.openLogs(card);
    await flushAsync();

    expect(connections.select).toHaveBeenCalledWith(card.id);
    expect(router.navigate).toHaveBeenCalledWith(['/logs', card.id]);
  });
});

function createConnection(overrides: Partial<StorageConnection> = {}): StorageConnection {
  return {
    id: 'conn-1',
    name: 'prod-logs',
    displayName: 'storage-a / logs',
    environment: 'production',
    status: 'online',
    lastUsed: '2026-04-13T11:00:00Z',
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

function createDialogResult(overrides: Partial<AddConnectionResult> = {}): AddConnectionResult {
  const subscription: AzureSubscription = {
    id: 'sub-1',
    displayName: 'Production',
    tenantId: 'tenant-1',
    state: 'Enabled',
  };
  const storageAccount: AzureStorageAccount = {
    id: 'acc-1',
    name: 'storage-a',
    location: 'westeurope',
    kind: 'StorageV2',
    resourceGroup: 'rg-1',
    subscriptionId: 'sub-1',
  };
  const container: AzureContainer = {
    name: 'logs',
    lastModified: '2026-04-13T10:30:00Z',
    leaseState: 'available',
  };

  return {
    name: 'prod',
    subscription,
    storageAccount,
    container,
    ...overrides,
  };
}

function createCardInput() {
  return {
    id: 'conn-1',
    name: 'prod-logs',
    displayName: 'storage-a / logs',
    environment: 'production',
    environmentLabel: 'PRODUCTION',
    accessTier: 'Hot',
    stateText: 'Connected',
    statusLabel: 'Online',
    statusIcon: 'pi-check-circle',
    statusColorClass: 'text-primary',
    lastUsedRelative: '1 hr ago',
    isOffline: false,
    raw: createConnection(),
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
