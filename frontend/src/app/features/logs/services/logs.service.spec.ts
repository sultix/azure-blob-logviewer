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
import type { LogLargeViewerScrollCommand } from '@app/features/logs/models/logs-view.model';
import {
  initializeI18nForTests,
  provideTranslateTesting,
} from '@app/testing/translate-testing';

import { LogsService } from './logs.service';

class AppApiServiceStub implements Partial<AppApiService> {
  listBlobs =
    vi.fn<
      (
        accountName: string,
        containerName: string,
        prefix: string,
        includeDeleted?: boolean,
      ) => Promise<AzureBlobItem[]>
    >();
  readBlobTextChunk =
    vi.fn<(request: AzureBlobTextChunkRequest) => Promise<AzureBlobTextChunk>>();
  restoreBlob =
    vi.fn<
      (request: {
        accountName: string;
        containerName: string;
        blobName: string;
      }) => Promise<void>
    >();
  openBlobViewSession =
    vi.fn<(request: OpenBlobViewSessionRequest) => Promise<BlobViewSessionStatus>>();
  getBlobViewStatus = vi.fn<(sessionId: string) => Promise<BlobViewSessionStatus>>();
  setBlobViewSessionMode =
    vi.fn<
      (sessionId: string, mode: 'snapshot' | 'live') => Promise<BlobViewSessionStatus>
    >();
  getBlobViewLines =
    vi.fn<
      (
        sessionId: string,
        startLine: number,
        lineCount: number,
      ) => Promise<BlobViewLinesResponse>
    >();
  searchBlobView =
    vi.fn<(request: BlobViewSearchRequest) => Promise<BlobViewSearchResponse>>();
  exportBlobViewSession = vi.fn<(sessionId: string) => Promise<BlobViewExportResult>>();
  closeBlobViewSession = vi.fn<(sessionId: string) => Promise<void>>(
    async () => undefined,
  );
}

