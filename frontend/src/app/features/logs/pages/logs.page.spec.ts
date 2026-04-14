import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import type { StorageConnection } from '@app/features/connections/models/storage-connection.model';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import type { LogEntry } from '@app/features/logs/models/log-entry.model';

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

  readonly loadForConnection = vi.fn<(accountName: string, containerName: string) => Promise<void>>(
    async () => undefined,
  );
  readonly loadContent = vi.fn<(id: string) => Promise<void>>(async () => undefined);
  readonly selectEntry = vi.fn<(id: string | null) => void>((id) => {
    this.selectedEntryId.set(id);
  });
  readonly refreshContent = vi.fn<() => Promise<void>>(async () => undefined);
}

class ConnectionsServiceStub implements Partial<ConnectionsService> {
  readonly load = vi.fn<() => Promise<void>>(async () => undefined);
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
    route = {
      snapshot: {
        paramMap: convertToParamMap({}),
      },
    } as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [LogsPage],
      providers: [
        { provide: LogsService, useValue: logs },
        { provide: ConnectionsService, useValue: connections },
        { provide: ActivatedRoute, useValue: route },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();

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
        lastModified: '2026-04-13T10:00:00Z',
      }),
      createLogEntry({
        id: 'entry-newer',
        blobName: 'worker.log',
        lastModified: '2026-04-13T11:00:00Z',
      }),
    ];
    route.snapshot.paramMap = convertToParamMap({ connectionId: 'conn-1' });
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
    route.snapshot.paramMap = convertToParamMap({ connectionId: 'conn-1' });
    connections.getById.mockReturnValue({
      ...createConnection(),
      storageAccountName: undefined,
    });

    fixture.detectChanges();
    await flushAsync();

    expect(connections.load).toHaveBeenCalledOnce();
    expect(logs.loadForConnection).not.toHaveBeenCalled();
  });

  it('filters, sorts, and maps toolbar data for the visible list', () => {
    logs.statusState.set('success');
    logs.entriesState.set([
      createLogEntry({
        id: 'entry-1',
        blobName: 'beta.log',
        size: 1024,
        lastModified: '2026-04-12T10:00:00Z',
        timestamp: 'Yesterday, 10:00',
      }),
      createLogEntry({
        id: 'entry-2',
        blobName: 'alpha.log',
        size: 1536,
        contentType: 'text/plain',
        lastModified: '2026-04-13T09:00:00Z',
        timestamp: 'Today, 09:00',
        modifiedRelative: '1 hr ago',
        path: 'storage-a/logs/alpha.log',
      }),
      createLogEntry({
        id: 'entry-3',
        blobName: 'archive.log',
        size: 2_048,
        lastModified: '2026-04-11T08:00:00Z',
        timestamp: 'Apr 11, 2026',
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
      modified: '1 hr ago',
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
    component.onDateFromChange(new Date('2026-04-12T00:00:00Z'));
    component.onDateUntilChange(new Date('2026-04-12T00:00:00Z'));
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

  it('keeps only blob metadata in the footer when content failed to load', () => {
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

  it('derives footer stats for empty, CRLF, mixed, and newline-free content', () => {
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

  it('renders loading, error, empty, and selected-entry states', () => {
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
    timestamp: 'Today, 10:30',
    lastModified: '2026-04-13T10:30:00Z',
    size: 512,
    contentType: 'text/plain',
    path: 'storage-a/logs/application.log',
    modifiedRelative: 'just now',
    storageAccountName: 'storage-a',
    containerName: 'logs',
    ...overrides,
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
