import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import type {
  ConnectionDialogResult,
} from '@app/features/connections/components/add-connection-dialog.component';
import type { StorageConnection } from '@app/features/connections/models/storage-connection.model';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from '@app/features/settings/models/azure.model';
import { AzureService } from '@app/features/settings/services/azure.service';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { ConnectionsPage } from './connections.page';

vi.mock('uuid', () => ({
  v4: () => 'ef0f8f2c-0a2d-4d6d-8f46-b0f7f0e7d8ab',
}));

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
  readonly update = vi.fn<(connection: StorageConnection) => void>();
  readonly remove = vi.fn<(id: string) => void>();
}

class AzureServiceStub implements Partial<AzureService> {
  readonly authenticatedState = signal(true);
  readonly azureCliMissingState = signal(false);
  readonly isAuthenticated = computed(() => this.authenticatedState());
  readonly azureCliMissing = computed(() => this.azureCliMissingState());
}

class DialogServiceStub implements Partial<DialogService> {
  onClose$ = new Subject<ConnectionDialogResult | null | undefined>();
  open = vi.fn(() => ({
    onClose: this.onClose$.asObservable(),
  }));
}

class ConfirmationServiceStub implements Partial<ConfirmationService> {
  private readonly requireConfirmationSource = new Subject<unknown>();
  private readonly acceptConfirmationSource = new Subject<unknown>();

  readonly requireConfirmation$ = this.requireConfirmationSource.asObservable();
  readonly accept = this.acceptConfirmationSource.asObservable();
  readonly confirm = vi.fn<(options: Record<string, unknown>) => ConfirmationService>(() => {
    this.requireConfirmationSource.next(null);
    return this as ConfirmationService;
  });
  readonly close = vi.fn<() => ConfirmationService>(() => this as ConfirmationService);
  readonly onAccept = vi.fn<() => void>(() => {
    this.acceptConfirmationSource.next(null);
  });
}

