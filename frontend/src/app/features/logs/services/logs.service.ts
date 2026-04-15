import { Injectable, computed, inject, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { AppApiService } from '@app/core/services/app-api.service';
import type {
  BlobViewSearchMatch,
  BlobViewSearchResponse,
  BlobViewSessionStatus,
  BlobViewLinesResponse,
} from '@app/features/logs/models/blob-view.model';
import { SettingsService } from '@app/features/settings/services/settings.service';
import type { AzureBlobItem, AzureBlobTextChunk } from '@app/features/settings/models/azure.model';

import type { LogEntry } from '../models/log-entry.model';

type LogsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; entries: LogEntry[] }
  | { status: 'error'; message: string };

interface SelectedBlobContentState {
  entryId: string;
  chunk: AzureBlobTextChunk;
}

interface LargeViewerState {
  entryId: string;
  sessionId: string;
  status: BlobViewSessionStatus;
  linesResponse: BlobViewLinesResponse | null;
  viewportStartLine: number;
  viewportLineCount: number;
  searchQuery: string;
  searchMatches: BlobViewSearchMatch[];
  searchNextCursor: number;
  searchIsComplete: boolean;
  activeMatchIndex: number;
  requestedScrollLine: number | null;
}

const LARGE_BLOB_THRESHOLD_BYTES = 8 * 1024 * 1024;
const LARGE_VIEW_POLL_INTERVAL_MS = 700;
const DEFAULT_LINE_WINDOW_SIZE = 120;

