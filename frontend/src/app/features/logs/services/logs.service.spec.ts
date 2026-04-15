import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppApiService } from '@app/core/services/app-api.service';
import type {
  BlobViewExportResult,
  BlobViewLinesResponse,
  BlobViewSearchRequest,
  BlobViewSearchResponse,
  BlobViewSessionStatus,
  OpenBlobViewSessionRequest,
} from '@app/features/logs/models/blob-view.model';
import type {
  AzureBlobItem,
  AzureBlobTextChunk,
  AzureBlobTextChunkRequest,
} from '@app/features/settings/models/azure.model';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { LogsService } from './logs.service';

class AppApiServiceStub implements Partial<AppApiService> {
  listBlobs = vi.fn<() => Promise<AzureBlobItem[]>>();
  readBlobTextChunk = vi.fn<(request: AzureBlobTextChunkRequest) => Promise<AzureBlobTextChunk>>();
  openBlobViewSession = vi.fn<
    (request: OpenBlobViewSessionRequest) => Promise<BlobViewSessionStatus>
  >();
  getBlobViewStatus = vi.fn<(sessionId: string) => Promise<BlobViewSessionStatus>>();
  getBlobViewLines = vi.fn<
    (sessionId: string, startLine: number, lineCount: number) => Promise<BlobViewLinesResponse>
  >();
  searchBlobView = vi.fn<(request: BlobViewSearchRequest) => Promise<BlobViewSearchResponse>>();
  exportBlobViewSession = vi.fn<(sessionId: string) => Promise<BlobViewExportResult>>();
  closeBlobViewSession = vi.fn<(sessionId: string) => Promise<void>>(async () => undefined);
}

