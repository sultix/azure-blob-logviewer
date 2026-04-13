import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  readonly loadForConnection = vi.fn<(accountName: string, containerName: string) => Promise<void>>(
    async () => undefined,
  );
  readonly selectEntry = vi.fn<(id: string | null) => void>((id) => {
    this.selectedEntryId.set(id);
  });
  readonly refreshContent = vi.fn<() => Promise<void>>(async () => undefined);
}

class ConnectionsServiceStub implements Partial<ConnectionsService> {
  readonly load = vi.fn<() => Promise<void>>(async () => undefined);
  readonly getById = vi.fn<(id: string) => StorageConnection | null>(() => null);
}

describe('LogsPage', () => {
  let fixture: ComponentFixture<LogsPage>;
  let component: LogsPage;
  let logs: LogsServiceStub;
  let connections: ConnectionsServiceStub;
  let route: ActivatedRoute;
  let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

  beforeEach(async () => {
    logs = new LogsServiceStub();
    connections = new ConnectionsServiceStub();
    route = {
      snapshot: {
        paramMap: convertToParamMap({}),
      },
    } as ActivatedRoute;
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    await TestBed.configureTestingModule({
      imports: [LogsPage],
      providers: [
        { provide: LogsService, useValue: logs },
        { provide: ConnectionsService, useValue: connections },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LogsPage);
    component = fixture.componentInstance;
  });

  it('loads the selected connection on init and auto-selects the first entry', async () => {
    const connection = createConnection();
    const entries = [
      createLogEntry({
        id: 'entry-1',
        blobName: 'application.log',
        lastModified: '2026-04-13T11:00:00Z',
      }),
      createLogEntry({
        id: 'entry-2',
        blobName: 'worker.log',
        lastModified: '2026-04-13T10:00:00Z',
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
    expect(logs.selectEntry).toHaveBeenCalledWith('entry-1');
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

    fixture.detectChanges();

    expect(component.rows().map((row) => row.blobName)).toEqual([
      'alpha.log',
      'beta.log',
      'archive.log',
    ]);
    expect(component.toolbar()).toEqual({
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      modified: '1 hr ago',
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

  it('copies content and resets the feedback label after the timeout', async () => {
    vi.useFakeTimers();
    logs.statusState.set('success');
    logs.entriesState.set([createLogEntry({ id: 'entry-1', blobName: 'alpha.log' })]);
    logs.selectEntry('entry-1');
    logs.selectedContentState.set('line 1\nline 2');
    fixture.detectChanges();

    await component.copyContent();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('line 1\nline 2');
    expect(component.copyFeedback()).toBe('copied');
    expect(fixture.nativeElement.textContent).toContain('Copied');

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();

    expect(component.copyFeedback()).toBe('idle');
    expect(fixture.nativeElement.textContent).toContain('Copy');
    vi.useRealTimers();
  });

  it('keeps the copy feedback idle when clipboard writing fails', async () => {
    writeText.mockRejectedValue(new Error('clipboard failed'));
    logs.selectedContentState.set('line 1');

    await component.copyContent();

    expect(component.copyFeedback()).toBe('idle');
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