describe('ConnectionsPage', () => {
  let fixture: ComponentFixture<ConnectionsPage>;
  let component: ConnectionsPage;
  let connections: ConnectionsServiceStub;
  let azure: AzureServiceStub;
  let dialog: DialogServiceStub;
  let confirmation: ConfirmationServiceStub;
  let router: {
    navigate: ReturnType<typeof vi.fn<(commands: string[]) => Promise<boolean>>>;
    createUrlTree: ReturnType<typeof vi.fn<(commands: unknown[]) => unknown>>;
    serializeUrl: ReturnType<typeof vi.fn<(tree: unknown) => string>>;
    events: typeof EMPTY;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));

    connections = new ConnectionsServiceStub();
    azure = new AzureServiceStub();
    dialog = new DialogServiceStub();
    confirmation = new ConfirmationServiceStub();
    router = {
      navigate: vi.fn(async () => true),
      createUrlTree: vi.fn((commands: unknown[]) => commands),
      serializeUrl: vi.fn(() => '/settings'),
      events: EMPTY,
    };

    TestBed.overrideComponent(ConnectionsPage, {
      set: {
        providers: [
          { provide: DialogService, useValue: dialog },
          { provide: ConfirmationService, useValue: confirmation },
        ],
      },
    });

    await TestBed.configureTestingModule({
      imports: [ConnectionsPage],
      providers: [
        provideTranslateTesting(),
        { provide: ConnectionsService, useValue: connections },
        { provide: AzureService, useValue: azure },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(ConnectionsPage);
    component = fixture.componentInstance;
  });

  it('loads connections on init', () => {
    fixture.detectChanges();

    expect(connections.load).toHaveBeenCalledOnce();
  });

  it('keeps the page header fixed and renders the connections list in its own scroll container', () => {
    connections.connectionsState.set([createConnection({ id: 'conn-1', name: 'prod-logs' })]);

    fixture.detectChanges();

    const page = fixture.nativeElement.querySelector(
      '[data-testid="connections-page"]',
    ) as HTMLElement | null;
    const header = fixture.nativeElement.querySelector(
      '[data-testid="connections-page-header"]',
    ) as HTMLElement | null;
    const listScroll = fixture.nativeElement.querySelector(
      '[data-testid="connections-list-scroll"]',
    ) as HTMLElement | null;
    const searchField = fixture.nativeElement.querySelector('.p-iconfield') as HTMLElement | null;

    expect(page?.className).toContain('overflow-hidden');
    expect(page?.className).not.toContain('overflow-auto');
    expect(header?.className).toContain('shrink-0');
    expect(listScroll?.className).toContain('min-h-0');
    expect(listScroll?.className).toContain('flex-1');
    expect(listScroll?.className).toContain('overflow-y-auto');
    expect(header?.contains(searchField)).toBe(true);
    expect(listScroll?.contains(searchField)).toBe(false);
    expect(listScroll?.textContent).toContain('prod-logs');
  });

  it('derives the total container stat, renders the compact Azure CLI card, and filters the visible cards', () => {
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

    expect(component.pageVm().totalContainers).toBe('03');
    expect(fixture.nativeElement.textContent).toContain('Azure CLI is required');
    expect(fixture.nativeElement.textContent).toContain(
      'The app uses your Azure CLI session, does not persist Azure tokens',
    );
    expect(fixture.nativeElement.textContent).toContain('az login');
    expect(fixture.nativeElement.textContent).toContain('prod-logs');
    expect(fixture.nativeElement.textContent).toContain('staging-archive');
    expect(fixture.nativeElement.querySelector('.p-iconfield')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.p-inputicon .pi-search')).not.toBeNull();

    component.onSearch('staging');
    fixture.detectChanges();

    expect(component.pageVm().cards).toHaveLength(1);
    expect(component.pageVm().cards[0]?.name).toBe('staging-archive');
    expect(fixture.nativeElement.textContent).not.toContain('prod-logs');
  });

  it('renders the Azure CLI card with error styling when the CLI is missing', () => {
    azure.azureCliMissingState.set(true);

    fixture.detectChanges();

    const article = fixture.nativeElement.querySelector('article');
    expect(article?.className).toContain('border-error/40');
    expect(article?.className).toContain('bg-error-container/70');
    expect(fixture.nativeElement.textContent).toContain('Azure CLI is required');
  });

  it('renders the edit action and disables it when Azure is not authenticated', () => {
    connections.connectionsState.set([createConnection({ id: 'conn-1', name: 'prod-logs' })]);
    azure.authenticatedState.set(false);

    fixture.detectChanges();

    const actionButtons = [
      ...fixture.nativeElement.querySelectorAll('li .flex.shrink-0.items-center.gap-2 button'),
    ] as HTMLButtonElement[];
    const editButton = actionButtons[0];

    expect(editButton).toBeDefined();
    expect(editButton?.disabled).toBe(true);
    expect(editButton?.getAttribute('aria-label')).toBe('Edit connection');
  });

  it('keeps the list flat when no visible connection has a category', () => {
    connections.connectionsState.set([
      createConnection({ id: 'conn-1', name: 'prod-logs' }),
      createConnection({ id: 'conn-2', name: 'staging-logs' }),
    ]);

    fixture.detectChanges();

    expect(component.pageVm().showCategoryGroups).toBe(false);
    expect(component.pageVm().cardGroups).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Uncategorized');
  });

  it('renders loading feedback inside the list scroll area', () => {
    connections.statusState.set('loading');

    fixture.detectChanges();

    const listScroll = fixture.nativeElement.querySelector(
      '[data-testid="connections-list-scroll"]',
    ) as HTMLElement | null;
    const header = fixture.nativeElement.querySelector(
      '[data-testid="connections-page-header"]',
    ) as HTMLElement | null;

    expect(listScroll?.textContent).toContain('Loading connections…');
    expect(header?.textContent).toContain('Overview');
  });

  it('groups visible connections by category and places uncategorized entries last', () => {
    connections.connectionsState.set([
      createConnection({ id: 'conn-1', name: 'prod-logs', category: 'Operations' }),
      createConnection({ id: 'conn-2', name: 'audit-logs', category: 'Security' }),
      createConnection({ id: 'conn-3', name: 'misc-logs' }),
      createConnection({ id: 'conn-4', name: 'ops-archive', category: 'Operations' }),
    ]);

    fixture.detectChanges();

    expect(component.pageVm().showCategoryGroups).toBe(true);
    expect(component.pageVm().cardGroups.map((group) => group.label)).toEqual([
      'Operations',
      'Security',
      'Uncategorized',
    ]);
    expect(component.pageVm().cardGroups[0]?.cards.map((card) => card.name)).toEqual([
      'prod-logs',
      'ops-archive',
    ]);
    expect(component.pageVm().cardGroups[2]?.cards.map((card) => card.name)).toEqual(['misc-logs']);
    expect(fixture.nativeElement.textContent).toContain('Operations');
    expect(fixture.nativeElement.textContent).toContain('Security');
    expect(fixture.nativeElement.textContent).toContain('Uncategorized');
  });

  it('matches categories in search and regroups the filtered result', () => {
    connections.connectionsState.set([
      createConnection({ id: 'conn-1', name: 'prod-logs', category: 'Operations' }),
      createConnection({ id: 'conn-2', name: 'audit-logs', category: 'Security' }),
      createConnection({ id: 'conn-3', name: 'misc-logs' }),
    ]);

    fixture.detectChanges();
    component.onSearch('security');
    fixture.detectChanges();

    expect(component.pageVm().cards.map((card) => card.name)).toEqual(['audit-logs']);
    expect(component.pageVm().showCategoryGroups).toBe(true);
    expect(component.pageVm().cardGroups.map((group) => group.label)).toEqual(['Security']);
    expect(fixture.nativeElement.textContent).toContain('audit-logs');
    expect(fixture.nativeElement.textContent).not.toContain('prod-logs');
    expect(fixture.nativeElement.textContent).not.toContain('misc-logs');
  });

  it('adds a new connection when the dialog closes with a result', async () => {
    const result = createDialogResult({ category: 'Operations' });
    fixture.detectChanges();

    component.openDialog();
    dialog.onClose$.next(result);
    dialog.onClose$.complete();
    await flushAsync();

    expect(dialog.open).toHaveBeenCalledOnce();
    expect(connections.add).toHaveBeenCalledWith({
      id: 'ef0f8f2c-0a2d-4d6d-8f46-b0f7f0e7d8ab',
      name: 'prod',
      category: 'Operations',
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
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        header: 'Add Storage Connection',
        data: {
          mode: 'create',
        },
      }),
    );
  });

  it('opens the edit dialog with the current connection data', () => {
    const raw = createConnection({
      id: 'conn-1',
      name: 'prod-logs',
      category: 'Operations',
    });
    const card = createCardInput({ raw, category: 'Operations' });

    fixture.detectChanges();
    component.openEditDialog(card);

    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        header: 'Edit Storage Connection',
        data: {
          mode: 'edit',
          initialConnection: raw,
        },
      }),
    );
  });

  it('updates an existing connection when the edit dialog closes with a result', async () => {
    const raw = createConnection({
      id: 'conn-1',
      name: 'prod-logs',
      status: 'offline',
      lastUsed: '2026-04-12T11:00:00Z',
      stateText: 'Disconnected',
      containerCount: 7,
    });
    const card = createCardInput({ raw, isOffline: true });
    const result = createDialogResult({
      name: 'prod-archive',
      category: 'Operations',
      storageAccount: createStorageAccount({
        id: 'acc-2',
        name: 'storage-b',
        resourceGroup: 'rg-2',
      }),
      container: createContainer({ name: 'archive' }),
    });

    fixture.detectChanges();
    component.openEditDialog(card);
    dialog.onClose$.next(result);
    dialog.onClose$.complete();
    await flushAsync();

    expect(connections.update).toHaveBeenCalledWith({
      ...raw,
      name: 'prod-archive',
      category: 'Operations',
      displayName: 'storage-b / archive',
      subscriptionId: 'sub-1',
      resourceGroup: 'rg-2',
      storageAccountName: 'storage-b',
      containerName: 'archive',
    });
    expect(connections.add).not.toHaveBeenCalled();
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
    const card = component.pageVm().cards[0] ?? createCardInput();

    component.openLogs(card);
    await flushAsync();

    expect(connections.select).toHaveBeenCalledWith(card.id);
    expect(router.navigate).toHaveBeenCalledWith(['/logs', card.id]);
  });

  it('opens a confirmation dialog before removing a connection', () => {
    const card = createCardInput();

    component.requestRemove(card);

    expect(confirmation.confirm).toHaveBeenCalledOnce();
    expect(confirmation.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Remove Connection',
        message: 'Remove prod-logs from saved storage connections?',
        acceptLabel: 'Remove',
        rejectLabel: 'Cancel',
      }),
    );
    expect(connections.remove).not.toHaveBeenCalled();
  });

  it('removes the connection when the confirmation is accepted', () => {
    const card = createCardInput();

    component.requestRemove(card);
    const options = confirmation.confirm.mock.calls[0]?.[0];
    options?.accept?.();

    expect(connections.remove).toHaveBeenCalledWith(card.id);
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

function createDialogResult(
  overrides: Partial<ConnectionDialogResult> = {},
): ConnectionDialogResult {
  const subscription: AzureSubscription = {
    id: 'sub-1',
    displayName: 'Production',
    tenantId: 'tenant-1',
    state: 'Enabled',
  };
  const storageAccount = createStorageAccount();
  const container = createContainer();

  return {
    name: 'prod',
    subscription,
    storageAccount,
    container,
    ...overrides,
  };
}

function createCardInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    name: 'prod-logs',
    category: undefined,
    displayName: 'storage-a / logs',
    environment: 'production',
    accessTier: 'Hot',
    stateText: 'Connected',
    statusIcon: 'pi-check-circle',
    statusColorClass: 'text-primary',
    lastUsedRelative: '1 hr ago',
    isOffline: false,
    raw: createConnection(),
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

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
