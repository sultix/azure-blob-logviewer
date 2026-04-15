import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, type ParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import type { StorageConnection } from '@app/features/connections/models/storage-connection.model';
import type { BlobViewSessionStatus } from '@app/features/logs/models/blob-view.model';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import type { LogEntry } from '@app/features/logs/models/log-entry.model';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { LogsService } from '../services/logs.service';

import { LogsPage } from './logs.page';

class LogsServiceStub implements Partial<LogsService> {
  readonly statusState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly entriesState = signal<LogEntry[]>([]);
  readonly errorState = signal<string | null>(null);
  readonly selectedEntryId = signal<string | null>(null);
  readonly selectedContentState = signal('');
  readonly selectedContentLoadedState = signal(false);
  readonly selectedContentErrorState = signal<string | null>(null);
  readonly contentLoading = signal(false);
  readonly contentWindowState = signal<{
    startOffset: number;
    endOffsetExclusive: number;
    blobSize: number;
    hasOlderContent: boolean;
    hasNewerContent: boolean;
  } | null>(null);
  readonly isLargeBlobState = signal(false);
  readonly largeViewerStatusState = signal<BlobViewSessionStatus | null>(null);
  readonly largeViewerLinesState = signal<{ lineNumber: number; content: string }[]>([]);
  readonly largeViewerViewportStartLineState = signal(0);
  readonly largeViewerViewportLineCountState = signal(120);
  readonly largeViewerTotalLinesState = signal(0);
  readonly largeViewerSearchQueryState = signal('');
  readonly largeViewerSearchMatchesState = signal<{ lineNumber: number; preview: string }[]>([]);
  readonly largeViewerSearchIsCompleteState = signal(true);
  readonly largeViewerRequestedScrollLineState = signal<number | null>(null);
  readonly largeViewerActiveMatchLineState = signal<number | null>(null);
  readonly largeViewerTailPreviewLinesState = signal<string[]>([]);
  readonly largeViewerCanEnableWordWrapState = signal(true);

  readonly status = computed(() => this.statusState());
  readonly entries = computed(() => this.entriesState());
  readonly errorMessage = computed(() => this.errorState());
  readonly isEmpty = computed(
    () => this.statusState() === 'success' && this.entriesState().length === 0,
  );
  readonly selectedEntry = computed(() => {
    const id = this.selectedEntryId();
    if (!id) {
      return null;
    }
    return this.entriesState().find((entry) => entry.id === id) ?? null;
  });
  readonly selectedContent = computed(() => this.selectedContentState());
  readonly selectedContentLoaded = computed(() => this.selectedContentLoadedState());
  readonly selectedContentError = computed(() => this.selectedContentErrorState());
  readonly contentWindow = computed(() => this.contentWindowState());
  readonly isLargeBlob = computed(() => this.isLargeBlobState());
  readonly largeViewerStatus = computed(() => this.largeViewerStatusState());
  readonly largeViewerLines = computed(() => this.largeViewerLinesState());
  readonly largeViewerViewportStartLine = computed(() => this.largeViewerViewportStartLineState());
  readonly largeViewerViewportLineCount = computed(() => this.largeViewerViewportLineCountState());
  readonly largeViewerTotalLines = computed(() => this.largeViewerTotalLinesState());
  readonly largeViewerSearchQuery = computed(() => this.largeViewerSearchQueryState());
  readonly largeViewerSearchMatches = computed(() => this.largeViewerSearchMatchesState());
  readonly largeViewerSearchIsComplete = computed(() => this.largeViewerSearchIsCompleteState());
  readonly largeViewerRequestedScrollLine = computed(() => this.largeViewerRequestedScrollLineState());
  readonly largeViewerActiveMatchLine = computed(() => this.largeViewerActiveMatchLineState());
  readonly largeViewerTailPreviewLines = computed(() => this.largeViewerTailPreviewLinesState());
  readonly largeViewerCanEnableWordWrap = computed(() => this.largeViewerCanEnableWordWrapState());