describe('LogsService', () => {
  let service: LogsService;
  let api: AppApiServiceStub;

  beforeEach(async () => {
    api = new AppApiServiceStub();
    await TestBed.configureTestingModule({
      providers: [
        provideTranslateTesting(),
        LogsService,
        { provide: AppApiService, useValue: api },
      ],
    }).compileComponents();
    await initializeI18nForTests();
    service = TestBed.inject(LogsService);
  });

  it('starts in the idle state', () => {
    expect(service.status()).toBe('idle');
    expect(service.entries()).toEqual([]);
    expect(service.selectedEntry()).toBeNull();
    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.selectedContentError()).toBeNull();
    expect(service.contentWindow()).toBeNull();
    expect(service.isLargeBlob()).toBe(false);
  });

  it('transitions to success and exposes the loaded entries', async () => {
    api.listBlobs.mockResolvedValue([createBlob()]);

    await service.loadForConnection('myaccount', 'logs');

    expect(service.status()).toBe('success');
    expect(service.entries().length).toBe(1);
    expect(service.entries()[0].blobName).toBe('2026/04/11/log.json');
    expect(service.entries()[0].createdAt).toBe('2026-04-11T00:00:00Z');
    expect(service.entries()[0].createdLabel).toBe('Apr 11, 2026');
    expect(service.entries()[0].createdRelative).toBeTruthy();
    expect(service.entries()[0].contentType).toBe('application/json');
    expect(service.errorMessage()).toBeNull();
  });

  it('falls back to lastModified when createdAt is missing', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({
        createdAt: '',
        lastModified: '2026-04-12T08:15:00Z',
      }),
    ]);

    await service.loadForConnection('myaccount', 'logs');

    expect(service.entries()[0]).toMatchObject({
      createdAt: '2026-04-12T08:15:00Z',
      createdLabel: 'Apr 12, 2026',
    });
    expect(service.entries()[0].createdRelative).toBeTruthy();
  });

  it('sets empty entries when the api returns an empty list', async () => {
    api.listBlobs.mockResolvedValue([]);

    await service.loadForConnection('myaccount', 'logs');

    expect(service.status()).toBe('success');
    expect(service.entries()).toEqual([]);
  });

  it('captures an error message when the api fails', async () => {
    api.listBlobs.mockRejectedValue(new Error('boom'));

    await service.loadForConnection('myaccount', 'logs');

    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('boom');
  });

  it('ignores a stale blob list response from a previous connection load', async () => {
    const firstLoad = createDeferred<AzureBlobItem[]>();
    const secondLoad = createDeferred<AzureBlobItem[]>();
    api.listBlobs
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);

    const firstPromise = service.loadForConnection('myaccount', 'logs');
    const secondPromise = service.loadForConnection('myaccount', 'archive');

    secondLoad.resolve([
      createBlob({
        name: 'archive.log',
        createdAt: '2026-04-12T00:00:00Z',
        lastModified: '2026-04-12T00:00:00Z',
      }),
    ]);
    await secondPromise;

    firstLoad.resolve([createBlob({ name: 'stale.log' })]);
    await firstPromise;

    expect(service.status()).toBe('success');
    expect(service.entries()).toHaveLength(1);
    expect(service.entries()[0].blobName).toBe('archive.log');
    expect(service.entries()[0].containerName).toBe('archive');
  });

  it('loads a small blob fully for the selected entry', async () => {
    api.listBlobs.mockResolvedValue([createBlob({ name: 'file.log', size: 1024, contentType: 'text/plain' })]);
    api.readBlobTextChunk.mockResolvedValue(
      createChunk({
        content: 'log line 1\nlog line 2',
        blobSize: 1024,
        endOffsetExclusive: 1024,
        contentType: 'text/plain',
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.selectedEntry()?.id).toBe('file.log');
    expect(service.selectedContent()).toBe('log line 1\nlog line 2');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(service.selectedContentError()).toBeNull();
    expect(service.isLargeBlob()).toBe(false);
    expect(service.contentWindow()).toEqual({
      startOffset: 0,
      endOffsetExclusive: 1024,
      blobSize: 1024,
      hasOlderContent: false,
      hasNewerContent: false,
    });
  });

  it('opens a large viewer session for a large blob and exposes progress flags', async () => {
    api.listBlobs.mockResolvedValue([createBlob({ name: 'file.log', size: 20_000_000 })]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: 20_000_000,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        hasPendingBefore: true,
        hasPendingAfter: false,
        isComplete: false,
        tailPreviewLines: ['tail line 1', 'tail line 2'],
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.isLargeBlob()).toBe(true);
    expect(service.hasOlderContent()).toBe(true);
    expect(service.hasNewerContent()).toBe(false);
    expect(service.largeViewerStatus()?.sessionId).toBe('session-1');
    expect(service.largeViewerTailPreviewLines()).toEqual(['tail line 1', 'tail line 2']);
    expect(service.contentWindow()).toEqual({
      startOffset: 0,
      endOffsetExclusive: 524_288,
      blobSize: 20_000_000,
      hasOlderContent: true,
      hasNewerContent: false,
    });
    expect(api.openBlobViewSession).toHaveBeenCalledWith({
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'file.log',
      focus: 'start',
    });
    expect(api.readBlobTextChunk).not.toHaveBeenCalled();
  });

  it('loads a virtual line window for large blobs', async () => {
    api.listBlobs.mockResolvedValue([createBlob({ name: 'file.log', size: 20_000_000 })]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: 20_000_000,
        bytesDownloaded: 20_000_000,
        indexedLineCount: 350,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        tailPreviewLines: [],
      }),
    );
    api.getBlobViewLines.mockResolvedValue({
      startLine: 0,
      totalLines: 350,
      isComplete: true,
      lines: [
        { lineNumber: 0, content: 'line 1' },
        { lineNumber: 1, content: 'line 2' },
      ],
    });

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(api.getBlobViewLines).toHaveBeenCalledWith('session-1', 0, 120);
    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 0, content: 'line 1' },
      { lineNumber: 1, content: 'line 2' },
    ]);
    expect(service.largeViewerTotalLines()).toBe(350);
  });

  it('retries the same large-file viewport when the previous response was empty but lines are now indexed', async () => {
    api.listBlobs.mockResolvedValue([createBlob({ name: 'file.log', size: 20_000_000 })]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: 20_000_000,
        bytesDownloaded: 20_000_000,
        indexedLineCount: 350,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        tailPreviewLines: [],
      }),
    );
    api.getBlobViewLines
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 350,
        isComplete: true,
        lines: [],
      })
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 350,
        isComplete: true,
        lines: [{ lineNumber: 0, content: 'line 1' }],
      });

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.largeViewerLines()).toEqual([]);

    await service.updateLargeViewport(0, 120);

    expect(api.getBlobViewLines).toHaveBeenCalledTimes(2);
    expect(service.largeViewerLines()).toEqual([{ lineNumber: 0, content: 'line 1' }]);
  });

  it('refreshes large blobs by reopening the viewer session', async () => {
    api.listBlobs.mockResolvedValue([createBlob({ name: 'file.log', size: 20_000_000 })]);
    api.openBlobViewSession
      .mockResolvedValueOnce(
        createSessionStatus({
          sessionId: 'session-1',
          blobName: 'file.log',
          blobSize: 20_000_000,
          bytesDownloaded: 524_288,
          indexedLineCount: 10,
          isComplete: false,
          hasPendingBefore: true,
          hasPendingAfter: false,
          tailPreviewLines: ['tail'],
        }),
      )
      .mockResolvedValueOnce(
        createSessionStatus({
          sessionId: 'session-2',
          blobName: 'file.log',
          blobSize: 20_000_000,
          bytesDownloaded: 1_048_576,
          indexedLineCount: 24,
          isComplete: false,
          hasPendingBefore: true,
          hasPendingAfter: false,
          tailPreviewLines: ['tail refreshed'],
        }),
      );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.refreshContent();

    expect(service.selectedContent()).toBe('');
    expect(service.largeViewerStatus()?.sessionId).toBe('session-2');
    expect(service.largeViewerTailPreviewLines()).toEqual(['tail refreshed']);
    expect(api.openBlobViewSession).toHaveBeenCalledTimes(2);
    expect(api.closeBlobViewSession).toHaveBeenCalledWith('session-1');
  });

  it('tracks content loading errors separately from the rendered content', async () => {
    api.listBlobs.mockResolvedValue([createBlob({ name: 'file.log', size: 1024, contentType: 'text/plain' })]);
    api.readBlobTextChunk.mockRejectedValue(new Error('network failed'));

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.selectedContentError()).toBe('Error loading content: network failed');
  });

  it('merges selected files in click order and reads their full content', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'alpha.log', size: 1024 }),
      createBlob({ name: 'beta.log', size: 10 * 1024 * 1024 }),
    ]);
    api.readBlobTextChunk.mockImplementation(async (request) =>
      createChunk({
        content: request.blobName === 'alpha.log' ? 'alpha line' : 'beta line',
        blobSize: request.count ?? 42,
        endOffsetExclusive: request.count ?? 42,
        isLargeBlob: (request.count ?? 0) > 8 * 1024 * 1024,
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('beta.log', false);
    await flushAsync();

    api.readBlobTextChunk.mockClear();

    await service.updateSelection('alpha.log', true);
    await flushAsync();

    expect(service.selectedEntryIds()).toEqual(['beta.log', 'alpha.log']);
    expect(service.contentMode()).toBe('merged');
    expect(service.selectedContent()).toBe(
      '------------ START beta.log ------------\n' +
        'beta line\n' +
        '------------ END beta.log ------------\n' +
        '------------ START alpha.log ------------\n' +
        'alpha line\n' +
        '------------ END alpha.log ------------',
    );
    expect(api.readBlobTextChunk).toHaveBeenNthCalledWith(1, {
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'beta.log',
      startOffset: 0,
      count: 10 * 1024 * 1024,
    });
    expect(api.readBlobTextChunk).toHaveBeenNthCalledWith(2, {
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'alpha.log',
      startOffset: 0,
      count: 1024,
    });
  });

  it('rejects a sixth selected file and keeps the previous selection', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'one.log', size: 1024 }),
      createBlob({ name: 'two.log', size: 1024 }),
      createBlob({ name: 'three.log', size: 1024 }),
      createBlob({ name: 'four.log', size: 1024 }),
      createBlob({ name: 'five.log', size: 1024 }),
      createBlob({ name: 'six.log', size: 1024 }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(createChunk());

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('one.log', false);
    await service.updateSelection('two.log', true);
    await service.updateSelection('three.log', true);
    await service.updateSelection('four.log', true);
    await service.updateSelection('five.log', true);

    const result = await service.updateSelection('six.log', true);

    expect(result).toEqual({ kind: 'selection-limit', maxFiles: 5 });
    expect(service.selectedEntryIds()).toEqual([
      'one.log',
      'two.log',
      'three.log',
      'four.log',
      'five.log',
    ]);
  });

  it('rejects adding a file larger than 20 MB to a merged selection', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'small.log', size: 1024 }),
      createBlob({ name: 'huge.log', size: 21 * 1024 * 1024 }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(createChunk());

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('small.log', false);

    const result = await service.updateSelection('huge.log', true);

    expect(result).toEqual({
      kind: 'file-too-large',
      fileName: 'huge.log',
      maxSizeBytes: 20 * 1024 * 1024,
    });
    expect(service.selectedEntryIds()).toEqual(['small.log']);
  });

  it('falls back to single-file mode when a merged selection is reduced to one file', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'alpha.log', size: 1024 }),
      createBlob({ name: 'beta.log', size: 1024 }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(createChunk({ content: 'single content' }));

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('alpha.log', false);
    await service.updateSelection('beta.log', true);
    await flushAsync();

    api.readBlobTextChunk.mockClear();

    await service.updateSelection('beta.log', true);
    await flushAsync();

    expect(service.contentMode()).toBe('single');
    expect(service.selectedEntryIds()).toEqual(['alpha.log']);
    expect(service.selectedEntry()?.id).toBe('alpha.log');
    expect(api.readBlobTextChunk).toHaveBeenCalledWith({
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'alpha.log',
      startOffset: null,
      count: null,
    });
  });

  it('ignores stale content responses from the previous connection and keeps loading active for the current selection', async () => {
    const sharedBlob = createBlob({
      name: 'shared.log',
      size: 1024,
      contentType: 'text/plain',
    });
    const previousContent = createDeferred<AzureBlobTextChunk>();
    const currentContent = createDeferred<AzureBlobTextChunk>();

    api.listBlobs
      .mockResolvedValueOnce([sharedBlob])
      .mockResolvedValueOnce([sharedBlob]);
    api.readBlobTextChunk
      .mockImplementationOnce(() => previousContent.promise)
      .mockImplementationOnce(() => currentContent.promise);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('shared.log');
    await flushAsync();

    await service.loadForConnection('myaccount', 'archive');
    service.selectEntry('shared.log');
    await flushAsync();

    previousContent.resolve(createChunk({ content: 'stale content' }));
    await flushAsync();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.contentLoading()).toBe(true);

    currentContent.resolve(createChunk({ content: 'fresh content' }));
    await flushAsync();

    expect(service.selectedEntry()?.containerName).toBe('archive');
    expect(service.selectedContent()).toBe('fresh content');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(service.contentLoading()).toBe(false);
  });
});