@Injectable()
export class LogsService implements OnDestroy {
  private readonly api = inject(AppApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly settings = inject(SettingsService);

  private readonly state = signal<LogsState>({ status: 'idle' });
  private readonly selectedEntryId = signal<string | null>(null);
  private readonly selectedContentState = signal<SelectedBlobContentState | null>(null);
  private readonly selectedContentErrorState = signal<string | null>(null);
  private readonly largeViewerState = signal<LargeViewerState | null>(null);
  private readonly _contentLoading = signal(false);
  private connectionLoadToken = 0;
  private contentLoadToken = 0;
  private statusPollTimer: ReturnType<typeof setInterval> | null = null;

  readonly status = computed(() => this.state().status);

  readonly entries = computed(() => {
    const current = this.state();
    return current.status === 'success' ? current.entries : [];
  });

  readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.message : null;
  });

  readonly isEmpty = computed(
    () => this.status() === 'success' && this.entries().length === 0,
  );

  readonly selectedEntry = computed<LogEntry | null>(() => {
    const id = this.selectedEntryId();
    if (!id) {
      return null;
    }
    return this.entries().find((entry) => entry.id === id) ?? null;
  });

  readonly selectedContent = computed<string>(() => {
    if (this.largeViewerState()) {
      return '';
    }
    return this.selectedChunk()?.content ?? '';
  });

  readonly selectedContentLoaded = computed<boolean>(() => {
    if (this.largeViewerState()) {
      return false;
    }

    const selectedEntry = this.selectedEntry();
    const selectedContentState = this.selectedContentState();
    return selectedEntry !== null && selectedContentState?.entryId === selectedEntry.id;
  });

  readonly selectedContentError = computed<string | null>(() => this.selectedContentErrorState());
  readonly contentLoading = this._contentLoading.asReadonly();

  readonly contentWindow = computed(() => {
    const largeViewerState = this.largeViewerState();
    if (largeViewerState) {
      return {
        startOffset: 0,
        endOffsetExclusive: largeViewerState.status.bytesDownloaded,
        blobSize: largeViewerState.status.blobSize,
        hasOlderContent: largeViewerState.status.hasPendingBefore,
        hasNewerContent: largeViewerState.status.hasPendingAfter,
      };
    }

    const chunk = this.selectedChunk();
    if (!chunk) {
      return null;
    }
    return {
      startOffset: chunk.startOffset,
      endOffsetExclusive: chunk.endOffsetExclusive,
      blobSize: chunk.blobSize,
      hasOlderContent: chunk.truncatedStart,
      hasNewerContent: chunk.truncatedEnd,
    };
  });

  readonly blobSize = computed(() => {
    const largeViewerState = this.largeViewerState();
    if (largeViewerState) {
      return largeViewerState.status.blobSize;
    }
    return this.selectedChunk()?.blobSize ?? 0;
  });

  readonly isLargeBlob = computed(() => this.largeViewerState() !== null || (this.selectedChunk()?.isLargeBlob ?? false));
  readonly hasOlderContent = computed(() => this.contentWindow()?.hasOlderContent ?? false);
  readonly hasNewerContent = computed(() => this.contentWindow()?.hasNewerContent ?? false);

  readonly largeViewerStatus = computed(() => this.largeViewerState()?.status ?? null);
  readonly largeViewerLines = computed(() => this.largeViewerState()?.linesResponse?.lines ?? []);
  readonly largeViewerViewportStartLine = computed(() => this.largeViewerState()?.viewportStartLine ?? 0);
  readonly largeViewerViewportLineCount = computed(() => this.largeViewerState()?.viewportLineCount ?? DEFAULT_LINE_WINDOW_SIZE);
  readonly largeViewerTotalLines = computed(() => this.largeViewerState()?.linesResponse?.totalLines ?? this.largeViewerState()?.status.indexedLineCount ?? 0);
  readonly largeViewerSearchQuery = computed(() => this.largeViewerState()?.searchQuery ?? '');
  readonly largeViewerSearchMatches = computed(() => this.largeViewerState()?.searchMatches ?? []);
  readonly largeViewerSearchIsComplete = computed(() => this.largeViewerState()?.searchIsComplete ?? true);
  readonly largeViewerRequestedScrollLine = computed(() => this.largeViewerState()?.requestedScrollLine ?? null);
  readonly largeViewerActiveMatchLine = computed<number | null>(() => {
    const viewer = this.largeViewerState();
    if (!viewer || viewer.activeMatchIndex < 0 || viewer.activeMatchIndex >= viewer.searchMatches.length) {
      return null;
    }
    return viewer.searchMatches[viewer.activeMatchIndex]?.lineNumber ?? null;
  });
  readonly largeViewerTailPreviewLines = computed(() => this.largeViewerState()?.status.tailPreviewLines ?? []);
  readonly largeViewerCanEnableWordWrap = computed(() => this.largeViewerState()?.status.canEnableWordWrap ?? false);

  ngOnDestroy(): void {
    void this.closeLargeViewer();
  }

  reset(): void {
    this.connectionLoadToken += 1;
    this.contentLoadToken += 1;
    this.state.set({ status: 'idle' });
    this.selectedEntryId.set(null);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);
    void this.closeLargeViewer();
  }

  setError(message: string): void {
    this.connectionLoadToken += 1;
    this.contentLoadToken += 1;
    this.selectedEntryId.set(null);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);
    void this.closeLargeViewer();
    this.state.set({ status: 'error', message });
  }

  async loadForConnection(accountName: string, containerName: string): Promise<void> {
    const token = ++this.connectionLoadToken;
    this.contentLoadToken += 1;
    this.state.set({ status: 'loading' });
    this.selectedEntryId.set(null);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);
    await this.closeLargeViewer();

    try {
      const blobs = await this.api.listBlobs(accountName, containerName, '');
      if (token !== this.connectionLoadToken) {
        return;
      }

      const entries = blobs.map((blob) => this.mapBlobToEntry(blob, accountName, containerName));
      this.state.set({ status: 'success', entries });
    } catch (error) {
      if (token !== this.connectionLoadToken) {
        return;
      }

      this.state.set({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : this.i18n.translate('settings.service.loadBlobsFailed'),
      });
    }
  }

  selectEntry(id: string | null): void {
    this.selectedEntryId.set(id);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    void this.closeLargeViewer();

    if (!id) {
      return;
    }

    const entry = this.entries().find((item) => item.id === id);
    if (!entry) {
      return;
    }

    if (entry.size > LARGE_BLOB_THRESHOLD_BYTES) {
      void this.openLargeViewer(entry);
      return;
    }

    void this.loadContent(id);
  }

  async loadContent(id: string): Promise<void> {
    await this.loadContentChunk(id);
  }

  async refreshContent(): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry) {
      return;
    }

    if (entry.size > LARGE_BLOB_THRESHOLD_BYTES) {
      await this.openLargeViewer(entry, true);
      return;
    }

    await this.loadContentChunk(entry.id);
  }

  async updateLargeViewport(startLine: number, lineCount: number): Promise<void> {
    const viewer = this.largeViewerState();
    if (!viewer) {
      return;
    }

    const normalizedStartLine = Math.max(0, startLine);
    const normalizedLineCount = Math.max(1, lineCount);
    if (
      viewer.linesResponse &&
      viewer.viewportStartLine === normalizedStartLine &&
      viewer.viewportLineCount === normalizedLineCount &&
      !(
        viewer.linesResponse.lines.length === 0 &&
        viewer.status.indexedLineCount > 0
      )
    ) {
      return;
    }

    const response = await this.api.getBlobViewLines(
      viewer.sessionId,
      normalizedStartLine,
      normalizedLineCount,
    );

    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== viewer.sessionId) {
        return current;
      }
      return {
        ...current,
        viewportStartLine: normalizedStartLine,
        viewportLineCount: normalizedLineCount,
        linesResponse: response,
      };
    });
  }

  async updateLargeSearchQuery(query: string): Promise<void> {
    const viewer = this.largeViewerState();
    if (!viewer) {
      return;
    }

    const normalizedQuery = query.trim();
    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== viewer.sessionId) {
        return current;
      }
      return {
        ...current,
        searchQuery: query,
        searchMatches: [],
        searchNextCursor: 0,
        searchIsComplete: normalizedQuery.length === 0,
        activeMatchIndex: -1,
        requestedScrollLine: null,
      };
    });

    if (normalizedQuery.length === 0) {
      return;
    }

    await this.loadSearchPage(viewer.sessionId, normalizedQuery, 0, true);
  }

  async selectNextSearchMatch(): Promise<void> {
    await this.moveSearchMatch(1);
  }

  async selectPreviousSearchMatch(): Promise<void> {
    await this.moveSearchMatch(-1);
  }

  async exportLargeViewer(): Promise<boolean> {
    const viewer = this.largeViewerState();
    if (!viewer || !viewer.status.isComplete) {
      return false;
    }

    const result = await this.api.exportBlobViewSession(viewer.sessionId);
    return result.cancelled === false;
  }

  clearRequestedScrollLine(): void {
    this.largeViewerState.update((current) =>
      current ? { ...current, requestedScrollLine: null } : current,
    );
  }

  private async moveSearchMatch(direction: -1 | 1): Promise<void> {
    const viewer = this.largeViewerState();
    if (!viewer || viewer.searchQuery.trim().length === 0) {
      return;
    }

    let nextIndex = viewer.activeMatchIndex + direction;
    if (direction > 0 && nextIndex >= viewer.searchMatches.length && !viewer.searchIsComplete) {
      await this.loadSearchPage(viewer.sessionId, viewer.searchQuery.trim(), viewer.searchNextCursor, false);
    }

    const updatedViewer = this.largeViewerState();
    if (!updatedViewer || updatedViewer.searchMatches.length === 0) {
      return;
    }

    if (direction < 0 && nextIndex < 0) {
      nextIndex = updatedViewer.searchMatches.length - 1;
    } else if (direction > 0 && nextIndex >= updatedViewer.searchMatches.length) {
      nextIndex = 0;
    }

    const activeMatch = updatedViewer.searchMatches[nextIndex];
    if (!activeMatch) {
      return;
    }

    this.largeViewerState.update((current) =>
      current
        ? {
            ...current,
            activeMatchIndex: nextIndex,
            requestedScrollLine: activeMatch.lineNumber,
          }
        : current,
    );

    if (updatedViewer.status.tailPreviewLines.length === 0) {
      const startLine = Math.max(activeMatch.lineNumber - Math.floor(updatedViewer.viewportLineCount / 2), 0);
      await this.updateLargeViewport(startLine, updatedViewer.viewportLineCount);
    }
  }

  private async openLargeViewer(entry: LogEntry, forceReload = false): Promise<void> {
    if (!entry.storageAccountName || !entry.containerName) {
      return;
    }

    const currentViewer = this.largeViewerState();
    if (currentViewer && currentViewer.entryId === entry.id && !forceReload) {
      return;
    }

    await this.closeLargeViewer();

    const connectionLoadToken = this.connectionLoadToken;
    const contentLoadToken = ++this.contentLoadToken;
    this._contentLoading.set(true);
    this.selectedContentErrorState.set(null);

    try {
      const status = await this.api.openBlobViewSession({
        accountName: entry.storageAccountName,
        containerName: entry.containerName,
        blobName: entry.blobName,
        focus: this.settings.logs().initialLargeFileFocus,
      });

      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        void this.api.closeBlobViewSession(status.sessionId).catch(() => undefined);
        return;
      }

      const initialViewportStartLine =
        status.focus === 'end' && status.isComplete
          ? Math.max(status.indexedLineCount - DEFAULT_LINE_WINDOW_SIZE, 0)
          : 0;

      this.largeViewerState.set({
        entryId: entry.id,
        sessionId: status.sessionId,
        status,
        linesResponse: null,
        viewportStartLine: initialViewportStartLine,
        viewportLineCount: DEFAULT_LINE_WINDOW_SIZE,
        searchQuery: '',
        searchMatches: [],
        searchNextCursor: 0,
        searchIsComplete: true,
        activeMatchIndex: -1,
        requestedScrollLine: status.focus === 'end' && status.isComplete
          ? Math.max(status.indexedLineCount - 1, 0)
          : null,
      });

      this.startStatusPolling(status.sessionId);

      if (status.tailPreviewLines.length === 0 && status.indexedLineCount > 0) {
        await this.updateLargeViewport(initialViewportStartLine, DEFAULT_LINE_WINDOW_SIZE);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : this.i18n.translate('common.errors.unknownError');
      this.selectedContentErrorState.set(
        this.i18n.translate('logs.service.loadContentFailed', { message }),
      );
    } finally {
      if (
        connectionLoadToken === this.connectionLoadToken &&
        contentLoadToken === this.contentLoadToken
      ) {
        this._contentLoading.set(false);
      }
    }
  }

  private async refreshLargeViewerStatus(sessionId: string): Promise<void> {
    const status = await this.api.getBlobViewStatus(sessionId);

    let needsViewportRefresh = false;
    let nextViewportStartLine = 0;
    let nextViewportLineCount = DEFAULT_LINE_WINDOW_SIZE;

    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== sessionId) {
        return current;
      }

      needsViewportRefresh =
        current.status.indexedLineCount !== status.indexedLineCount ||
        current.status.isComplete !== status.isComplete;
      nextViewportStartLine =
        status.focus === 'end' && current.linesResponse === null && status.isComplete
          ? Math.max(status.indexedLineCount - current.viewportLineCount, 0)
          : current.viewportStartLine;
      nextViewportLineCount = current.viewportLineCount;

      return {
        ...current,
        status,
        requestedScrollLine:
          status.focus === 'end' && current.requestedScrollLine === null && status.isComplete
            ? Math.max(status.indexedLineCount - 1, 0)
            : current.requestedScrollLine,
      };
    });

    if (status.errorMessage?.trim()) {
      this.stopStatusPolling()
      return;
    }

    if (status.isComplete) {
      this.stopStatusPolling();
    }

    if (status.tailPreviewLines.length === 0 && (needsViewportRefresh || this.largeViewerLines().length === 0)) {
      await this.updateLargeViewport(nextViewportStartLine, nextViewportLineCount);
    }

    if (this.largeViewerSearchQuery().trim().length > 0) {
      await this.loadSearchPage(sessionId, this.largeViewerSearchQuery().trim(), 0, true);
    }
  }

  private startStatusPolling(sessionId: string): void {
    this.stopStatusPolling();
    this.statusPollTimer = setInterval(() => {
      void this.refreshLargeViewerStatus(sessionId);
    }, LARGE_VIEW_POLL_INTERVAL_MS);
  }

  private stopStatusPolling(): void {
    if (this.statusPollTimer !== null) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  }

  private async loadSearchPage(
    sessionId: string,
    query: string,
    cursor: number,
    replace: boolean,
  ): Promise<void> {
    const response = await this.api.searchBlobView({
      sessionId,
      query,
      cursor,
    });

    this.applySearchResponse(sessionId, response, replace);
  }

  private applySearchResponse(
    sessionId: string,
    response: BlobViewSearchResponse,
    replace: boolean,
  ): void {
    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== sessionId) {
        return current;
      }

      const matches = replace
        ? response.matches
        : [...current.searchMatches, ...response.matches];

      return {
        ...current,
        searchMatches: matches,
        searchNextCursor: response.nextCursor,
        searchIsComplete: response.isComplete,
        activeMatchIndex: matches.length > 0 ? Math.max(current.activeMatchIndex, 0) : -1,
        requestedScrollLine:
          replace && matches.length > 0
            ? matches[0]?.lineNumber ?? null
            : current.requestedScrollLine,
      };
    });
  }

  private async closeLargeViewer(): Promise<void> {
    this.stopStatusPolling();

    const viewer = this.largeViewerState();
    this.largeViewerState.set(null);
    if (viewer) {
      await this.api.closeBlobViewSession(viewer.sessionId).catch(() => undefined);
    }
  }

  private async loadContentChunk(id: string): Promise<void> {
    const entry = this.entries().find((item) => item.id === id);
    if (!entry?.storageAccountName || !entry.containerName) {
      return;
    }

    const connectionLoadToken = this.connectionLoadToken;
    const contentLoadToken = ++this.contentLoadToken;
    this._contentLoading.set(true);
    this.selectedContentErrorState.set(null);

    try {
      const chunk = await this.api.readBlobTextChunk({
        accountName: entry.storageAccountName,
        containerName: entry.containerName,
        blobName: entry.blobName,
        startOffset: null,
        count: null,
      });
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      this.selectedContentState.set({ entryId: id, chunk });
    } catch (error) {
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : this.i18n.translate('common.errors.unknownError');
      this.selectedContentState.set(null);
      this.selectedContentErrorState.set(
        this.i18n.translate('logs.service.loadContentFailed', { message }),
      );
    } finally {
      if (
        connectionLoadToken === this.connectionLoadToken &&
        contentLoadToken === this.contentLoadToken
      ) {
        this._contentLoading.set(false);
      }
    }
  }

  private selectedChunk(): AzureBlobTextChunk | null {
    return this.selectedContentState()?.chunk ?? null;
  }

  private mapBlobToEntry(blob: AzureBlobItem, accountName: string, containerName: string): LogEntry {
    return {
      id: blob.name,
      container: containerName,
      blobName: blob.name,
      timestamp: this.formatTimestamp(blob.lastModified),
      lastModified: blob.lastModified,
      size: blob.size,
      contentType: blob.contentType,
      path: `${accountName}/${containerName}/${blob.name}`,
      modifiedRelative: this.relativeTime(blob.lastModified),
      storageAccountName: accountName,
      containerName,
    };
  }

  private formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = this.i18n.formatDate(date, { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `${this.i18n.translate('common.date.today')}, ${time}`;
    }
    if (isYesterday) {
      return `${this.i18n.translate('common.date.yesterday')}, ${time}`;
    }
    return this.i18n.formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private relativeTime(iso: string): string {
    return this.i18n.formatRelativeFromNow(iso);
  }
}