  readonly loadForConnection = vi.fn<(accountName: string, containerName: string) => Promise<void>>(
    async () => undefined,
  );
  readonly loadContent = vi.fn<(id: string) => Promise<void>>(async () => undefined);
  readonly selectEntry = vi.fn<(id: string | null) => void>((id) => {
    this.selectedEntryId.set(id);
  });
  readonly refreshContent = vi.fn<() => Promise<void>>(async () => undefined);
  readonly updateLargeViewport = vi.fn<(startLine: number, lineCount: number) => Promise<void>>(
    async () => undefined,
  );
  readonly updateLargeSearchQuery = vi.fn<(query: string) => Promise<void>>(async () => undefined);
  readonly selectPreviousSearchMatch = vi.fn<() => Promise<void>>(async () => undefined);
  readonly selectNextSearchMatch = vi.fn<() => Promise<void>>(async () => undefined);
  readonly exportLargeViewer = vi.fn<() => Promise<boolean>>(async () => false);
  readonly clearRequestedScrollLine = vi.fn<() => void>(() => {
    this.largeViewerRequestedScrollLineState.set(null);
  });
  readonly reset = vi.fn<() => void>(() => {
    this.statusState.set('idle');
    this.entriesState.set([]);
    this.errorState.set(null);
    this.selectedEntryId.set(null);
    this.selectedContentState.set('');
    this.selectedContentLoadedState.set(false);
    this.selectedContentErrorState.set(null);
    this.contentLoading.set(false);
    this.contentWindowState.set(null);
    this.isLargeBlobState.set(false);
    this.largeViewerStatusState.set(null);
    this.largeViewerLinesState.set([]);
    this.largeViewerViewportStartLineState.set(0);
    this.largeViewerViewportLineCountState.set(120);
    this.largeViewerTotalLinesState.set(0);
    this.largeViewerSearchQueryState.set('');
    this.largeViewerSearchMatchesState.set([]);
    this.largeViewerSearchIsCompleteState.set(true);
    this.largeViewerRequestedScrollLineState.set(null);
    this.largeViewerActiveMatchLineState.set(null);
    this.largeViewerTailPreviewLinesState.set([]);
    this.largeViewerCanEnableWordWrapState.set(true);
  });
  readonly setError = vi.fn<(message: string) => void>((message) => {
    this.statusState.set('error');
    this.entriesState.set([]);
    this.errorState.set(message);
    this.selectedEntryId.set(null);
    this.selectedContentState.set('');
    this.selectedContentLoadedState.set(false);
    this.selectedContentErrorState.set(null);
    this.contentLoading.set(false);
    this.contentWindowState.set(null);
    this.isLargeBlobState.set(false);
    this.largeViewerStatusState.set(null);
    this.largeViewerLinesState.set([]);
    this.largeViewerViewportStartLineState.set(0);
    this.largeViewerViewportLineCountState.set(120);
    this.largeViewerTotalLinesState.set(0);
    this.largeViewerSearchQueryState.set('');
    this.largeViewerSearchMatchesState.set([]);
    this.largeViewerSearchIsCompleteState.set(true);
    this.largeViewerRequestedScrollLineState.set(null);
    this.largeViewerActiveMatchLineState.set(null);
    this.largeViewerTailPreviewLinesState.set([]);
    this.largeViewerCanEnableWordWrapState.set(true);
  });
}

class ConnectionsServiceStub implements Partial<ConnectionsService> {
  readonly statusState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly status = computed(() => this.statusState());
  readonly load = vi.fn<() => Promise<void>>(async () => {
    this.statusState.set('success');
  });
  readonly getById = vi.fn<(id: string) => StorageConnection | null>(() => null);
}

class MessageServiceStub implements Partial<MessageService> {
  readonly add = vi.fn<(message: { severity?: string; summary?: string; detail?: string }) => void>();
}