function createBlob(overrides: Partial<AzureBlobItem> = {}): AzureBlobItem {
  return {
    name: '2026/04/11/log.json',
    size: 42,
    contentType: 'application/json',
    createdAt: '2026-04-11T00:00:00Z',
    lastModified: '2026-04-11T00:00:00Z',
    blobType: 'BlockBlob',
    ...overrides,
  };
}

function createChunk(overrides: Partial<AzureBlobTextChunk> = {}): AzureBlobTextChunk {
  return {
    content: 'content',
    blobSize: 42,
    contentType: 'text/plain',
    etag: '"etag-1"',
    lastModified: '2026-04-11T00:00:00Z',
    startOffset: 0,
    endOffsetExclusive: 42,
    truncatedStart: false,
    truncatedEnd: false,
    isLargeBlob: false,
    ...overrides,
  };
}

function createSessionStatus(
  overrides: Partial<BlobViewSessionStatus> = {},
): BlobViewSessionStatus {
  return {
    sessionId: 'session-1',
    blobName: 'file.log',
    blobSize: 42,
    contentType: 'text/plain',
    bytesDownloaded: 42,
    indexedLineCount: 1,
    indexedThrough: 42,
    isComplete: true,
    canEnableWordWrap: true,
    hasPendingBefore: false,
    hasPendingAfter: false,
    focus: 'start',
    tailPreviewLines: [],
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

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