const INLINE_BLOB_PREVIEW_LIMIT_BYTES = 2 * 1024 * 1024;
const LARGE_BLOB_SIZE_BYTES = INLINE_BLOB_PREVIEW_LIMIT_BYTES + 1;
const MAX_MERGED_BLOB_SIZE_BYTES = 20 * 1024 * 1024;

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
    expect(service.entries()[0].lastModified).toBe('2026-04-11T00:00:00Z');
    expect(service.entries()[0].createdLabel).toBe('Apr 11, 2026');
    expect(service.entries()[0].lastModifiedLabel).toBe('Apr 11, 2026');
    expect(service.entries()[0].createdRelative).toBeTruthy();
    expect(service.entries()[0].contentType).toBe('application/json');
    expect(service.errorMessage()).toBeNull();
    expect(api.listBlobs).toHaveBeenCalledWith('myaccount', 'logs', '', false);
  });

  it('loads and maps soft-deleted blobs when requested', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({
        name: 'deleted.log',
        deleted: true,
        deletedAt: '2026-04-13T09:00:00Z',
        remainingRetentionDays: 4,
      }),
    ]);

    await service.loadForConnection('myaccount', 'logs', true);

    expect(api.listBlobs).toHaveBeenCalledWith('myaccount', 'logs', '', true);
    expect(service.entries()[0]).toMatchObject({
      id: 'deleted.log::deleted::2026-04-13T09:00:00Z',
      blobName: 'deleted.log',
      isDeleted: true,
      deletedAt: '2026-04-13T09:00:00Z',
      remainingRetentionDays: 4,
    });
  });

  it('does not select a soft-deleted blob', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({
        name: 'deleted.log',
        deleted: true,
        deletedAt: '2026-04-13T09:00:00Z',
      }),
    ]);

    await service.loadForConnection('myaccount', 'logs', true);
    await service.updateSelection('deleted.log::deleted::2026-04-13T09:00:00Z', false);

    expect(service.selectedEntryIds()).toEqual([]);
    expect(api.readBlobTextChunk).not.toHaveBeenCalled();
  });

  it('opens the latest readable version of a deleted versioned blob', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({
        name: 'deleted.log',
        size: 1024,
        deleted: true,
        deletedAt: '',
        versionId: 'version-2',
      }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(
      createChunk({ content: 'deleted version content' }),
    );

    await service.loadForConnection('myaccount', 'logs', true);
    await service.updateSelection('deleted.log::deleted::version-2', false);

    expect(service.selectedEntry()?.versionId).toBe('version-2');
    expect(api.readBlobTextChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        blobName: 'deleted.log',
        versionId: 'version-2',
      }),
    );
  });

  it('restores a classic soft-deleted blob through the focused API', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({
        name: 'deleted.log',
        deleted: true,
        deletedAt: '2026-04-13T09:00:00Z',
      }),
    ]);
    api.restoreBlob.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs', true);
    const restored = await service.restoreDeletedEntry(
      'deleted.log::deleted::2026-04-13T09:00:00Z',
    );

    expect(restored).toBe(true);
    expect(api.restoreBlob).toHaveBeenCalledWith({
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'deleted.log',
    });
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
      lastModified: '2026-04-12T08:15:00Z',
      createdLabel: 'Apr 12, 2026',
      lastModifiedLabel: 'Apr 12, 2026',
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
    expect(service.errorMessage()).toBe('Failed to load blobs');
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

  it('refreshes the entries list without reloading the selected content', async () => {
    api.listBlobs
      .mockResolvedValueOnce([createBlob({ name: 'alpha.log', size: 1024 })])
      .mockResolvedValueOnce([createBlob({ name: 'beta.log', size: 1024 })]);
    api.readBlobTextChunk.mockResolvedValue(
      createChunk({
        content: 'alpha content',
        blobSize: 1024,
        endOffsetExclusive: 1024,
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('alpha.log', false);
    await flushAsync();

    api.readBlobTextChunk.mockClear();

    const refreshed = await service.refreshEntriesForConnection('myaccount', 'logs');

    expect(refreshed).toBe(true);
    expect(service.entries().map((entry) => entry.id)).toEqual(['beta.log']);
    expect(service.selectedEntryIds()).toEqual(['alpha.log']);
    expect(service.selectedEntry()?.id).toBe('alpha.log');
    expect(service.selectedContent()).toBe('alpha content');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(api.readBlobTextChunk).not.toHaveBeenCalled();
  });

  it('falls back to the selection snapshot when refreshed entries no longer contain the selected file', async () => {
    api.listBlobs
      .mockResolvedValueOnce([createBlob({ name: 'alpha.log', size: 1024 })])
      .mockResolvedValueOnce([createBlob({ name: 'beta.log', size: 1024 })]);
    api.readBlobTextChunk.mockResolvedValue(createChunk({ content: 'alpha content' }));

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('alpha.log', false);
    await flushAsync();

    await service.refreshEntriesForConnection('myaccount', 'logs');

    expect(service.entries().map((entry) => entry.id)).toEqual(['beta.log']);
    expect(service.selectedEntries().map((entry) => entry.id)).toEqual(['alpha.log']);
    expect(service.selectedEntry()).toMatchObject({
      id: 'alpha.log',
      blobName: 'alpha.log',
      containerName: 'logs',
      storageAccountName: 'myaccount',
    });
  });

  it('clears the preserved selection snapshot on the next full connection load', async () => {
    api.listBlobs
      .mockResolvedValueOnce([createBlob({ name: 'alpha.log', size: 1024 })])
      .mockResolvedValueOnce([createBlob({ name: 'beta.log', size: 1024 })])
      .mockResolvedValueOnce([createBlob({ name: 'gamma.log', size: 1024 })]);
    api.readBlobTextChunk.mockResolvedValue(createChunk({ content: 'alpha content' }));

    await service.loadForConnection('myaccount', 'logs');
    await service.updateSelection('alpha.log', false);
    await flushAsync();

    await service.refreshEntriesForConnection('myaccount', 'logs');
    expect(service.selectedEntry()?.id).toBe('alpha.log');

    await service.loadForConnection('myaccount', 'archive');

    expect(service.entries().map((entry) => entry.id)).toEqual(['gamma.log']);
    expect(service.selectedEntry()).toBeNull();
    expect(service.selectedEntries()).toEqual([]);
    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
  });

  it('loads a small blob fully for the selected entry', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: 1024, contentType: 'text/plain' }),
    ]);
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

  it('loads a blob below the inline limit directly in the inline viewer', async () => {
    const mediumSize = INLINE_BLOB_PREVIEW_LIMIT_BYTES - 512 * 1024;
    api.listBlobs.mockResolvedValue([
      createBlob({
        name: 'medium.log',
        size: mediumSize,
        contentType: 'text/plain',
      }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(
      createChunk({
        content: 'mid-sized log content',
        blobSize: mediumSize,
        endOffsetExclusive: mediumSize,
        contentType: 'text/plain',
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('medium.log');
    await flushAsync();

    expect(service.selectedEntry()?.id).toBe('medium.log');
    expect(service.selectedContent()).toBe('mid-sized log content');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(service.isLargeBlob()).toBe(false);
    expect(api.readBlobTextChunk).toHaveBeenCalledWith({
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'medium.log',
      startOffset: null,
      count: null,
    });
    expect(api.openBlobViewSession).not.toHaveBeenCalled();
  });

  it('loads a blob exactly at the inline limit directly in the inline viewer', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({
        name: 'limit.log',
        size: INLINE_BLOB_PREVIEW_LIMIT_BYTES,
        contentType: 'text/plain',
      }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(
      createChunk({
        content: 'limit-sized log content',
        blobSize: INLINE_BLOB_PREVIEW_LIMIT_BYTES,
        endOffsetExclusive: INLINE_BLOB_PREVIEW_LIMIT_BYTES,
        contentType: 'text/plain',
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('limit.log');
    await flushAsync();

    expect(service.selectedEntry()?.id).toBe('limit.log');
    expect(service.selectedContent()).toBe('limit-sized log content');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(service.isLargeBlob()).toBe(false);
    expect(api.readBlobTextChunk).toHaveBeenCalledWith({
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'limit.log',
      startOffset: null,
      count: null,
    });
    expect(api.openBlobViewSession).not.toHaveBeenCalled();
  });

  it('opens a large viewer session for a large blob and exposes progress flags', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        hasPendingBefore: true,
        hasPendingAfter: false,
        isComplete: false,
        livePreviewLines: ['live line 1', 'live line 2'],
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
    expect(service.largeViewerLivePreviewLines()).toEqual(['live line 1', 'live line 2']);
    expect(service.largeViewerScrollCommand()).toBeNull();
    expect(service.contentWindow()).toEqual({
      startOffset: 0,
      endOffsetExclusive: 524_288,
      blobSize: LARGE_BLOB_SIZE_BYTES,
      hasOlderContent: true,
      hasNewerContent: false,
    });
    expect(api.openBlobViewSession).toHaveBeenCalledWith({
      accountName: 'myaccount',
      containerName: 'logs',
      blobName: 'file.log',
      mode: 'snapshot',
    });
    expect(api.readBlobTextChunk).not.toHaveBeenCalled();
  });

  it('opens live mode in preview phase with follow mode enabled', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['live line 1', 'live line 2'],
      }),
    );
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        mode: 'live',
        livePreviewLines: ['live line 1', 'live line 2'],
      }),
    );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.setLiveMode(true);

    expect(service.largeViewerMode()).toBe('live');
    expect(service.largeViewerLivePhase()).toBe('preview');
    expect(service.largeViewerLiveFollowMode()).toBe('following');
    expectBottomScrollCommand(service.largeViewerScrollCommand());
    expect(api.openBlobViewSession).toHaveBeenCalledTimes(1);
    expect(api.setBlobViewSessionMode).toHaveBeenCalledWith('session-snapshot', 'live');
  });

  it('searches within live preview lines locally without calling the backend search', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['info line', 'first error line', 'second ERROR line'],
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.updateLargeSearchQuery('error');

    expect(api.searchBlobView).not.toHaveBeenCalled();
    expect(service.largeViewerSearchQuery()).toBe('error');
    expect(service.largeViewerSearchMatches()).toEqual([
      { lineNumber: 1, preview: 'first error line' },
      { lineNumber: 2, preview: 'second ERROR line' },
    ]);
    expect(service.largeViewerSearchIsComplete()).toBe(false);
    expectLineScrollCommand(service.largeViewerScrollCommand(), 1);
    expect(service.largeViewerActiveMatchLine()).toBe(1);
  });

  it('does not start large-file search before three characters', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 5_000,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines.mockResolvedValue({
      startLine: 0,
      totalLines: 5_000,
      isComplete: true,
      lines: [{ lineNumber: 0, content: 'line 1' }],
    });

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.updateLargeSearchQuery('er');

    expect(api.searchBlobView).not.toHaveBeenCalled();
    expect(service.largeViewerSearchQuery()).toBe('er');
    expect(service.largeViewerSearchMatches()).toEqual([]);
    expect(service.largeViewerScrollCommand()).toBeNull();
    expect(service.largeViewerActiveMatchLine()).toBeNull();
  });

  it('navigates live preview search matches locally', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['first error line', 'info line', 'second error line'],
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.updateLargeSearchQuery('error');

    await service.selectNextSearchMatch();

    expect(api.searchBlobView).not.toHaveBeenCalled();
    expectLineScrollCommand(service.largeViewerScrollCommand(), 2);
    expect(service.largeViewerActiveMatchLine()).toBe(2);

    await service.selectPreviousSearchMatch();

    expectLineScrollCommand(service.largeViewerScrollCommand(), 0);
    expect(service.largeViewerActiveMatchLine()).toBe(0);
  });

  it('searches through all loaded large-file search pages and jumps to the first later match', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 5_000,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines.mockResolvedValue({
      startLine: 0,
      totalLines: 5_000,
      isComplete: true,
      lines: [{ lineNumber: 0, content: 'line 1' }],
    });
    api.searchBlobView
      .mockResolvedValueOnce({
        query: 'error',
        matches: [],
        nextCursor: 2_000,
        isComplete: false,
      })
      .mockResolvedValueOnce({
        query: 'error',
        matches: [{ lineNumber: 2_500, preview: 'later error line' }],
        nextCursor: -1,
        isComplete: true,
      });

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.updateLargeSearchQuery('error');

    expect(api.searchBlobView).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      query: 'error',
      cursor: 0,
    });
    expect(api.searchBlobView).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      query: 'error',
      cursor: 2_000,
    });
    expect(service.largeViewerSearchMatches()).toEqual([
      { lineNumber: 2_500, preview: 'later error line' },
    ]);
    expect(service.largeViewerSearchIsComplete()).toBe(true);
    expectLineScrollCommand(service.largeViewerScrollCommand(), 2_500);
    expect(service.largeViewerActiveMatchLine()).toBe(2_500);
  });

  it('searches all currently loaded indexed lines for incomplete large files', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 10_000_000,
        indexedLineCount: 3_500,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines.mockResolvedValue({
      startLine: 0,
      totalLines: 3_500,
      isComplete: false,
      lines: [{ lineNumber: 0, content: 'line 1' }],
    });
    api.searchBlobView
      .mockResolvedValueOnce({
        query: 'error',
        matches: [],
        nextCursor: 2_000,
        isComplete: false,
      })
      .mockResolvedValueOnce({
        query: 'error',
        matches: [{ lineNumber: 3_100, preview: 'late indexed error line' }],
        nextCursor: 3_500,
        isComplete: false,
      })
      .mockResolvedValueOnce({
        query: 'error',
        matches: [],
        nextCursor: 3_500,
        isComplete: false,
      });

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.updateLargeSearchQuery('error');

    expect(api.searchBlobView).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      query: 'error',
      cursor: 0,
    });
    expect(api.searchBlobView).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      query: 'error',
      cursor: 2_000,
    });
    expect(service.largeViewerSearchMatches()).toEqual([
      { lineNumber: 3_100, preview: 'late indexed error line' },
    ]);
    expect(service.largeViewerSearchIsComplete()).toBe(false);
    expectLineScrollCommand(service.largeViewerScrollCommand(), 3_100);
    expect(service.largeViewerActiveMatchLine()).toBe(3_100);
  });

  it('loads a virtual line window for large blobs', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 350,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        livePreviewLines: [],
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
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 350,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        livePreviewLines: [],
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

    await service.updateLargeViewport(0, 120, false);

    expect(api.getBlobViewLines).toHaveBeenCalledTimes(2);
    expect(service.largeViewerLines()).toEqual([{ lineNumber: 0, content: 'line 1' }]);
  });

  it('keeps rendering the loaded live viewport until the next viewport response arrives', async () => {
    const initialLiveViewportStartLine = 880;
    const nextLiveViewportStartLine = 820;
    const nextViewportResponse = createDeferred<BlobViewLinesResponse>();

    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 1_000,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        livePreviewLines: [],
      }),
    );
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 1_000,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        mode: 'live',
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 1_000,
        isComplete: false,
        lines: [{ lineNumber: 0, content: 'snapshot top line' }],
      })
      .mockResolvedValueOnce({
        startLine: initialLiveViewportStartLine,
        totalLines: 1_000,
        isComplete: false,
        lines: [{ lineNumber: 999, content: 'latest live line' }],
      })
      .mockImplementationOnce(() => nextViewportResponse.promise);
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.setLiveMode(true);

    expect(service.largeViewerViewportStartLine()).toBe(initialLiveViewportStartLine);
    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 999, content: 'latest live line' },
    ]);

    const updateViewportPromise = service.updateLargeViewport(
      nextLiveViewportStartLine,
      120,
      false,
    );
    await flushAsync();

    expect(api.getBlobViewLines).toHaveBeenLastCalledWith(
      'session-snapshot',
      nextLiveViewportStartLine,
      120,
    );
    expect(service.largeViewerViewportStartLine()).toBe(initialLiveViewportStartLine);
    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 999, content: 'latest live line' },
    ]);

    nextViewportResponse.resolve({
      startLine: nextLiveViewportStartLine,
      totalLines: 1_000,
      isComplete: false,
      lines: [{ lineNumber: 940, content: 'older live line' }],
    });
    await updateViewportPromise;

    expect(service.largeViewerViewportStartLine()).toBe(nextLiveViewportStartLine);
    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 940, content: 'older live line' },
    ]);
  });

  it('recomputes live preview matches locally during status refresh', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['first error line', 'info line'],
      }),
    );
    api.getBlobViewStatus.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 1_048_576,
        indexedLineCount: 24,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['first error line', 'another ERROR line'],
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.updateLargeSearchQuery('error');

    await service['refreshLargeViewerStatus']('session-1');

    expect(api.searchBlobView).not.toHaveBeenCalled();
    expect(service.largeViewerLivePreviewLines()).toEqual([
      'first error line',
      'another ERROR line',
    ]);
    expect(service.largeViewerSearchMatches()).toEqual([
      { lineNumber: 0, preview: 'first error line' },
      { lineNumber: 1, preview: 'another ERROR line' },
    ]);
    expectLineScrollCommand(service.largeViewerScrollCommand(), 0);
  });

  it('keeps issuing a bottom scroll command during live preview refreshes while following', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['live line 1', 'live line 2'],
      }),
    );
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        mode: 'live',
        livePreviewLines: ['live line 1', 'live line 2'],
      }),
    );
    api.getBlobViewStatus.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 1_048_576,
        indexedLineCount: 24,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        mode: 'live',
        livePreviewLines: ['live line 2', 'live line 3'],
      }),
    );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.setLiveMode(true);

    expect(service.largeViewerLivePhase()).toBe('preview');
    expect(service.largeViewerLiveFollowMode()).toBe('following');
    const initialCommand = service.largeViewerScrollCommand();
    expectBottomScrollCommand(initialCommand);

    await service.refreshContent();

    expect(api.getBlobViewStatus).toHaveBeenCalledWith('session-snapshot');
    expect(service.largeViewerLivePreviewLines()).toEqual(['live line 2', 'live line 3']);
    expect(service.largeViewerLivePhase()).toBe('preview');
    expect(service.largeViewerLiveFollowMode()).toBe('following');
    const refreshedCommand = service.largeViewerScrollCommand();
    expectBottomScrollCommand(refreshedCommand);
    expect(refreshedCommand.requestId).toBeGreaterThan(initialCommand.requestId);
  });

  it('reissues a bottom scroll command after indexed live lines are reloaded while following', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 100,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        livePreviewLines: [],
      }),
    );
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 100,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        mode: 'live',
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 100,
        isComplete: false,
        lines: [{ lineNumber: 0, content: 'initial indexed line' }],
      })
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 120,
        isComplete: false,
        lines: [{ lineNumber: 0, content: 'reloaded indexed line' }],
      });
    api.getBlobViewStatus.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 120,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        mode: 'live',
        livePreviewLines: [],
      }),
    );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.setLiveMode(true);

    expect(service.largeViewerLivePhase()).toBe('indexed');
    expect(service.largeViewerLiveFollowMode()).toBe('following');
    const initialCommand = service.largeViewerScrollCommand();
    expectBottomScrollCommand(initialCommand);

    service.clearLargeViewerScrollCommand();
    expect(service.largeViewerScrollCommand()).toBeNull();

    await service['refreshLargeViewerStatus']('session-snapshot');

    expect(api.getBlobViewLines).toHaveBeenLastCalledWith('session-snapshot', 0, 120);
    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 0, content: 'reloaded indexed line' },
    ]);
    const refreshedCommand = service.largeViewerScrollCommand();
    expectBottomScrollCommand(refreshedCommand);
    expect(refreshedCommand.requestId).toBeGreaterThan(initialCommand.requestId);
  });

  it('replaces a stale top snapshot window with the bottom indexed live window after enabling live mode', async () => {
    const bottomViewportStartLine = 880;
    const bottomViewportResponse = createDeferred<BlobViewLinesResponse>();

    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 1_000,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 1_000,
        isComplete: true,
        lines: [{ lineNumber: 0, content: 'snapshot top line' }],
      })
      .mockImplementationOnce(() => bottomViewportResponse.promise);
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 1_000,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        mode: 'live',
        livePreviewLines: [],
      }),
    );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 0, content: 'snapshot top line' },
    ]);

    const livePromise = service.setLiveMode(true);
    await flushAsync();

    expect(api.getBlobViewLines).toHaveBeenLastCalledWith(
      'session-snapshot',
      bottomViewportStartLine,
      120,
    );
    expect(service.largeViewerLines()).toEqual([]);
    expectBottomScrollCommand(service.largeViewerScrollCommand());

    bottomViewportResponse.resolve({
      startLine: bottomViewportStartLine,
      totalLines: 1_000,
      isComplete: false,
      lines: [{ lineNumber: 999, content: 'latest live line' }],
    });
    await livePromise;

    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 999, content: 'latest live line' },
    ]);
    expect(service.largeViewerViewportStartLine()).toBe(bottomViewportStartLine);
  });

  it('clears stale snapshot lines before the preview-to-indexed live handoff loads the bottom window', async () => {
    const bottomViewportStartLine = 880;
    const indexedViewportResponse = createDeferred<BlobViewLinesResponse>();

    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 1_000,
        isComplete: true,
        hasPendingBefore: false,
        hasPendingAfter: false,
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines
      .mockResolvedValueOnce({
        startLine: 0,
        totalLines: 1_000,
        isComplete: true,
        lines: [{ lineNumber: 0, content: 'snapshot top line' }],
      })
      .mockImplementationOnce(() => indexedViewportResponse.promise);
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 1_000,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        mode: 'live',
        livePreviewLines: ['live line 1', 'live line 2'],
      }),
    );
    api.getBlobViewStatus.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: LARGE_BLOB_SIZE_BYTES,
        indexedLineCount: 1_000,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        mode: 'live',
        livePreviewLines: [],
      }),
    );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.setLiveMode(true);

    expect(service.largeViewerLivePhase()).toBe('preview');
    expect(service.largeViewerLivePreviewLines()).toEqual(['live line 1', 'live line 2']);

    const refreshPromise = service['refreshLargeViewerStatus']('session-snapshot');
    await flushAsync();

    expect(api.getBlobViewLines).toHaveBeenLastCalledWith(
      'session-snapshot',
      bottomViewportStartLine,
      120,
    );
    expect(service.largeViewerLivePhase()).toBe('indexed');
    expect(service.largeViewerLines()).toEqual([]);

    indexedViewportResponse.resolve({
      startLine: bottomViewportStartLine,
      totalLines: 1_000,
      isComplete: false,
      lines: [{ lineNumber: 999, content: 'indexed latest line' }],
    });
    await refreshPromise;

    expect(service.largeViewerLines()).toEqual([
      { lineNumber: 999, content: 'indexed latest line' },
    ]);
  });

  it('pauses follow mode when navigating between live preview matches', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['info line', 'first error line', 'second ERROR line'],
      }),
    );
    api.setBlobViewSessionMode.mockResolvedValueOnce(
      createSessionStatus({
        sessionId: 'session-snapshot',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        mode: 'live',
        livePreviewLines: ['info line', 'first error line', 'second ERROR line'],
      }),
    );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.setLiveMode(true);
    await service.updateLargeSearchQuery('error');

    expect(service.largeViewerLiveFollowMode()).toBe('paused-by-navigation');
    const firstCommand = service.largeViewerScrollCommand();
    expectLineScrollCommand(firstCommand, 1);

    await service.selectNextSearchMatch();
    const secondCommand = service.largeViewerScrollCommand();
    expectLineScrollCommand(secondCommand, 2);
    expect(secondCommand.requestId).toBeGreaterThan(firstCommand.requestId);

    await service.selectPreviousSearchMatch();
    const thirdCommand = service.largeViewerScrollCommand();
    expectLineScrollCommand(thirdCommand, 1);
    expect(thirdCommand.requestId).toBeGreaterThan(secondCommand.requestId);
  });

  it('switches from local live preview search to backend search after the preview phase ends', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 524_288,
        indexedLineCount: 12,
        isComplete: false,
        hasPendingBefore: true,
        hasPendingAfter: false,
        livePreviewLines: ['live error line'],
      }),
    );
    api.getBlobViewStatus.mockResolvedValue(
      createSessionStatus({
        sessionId: 'session-1',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        bytesDownloaded: 2_097_152,
        indexedLineCount: 120,
        isComplete: false,
        hasPendingBefore: false,
        hasPendingAfter: true,
        livePreviewLines: [],
      }),
    );
    api.getBlobViewLines.mockResolvedValue({
      startLine: 0,
      totalLines: 120,
      isComplete: false,
      lines: [{ lineNumber: 0, content: 'first indexed line' }],
    });
    api.searchBlobView
      .mockResolvedValue({
        query: 'error',
        matches: [{ lineNumber: 42, preview: 'indexed error line' }],
        nextCursor: 120,
        isComplete: false,
      })
      .mockResolvedValueOnce({
        query: 'error',
        matches: [],
        nextCursor: 120,
        isComplete: false,
      });

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();
    await service.updateLargeSearchQuery('error');

    api.searchBlobView.mockClear();

    await service['refreshLargeViewerStatus']('session-1');

    expect(api.getBlobViewLines).toHaveBeenCalledWith('session-1', 0, 120);
    expect(api.searchBlobView).toHaveBeenCalledWith({
      sessionId: 'session-1',
      query: 'error',
      cursor: 0,
    });
    expect(service.largeViewerSearchMatches()).toEqual([
      { lineNumber: 42, preview: 'indexed error line' },
    ]);
    expectLineScrollCommand(service.largeViewerScrollCommand(), 42);
  });

  it('refreshes large blobs by reopening the viewer session', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession
      .mockResolvedValueOnce(
        createSessionStatus({
          sessionId: 'session-1',
          blobName: 'file.log',
          blobSize: LARGE_BLOB_SIZE_BYTES,
          bytesDownloaded: 524_288,
          indexedLineCount: 10,
          isComplete: false,
          hasPendingBefore: true,
          hasPendingAfter: false,
          livePreviewLines: ['live'],
        }),
      )
      .mockResolvedValueOnce(
        createSessionStatus({
          sessionId: 'session-2',
          blobName: 'file.log',
          blobSize: LARGE_BLOB_SIZE_BYTES,
          bytesDownloaded: 1_048_576,
          indexedLineCount: 24,
          isComplete: false,
          hasPendingBefore: true,
          hasPendingAfter: false,
          livePreviewLines: ['live refreshed'],
        }),
      );
    api.closeBlobViewSession.mockResolvedValue(undefined);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    await service.refreshContent();

    expect(service.selectedContent()).toBe('');
    expect(service.largeViewerStatus()?.sessionId).toBe('session-2');
    expect(service.largeViewerLivePreviewLines()).toEqual(['live refreshed']);
    expect(service.largeViewerScrollCommand()).toBeNull();
    expect(api.openBlobViewSession).toHaveBeenCalledTimes(2);
    expect(api.closeBlobViewSession).toHaveBeenCalledWith('session-1');
  });

  it('tracks content loading errors separately from the rendered content', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: 1024, contentType: 'text/plain' }),
    ]);
    api.readBlobTextChunk.mockRejectedValue(new Error('network failed'));

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.selectedContentError()).toBe('Error loading content.');
  });

  it('maps blob preview failure reasons to localized content errors', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: 1024, contentType: 'text/plain' }),
    ]);
    api.readBlobTextChunk.mockResolvedValue(
      createChunk({
        failureReason: 'access_denied',
        errorMessage: 'Access to the requested blob was denied.',
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.selectedContentError()).toBe(
      'Access to the requested blob was denied.',
    );
  });

  it('maps large-view session failure reasons to localized content errors', async () => {
    api.listBlobs.mockResolvedValue([
      createBlob({ name: 'file.log', size: LARGE_BLOB_SIZE_BYTES }),
    ]);
    api.openBlobViewSession.mockResolvedValue(
      createSessionStatus({
        sessionId: '',
        blobName: 'file.log',
        blobSize: LARGE_BLOB_SIZE_BYTES,
        failureReason: 'limit_exceeded',
        errorMessage: "The request exceeds the application's safety limits.",
      }),
    );

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await flushAsync();

    expect(service.largeViewerStatus()).toBeNull();
    expect(service.selectedContentError()).toBe(
      "The request exceeds the application's safety limits.",
    );
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
        isLargeBlob: (request.count ?? 0) > INLINE_BLOB_PREVIEW_LIMIT_BYTES,
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
      maxSizeBytes: MAX_MERGED_BLOB_SIZE_BYTES,
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

    api.listBlobs.mockResolvedValueOnce([sharedBlob]).mockResolvedValueOnce([sharedBlob]);
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
    deleted: false,
    deletedAt: '',
    remainingRetentionDays: 0,
    ...overrides,
  };
}

function expectBottomScrollCommand(
  command: LogLargeViewerScrollCommand | null,
): asserts command is Extract<LogLargeViewerScrollCommand, { kind: 'bottom' }> {
  expect(command).toEqual(
    expect.objectContaining({
      kind: 'bottom',
      requestId: expect.any(Number),
    }),
  );
}

function expectLineScrollCommand(
  command: LogLargeViewerScrollCommand | null,
  lineNumber: number,
): asserts command is Extract<LogLargeViewerScrollCommand, { kind: 'line' }> {
  expect(command).toEqual(
    expect.objectContaining({
      kind: 'line',
      lineNumber,
      requestId: expect.any(Number),
    }),
  );
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
    hasPendingBefore: false,
    hasPendingAfter: false,
    mode: 'snapshot',
    focus: 'start',
    livePreviewLines: [],
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