describe('LogsPage', () => {
  let fixture: ComponentFixture<LogsPage>;
  let component: LogsPage;
  let logs: LogsServiceStub;
  let connections: ConnectionsServiceStub;
  let route: ActivatedRoute;
  let routeParamMap$: BehaviorSubject<ParamMap>;
  let messageService: MessageServiceStub;
  let createObjectUrlSpy: ReturnType<typeof vi.fn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    logs = new LogsServiceStub();
    connections = new ConnectionsServiceStub();
    messageService = new MessageServiceStub();
    createObjectUrlSpy = vi.fn(() => 'blob:logs-download');
    revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlSpy,
    });
    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    routeParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    route = {
      paramMap: routeParamMap$.asObservable(),
    } as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [LogsPage],
      providers: [
        provideTranslateTesting(),
        { provide: ConnectionsService, useValue: connections },
        { provide: ActivatedRoute, useValue: route },
        { provide: MessageService, useValue: messageService },
      ],
    })
      .overrideComponent(LogsPage, {
        set: {
          providers: [{ provide: LogsService, useValue: logs }],
        },
      })
      .compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(LogsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    anchorClickSpy.mockRestore();
  });

  it('loads the selected connection on init and auto-selects the first visible entry', async () => {
    const connection = createConnection();
    const entries = [
      createLogEntry({
        id: 'entry-older',
        blobName: 'application.log',
        createdAt: '2026-04-13T10:00:00Z',
      }),
      createLogEntry({
        id: 'entry-newer',
        blobName: 'worker.log',
        createdAt: '2026-04-13T11:00:00Z',
      }),
    ];
    setRouteConnectionId('conn-1', routeParamMap$);
    connections.getById.mockReturnValue(connection);
    logs.loadForConnection.mockImplementation(async () => {
      logs.statusState.set('success');
      logs.entriesState.set(entries);
    });

    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    expect(connections.load).toHaveBeenCalledOnce();
    expect(connections.getById).toHaveBeenCalledWith('conn-1');
    expect(logs.loadForConnection).toHaveBeenCalledWith('storage-a', 'logs');
    expect(logs.selectEntry).toHaveBeenCalledWith('entry-newer');
  });

  it('does nothing on init when no connection id is present', async () => {
    fixture.detectChanges();
    await flushAsync();

    expect(connections.load).not.toHaveBeenCalled();
    expect(logs.loadForConnection).not.toHaveBeenCalled();
  });

  it('does not load logs when the connection is incomplete', async () => {
    setRouteConnectionId('conn-1', routeParamMap$);
    connections.getById.mockReturnValue({
      ...createConnection(),
      storageAccountName: undefined,
    });

    fixture.detectChanges();
    await flushAsync();

    expect(connections.load).toHaveBeenCalledOnce();
    expect(logs.loadForConnection).not.toHaveBeenCalled();
    expect(logs.setError).toHaveBeenCalledWith('The selected storage connection is incomplete.');
  });

  it('reloads when the route connection changes and resets filters and stale content immediately', async () => {
    const secondLoad = createDeferred<void>();
    const connectionsById = new Map<string, StorageConnection>([
      ['conn-1', createConnection({ id: 'conn-1' })],
      [
        'conn-2',
        createConnection({
          id: 'conn-2',
          displayName: 'storage-a / archive',
          containerCount: 2,
          containerName: 'archive',
        }),
      ],
    ]);
    connections.statusState.set('success');
    connections.getById.mockImplementation((id) => connectionsById.get(id) ?? null);
    logs.loadForConnection.mockImplementation(async (_accountName, containerName) => {
      if (containerName === 'logs') {
        logs.statusState.set('success');
        logs.entriesState.set([
          createLogEntry({
            id: 'entry-old',
            blobName: 'alpha.log',
            createdAt: '2026-04-13T11:00:00Z',
          }),
        ]);
        return;
      }

      logs.statusState.set('loading');
      logs.entriesState.set([]);
      await secondLoad.promise;
      logs.statusState.set('success');
      logs.entriesState.set([
        createLogEntry({
          id: 'entry-new',
          container: 'archive',
          blobName: 'beta.log',
          createdAt: '2026-04-14T09:30:00Z',
          path: 'storage-a/archive/beta.log',
          containerName: 'archive',
        }),
      ]);
    });

    setRouteConnectionId('conn-1', routeParamMap$);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    logs.selectEntry('entry-old');
    logs.selectedContentState.set('old line');
    logs.selectedContentLoadedState.set(true);
    component.onSearch('alpha');
    component.onCreatedOnChange(new Date('2026-04-13T00:00:00Z'));
    component.onCreatedRangeChange([
      new Date('2026-04-13T00:00:00Z'),
      new Date('2026-04-13T00:00:00Z'),
    ]);
    component.toggleSort();
    fixture.detectChanges();

    setRouteConnectionId('conn-2', routeParamMap$);
    await flushAsync();
    fixture.detectChanges();

    expect(logs.reset).toHaveBeenCalledTimes(2);
    expect(component.searchTerm()).toBe('');
    expect(component.createdOn()).toBeNull();
    expect(component.createdRange()).toBeNull();
    expect(component.sortDir()).toBe('desc');
    expect(logs.selectedEntry()).toBeNull();
    expect(logs.selectedContent()).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('old line');

    secondLoad.resolve();
    await flushAsync();
    fixture.detectChanges();

    expect(logs.loadForConnection).toHaveBeenNthCalledWith(2, 'storage-a', 'archive');
    expect(logs.selectEntry).toHaveBeenLastCalledWith('entry-new');
  });

  it('shows an error when the route points to a missing connection', async () => {
    connections.statusState.set('success');
    connections.getById.mockReturnValue(null);
    setRouteConnectionId('missing', routeParamMap$);

    fixture.detectChanges();
    await flushAsync();

    expect(logs.loadForConnection).not.toHaveBeenCalled();
    expect(logs.setError).toHaveBeenCalledWith(
      'The selected storage connection could not be found.',
    );
  });

  it('filters, sorts, and maps toolbar data for the visible list', async () => {
    fixture.detectChanges();
    await flushAsync();

    logs.statusState.set('success');
    logs.entriesState.set([
      createLogEntry({
        id: 'entry-1',
        blobName: 'beta.log',
        size: 1024,
        createdAt: '2026-04-12T10:00:00Z',
        createdLabel: 'Yesterday, 10:00',
      }),
      createLogEntry({
        id: 'entry-2',
        blobName: 'alpha.log',
        size: 1536,
        contentType: 'text/plain',
        createdAt: '2026-04-13T09:00:00Z',
        createdLabel: 'Today, 09:00',
        createdRelative: '1 hr ago',
        path: 'storage-a/logs/alpha.log',
      }),
      createLogEntry({
        id: 'entry-3',
        blobName: 'archive.log',
        size: 2_048,
        createdAt: '2026-04-11T08:00:00Z',
        createdLabel: 'Apr 11, 2026',
      }),
    ]);
    logs.selectEntry('entry-2');
    logs.selectedContentLoadedState.set(true);
    logs.selectedContentState.set('line 1\nline 2');

    fixture.detectChanges();

    const layout = fixture.nativeElement.querySelector('section') as HTMLElement;

    expect(component.rows().map((row) => row.blobName)).toEqual([
      'alpha.log',
      'beta.log',
      'archive.log',
    ]);
    expect(layout.className).toContain('grid-cols-[var(--layout-sidebar-width)_1fr]');
    expect(component.toolbar()).toEqual({
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    });
    expect(component.footer()).toEqual({
      typeLabel: 'text/plain',
      lineCountLabel: 'Lines: 2',
      lineEndingsLabel: 'LF',
    });

    component.onSearch('beta');
    fixture.detectChanges();
    expect(component.rows().map((row) => row.blobName)).toEqual(['beta.log']);

    component.onSearch('');
    component.onCreatedOnChange(new Date('2026-04-12T00:00:00Z'));
    fixture.detectChanges();
    expect(component.rows().map((row) => row.blobName)).toEqual(['beta.log']);

    component.clearFilters();
    component.toggleSort();
    fixture.detectChanges();
    expect(component.rows().map((row) => row.blobName)).toEqual([
      'archive.log',
      'beta.log',
      'alpha.log',
    ]);
  });

  it('filters by a complete created-at range and ignores an incomplete range', async () => {
    fixture.detectChanges();
    await flushAsync();

    logs.statusState.set('success');
    logs.entriesState.set([
      createLogEntry({
        id: 'entry-1',
        blobName: 'archive.log',
        createdAt: '2026-04-11T08:00:00Z',
      }),
      createLogEntry({
        id: 'entry-2',
        blobName: 'beta.log',
        createdAt: '2026-04-12T10:00:00Z',
      }),
      createLogEntry({
        id: 'entry-3',
        blobName: 'alpha.log',
        createdAt: '2026-04-13T09:00:00Z',
      }),
    ]);

    component.onCreatedRangeChange([new Date('2026-04-12T00:00:00Z')]);
    fixture.detectChanges();
    expect(component.rows().map((row) => row.blobName)).toEqual([
      'alpha.log',
      'beta.log',
      'archive.log',
    ]);

    component.onCreatedRangeChange([
      new Date('2026-04-12T00:00:00Z'),
      new Date('2026-04-13T00:00:00Z'),
    ]);
    fixture.detectChanges();
    expect(component.rows().map((row) => row.blobName)).toEqual([
      'alpha.log',
      'beta.log',
    ]);
  });

  it('keeps only one active date filter at a time', () => {
    component.onCreatedRangeChange([
      new Date('2026-04-12T00:00:00Z'),
      new Date('2026-04-13T00:00:00Z'),
    ]);
    expect(component.createdOn()).toBeNull();
    expect(component.createdRange()).toEqual([
      new Date('2026-04-12T00:00:00Z'),
      new Date('2026-04-13T00:00:00Z'),
    ]);

    component.onCreatedOnChange(new Date('2026-04-14T00:00:00Z'));
    expect(component.createdOn()).toEqual(new Date('2026-04-14T00:00:00Z'));
    expect(component.createdRange()).toBeNull();
  });

  it('refreshes content through the logs service', () => {
    component.refresh();

    expect(logs.refreshContent).toHaveBeenCalledOnce();
  });

  it('downloads the selected log content and shows success feedback', async () => {
    logs.statusState.set('success');
    logs.entriesState.set([createLogEntry({ id: 'entry-1', blobName: 'alpha.log' })]);
    logs.selectEntry('entry-1');
    logs.selectedContentState.set('line 1\nline 2');
    logs.selectedContentLoadedState.set(true);

    await component.download();

    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(anchorClickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:logs-download');
    expect(messageService.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Download complete',
      detail: 'alpha.log downloaded',
      life: 2500,
    });
  });

  it('keeps only blob metadata in the footer when content failed to load', async () => {
    fixture.detectChanges();
    await flushAsync();

    logs.statusState.set('success');
    logs.entriesState.set([
      createLogEntry({
        id: 'entry-1',
        blobName: 'alpha.log',
        contentType: 'application/json',
      }),
    ]);
    logs.selectEntry('entry-1');
    logs.selectedContentErrorState.set('Error loading content: network failed');

    fixture.detectChanges();

    expect(component.footer()).toEqual({
      typeLabel: 'application/json',
    });
  });

  it('derives footer stats for empty, CRLF, mixed, and newline-free content', async () => {
    fixture.detectChanges();
    await flushAsync();

    logs.statusState.set('success');
    logs.entriesState.set([createLogEntry({ id: 'entry-1', contentType: 'text/plain' })]);
    logs.selectEntry('entry-1');
    logs.selectedContentLoadedState.set(true);

    logs.selectedContentState.set('');
    fixture.detectChanges();
    expect(component.footer()).toEqual({
      typeLabel: 'text/plain',
      lineCountLabel: 'Lines: 0',
      lineEndingsLabel: 'None',
    });

    logs.selectedContentState.set('line 1\r\nline 2\r\n');
    fixture.detectChanges();
    expect(component.footer()).toEqual({
      typeLabel: 'text/plain',
      lineCountLabel: 'Lines: 3',
      lineEndingsLabel: 'CRLF',
    });

    logs.selectedContentState.set('line 1\nline 2\rline 3');
    fixture.detectChanges();
    expect(component.footer()).toEqual({
      typeLabel: 'text/plain',
      lineCountLabel: 'Lines: 3',
      lineEndingsLabel: 'Mixed',
    });

    logs.selectedContentState.set('single line');
    fixture.detectChanges();
    expect(component.footer()).toEqual({
      typeLabel: 'text/plain',
      lineCountLabel: 'Lines: 1',
      lineEndingsLabel: 'None',
    });
  });

  it('renders loading, error, empty, and selected-entry states', async () => {
    fixture.detectChanges();
    await flushAsync();

    logs.statusState.set('loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading logs…');

    logs.statusState.set('error');
    logs.errorState.set('Request failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Request failed');

    logs.statusState.set('success');
    logs.entriesState.set([]);
    logs.errorState.set(null);
    logs.selectedEntryId.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No blobs found in this container.');
    expect(fixture.nativeElement.textContent).toContain('Select a log file to view its contents');

    logs.entriesState.set([createLogEntry({ id: 'entry-1', blobName: 'alpha.log' })]);
    logs.selectEntry('entry-1');
    logs.selectedContentState.set('line 1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('alpha.log');
    expect(fixture.nativeElement.textContent).toContain('line 1');
  });
});

function createConnection(overrides: Partial<StorageConnection> = {}): StorageConnection {
  return {
    id: 'conn-1',
    name: 'prod-storage',
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

function createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    container: 'logs',
    blobName: 'application.log',
    createdAt: '2026-04-13T10:30:00Z',
    createdLabel: 'Today, 10:30',
    size: 512,
    contentType: 'text/plain',
    path: 'storage-a/logs/application.log',
    createdRelative: 'just now',
    storageAccountName: 'storage-a',
    containerName: 'logs',
    ...overrides,
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function setRouteConnectionId(
  connectionId: string | null,
  routeParamMap$: BehaviorSubject<ParamMap>,
): void {
  routeParamMap$.next(
    connectionId ? convertToParamMap({ connectionId }) : convertToParamMap({}),
  );
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
