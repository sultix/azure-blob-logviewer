import { Injectable, computed, inject, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { getBlobFailureMessage } from '@app/core/services/app-error-messages';
import { AppApiService } from '@app/core/services/app-api.service';
import type {
  BlobViewMode,
  BlobViewSearchMatch,
  BlobViewSearchResponse,
  BlobViewSessionStatus,
  BlobViewLinesResponse,
} from '@app/features/logs/models/blob-view.model';
import type {
  LogContentMode,
  LogLargeViewerScrollCommand,
} from '@app/features/logs/models/logs-view.model';
import { SettingsService } from '@app/features/settings/services/settings.service';
import type {
  AzureBlobItem,
  AzureBlobTextChunk,
} from '@app/features/settings/models/azure.model';

import type { LogEntry } from '../models/log-entry.model';

type LogsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; entries: LogEntry[] }
  | { status: 'error'; message: string };

interface SingleBlobContentState {
  mode: 'single';
  entryIds: [string];
  chunk: AzureBlobTextChunk;
}

interface MergedBlobContentState {
  mode: 'merged';
  entryIds: string[];
  content: string;
  totalSize: number;
}

type SelectedBlobContentState = SingleBlobContentState | MergedBlobContentState;

interface LargeViewerState {
  entryId: string;
  sessionId: string;
  mode: BlobViewMode;
  status: BlobViewSessionStatus;
  linesResponse: BlobViewLinesResponse | null;
  viewportStartLine: number;
  viewportLineCount: number;
  loadedViewportStartLine: number | null;
  loadedViewportLineCount: number | null;
  searchQuery: string;
  searchMatches: BlobViewSearchMatch[];
  searchNextCursor: number;
  searchIsComplete: boolean;
  activeMatchIndex: number;
  scrollCommand: LogLargeViewerScrollCommand | null;
  livePhase: LivePhase | null;
  liveFollowMode: LiveFollowMode | null;
}

type LivePhase = 'preview' | 'indexed';
type LiveFollowMode = 'following' | 'paused-by-user' | 'paused-by-navigation';

// Above this size a blob is served by the virtualized session viewer instead of
// being rendered into a single element: inline content costs a full escape pass
// and a DOM node per line, which stops being affordable well before the size
// the backend is willing to stream.
const INLINE_BLOB_PREVIEW_LIMIT_BYTES = 2 * 1024 * 1024;
const MAX_MERGED_BLOB_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_MERGED_SELECTION_COUNT = 5;
const SNAPSHOT_VIEW_POLL_INTERVAL_MS = 700;
const DEFAULT_LINE_WINDOW_SIZE = 120;
const MIN_SEARCH_QUERY_LENGTH = 3;

export type LogSelectionUpdateResult =
  | { kind: 'updated' }
  | { kind: 'selection-limit'; maxFiles: number }
  | { kind: 'file-too-large'; fileName: string; maxSizeBytes: number };

@Injectable()
export class LogsService implements OnDestroy {
  private readonly api = inject(AppApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly settings = inject(SettingsService);

  private readonly state = signal<LogsState>({ status: 'idle' });
  private readonly selectedEntryIdsState = signal<string[]>([]);
  private readonly selectedEntriesSnapshotState = signal<LogEntry[]>([]);
  private readonly selectedContentState = signal<SelectedBlobContentState | null>(null);
  private readonly selectedContentErrorState = signal<string | null>(null);
  private readonly largeViewerState = signal<LargeViewerState | null>(null);
  private readonly _contentLoading = signal(false);
  private connectionLoadToken = 0;
  private contentLoadToken = 0;
  private entriesRefreshToken = 0;
  private nextLargeViewerScrollCommandId = 0;
  private viewportRequestToken = 0;
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

  readonly selectedEntryIds = this.selectedEntryIdsState.asReadonly();
  readonly selectedEntries = computed<LogEntry[]>(() =>
    this.resolveEntriesForIds(this.selectedEntryIdsState()),
  );
  readonly selectionCount = computed(() => this.selectedEntryIdsState().length);
  readonly contentMode = computed<LogContentMode>(() => {
    const selectionCount = this.selectionCount();
    if (selectionCount === 0) {
      return 'none';
    }

    return selectionCount === 1 ? 'single' : 'merged';
  });
  readonly selectedEntry = computed<LogEntry | null>(() => {
    const selectedEntries = this.selectedEntries();
    if (selectedEntries.length !== 1) {
      return null;
    }

    return selectedEntries[0] ?? null;
  });

  readonly selectedContent = computed<string>(() => {
    if (this.largeViewerState()) {
      return '';
    }

    const selectedContentState = this.selectedContentState();
    if (!selectedContentState) {
      return '';
    }

    return selectedContentState.mode === 'single'
      ? selectedContentState.chunk.content
      : selectedContentState.content;
  });

  readonly selectedContentLoaded = computed<boolean>(() => {
    if (this.largeViewerState()) {
      return false;
    }

    const selectedContentState = this.selectedContentState();
    return (
      selectedContentState !== null &&
      areSelectionsEqual(selectedContentState.entryIds, this.selectedEntryIdsState())
    );
  });

  readonly selectedContentError = computed<string | null>(() =>
    this.selectedContentErrorState(),
  );
  readonly contentLoading = this._contentLoading.asReadonly();

  readonly contentWindow = computed(() => {
    const largeViewerState = this.largeViewerState();
    if (largeViewerState) {
      const startOffset =
        largeViewerState.mode === 'live'
          ? Math.max(
              largeViewerState.status.blobSize - largeViewerState.status.bytesDownloaded,
              0,
            )
          : 0;
      return {
        startOffset,
        endOffsetExclusive:
          largeViewerState.mode === 'live'
            ? largeViewerState.status.blobSize
            : largeViewerState.status.bytesDownloaded,
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

    const selectedContentState = this.selectedContentState();
    if (selectedContentState?.mode === 'merged') {
      return selectedContentState.totalSize;
    }

    return this.selectedChunk()?.blobSize ?? 0;
  });

  readonly isLargeBlob = computed(
    () =>
      this.largeViewerState() !== null || (this.selectedChunk()?.isLargeBlob ?? false),
  );
  readonly hasOlderContent = computed(
    () => this.contentWindow()?.hasOlderContent ?? false,
  );
  readonly hasNewerContent = computed(
    () => this.contentWindow()?.hasNewerContent ?? false,
  );

  readonly largeViewerStatus = computed(() => this.largeViewerState()?.status ?? null);
  readonly largeViewerMode = computed<BlobViewMode | null>(
    () => this.largeViewerState()?.mode ?? null,
  );
  readonly largeViewerLines = computed(
    () => this.largeViewerState()?.linesResponse?.lines ?? [],
  );
  readonly largeViewerViewportStartLine = computed(() => {
    const viewer = this.largeViewerState();
    if (!viewer) {
      return 0;
    }

    if (viewer.linesResponse) {
      return viewer.loadedViewportStartLine ?? viewer.viewportStartLine;
    }

    return viewer.viewportStartLine;
  });
  readonly largeViewerViewportLineCount = computed(() => {
    const viewer = this.largeViewerState();
    if (!viewer) {
      return DEFAULT_LINE_WINDOW_SIZE;
    }

    if (viewer.linesResponse) {
      return viewer.loadedViewportLineCount ?? viewer.viewportLineCount;
    }

    return viewer.viewportLineCount;
  });
  readonly largeViewerTotalLines = computed(
    () =>
      this.largeViewerState()?.linesResponse?.totalLines ??
      this.largeViewerState()?.status.indexedLineCount ??
      0,
  );
  readonly largeViewerSearchQuery = computed(
    () => this.largeViewerState()?.searchQuery ?? '',
  );
  readonly largeViewerSearchMatches = computed(
    () => this.largeViewerState()?.searchMatches ?? [],
  );
  readonly largeViewerSearchIsComplete = computed(
    () => this.largeViewerState()?.searchIsComplete ?? true,
  );
  readonly largeViewerScrollCommand = computed(
    () => this.largeViewerState()?.scrollCommand ?? null,
  );
  readonly largeViewerActiveMatchLine = computed<number | null>(() => {
    const viewer = this.largeViewerState();
    if (
      !viewer ||
      viewer.activeMatchIndex < 0 ||
      viewer.activeMatchIndex >= viewer.searchMatches.length
    ) {
      return null;
    }
    return viewer.searchMatches[viewer.activeMatchIndex]?.lineNumber ?? null;
  });
  readonly largeViewerLivePreviewLines = computed(
    () => this.largeViewerState()?.status.livePreviewLines ?? [],
  );
  readonly largeViewerLivePhase = computed(
    () => this.largeViewerState()?.livePhase ?? null,
  );
  readonly largeViewerLiveFollowMode = computed(
    () => this.largeViewerState()?.liveFollowMode ?? null,
  );
  readonly isLiveMode = computed(() => this.largeViewerMode() === 'live');

  ngOnDestroy(): void {
    void this.closeLargeViewer();
  }

  reset(): void {
    this.connectionLoadToken += 1;
    this.contentLoadToken += 1;
    this.entriesRefreshToken += 1;
    this.state.set({ status: 'idle' });
    this.selectedEntryIdsState.set([]);
    this.selectedEntriesSnapshotState.set([]);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);
    void this.closeLargeViewer();
  }

  setError(message: string): void {
    this.connectionLoadToken += 1;
    this.contentLoadToken += 1;
    this.entriesRefreshToken += 1;
    this.selectedEntryIdsState.set([]);
    this.selectedEntriesSnapshotState.set([]);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);
    void this.closeLargeViewer();
    this.state.set({ status: 'error', message });
  }

  async loadForConnection(
    accountName: string,
    containerName: string,
    includeDeleted = false,
  ): Promise<void> {
    const token = ++this.connectionLoadToken;
    const refreshToken = ++this.entriesRefreshToken;
    this.contentLoadToken += 1;
    this.state.set({ status: 'loading' });
    this.selectedEntryIdsState.set([]);
    this.selectedEntriesSnapshotState.set([]);
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);
    await this.closeLargeViewer();

    try {
      const blobs = await this.api.listBlobs(
        accountName,
        containerName,
        '',
        includeDeleted,
      );
      if (
        token !== this.connectionLoadToken ||
        refreshToken !== this.entriesRefreshToken
      ) {
        return;
      }

      const entries = blobs.map((blob) =>
        this.mapBlobToEntry(blob, accountName, containerName),
      );
      this.state.set({ status: 'success', entries });
    } catch {
      if (
        token !== this.connectionLoadToken ||
        refreshToken !== this.entriesRefreshToken
      ) {
        return;
      }

      this.state.set({
        status: 'error',
        message: this.i18n.translate('settings.service.loadBlobsFailed'),
      });
    }
  }

  async refreshEntriesForConnection(
    accountName: string,
    containerName: string,
    includeDeleted = false,
  ): Promise<boolean> {
    const connectionLoadToken = this.connectionLoadToken;
    const refreshToken = ++this.entriesRefreshToken;

    try {
      const blobs = await this.api.listBlobs(
        accountName,
        containerName,
        '',
        includeDeleted,
      );
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        refreshToken !== this.entriesRefreshToken
      ) {
        return false;
      }

      const entries = blobs.map((blob) =>
        this.mapBlobToEntry(blob, accountName, containerName),
      );
      this.state.set({ status: 'success', entries });
      this.syncSelectedEntriesSnapshot(entries);
      return true;
    } catch {
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        refreshToken !== this.entriesRefreshToken
      ) {
        return false;
      }

      return false;
    }
  }

  selectEntry(id: string | null): void {
    void this.updateSelection(id, false);
  }

  async updateSelection(
    id: string | null,
    additive: boolean,
  ): Promise<LogSelectionUpdateResult> {
    const requestedEntry = id ? this.resolveEntriesForIds([id])[0] : undefined;
    if (requestedEntry?.isDeleted && !requestedEntry.versionId) {
      return { kind: 'updated' };
    }

    const nextSelection = this.buildNextSelection(id, additive);
    const validation = this.validateSelection(nextSelection);
    if (validation.kind !== 'updated') {
      return validation;
    }

    await this.applySelection(nextSelection);
    return { kind: 'updated' };
  }

  async loadContent(id: string): Promise<void> {
    await this.loadContentChunk(id);
  }

  async refreshContent(): Promise<void> {
    const selectedEntries = this.selectedEntries();
    if (selectedEntries.length === 0) {
      return;
    }

    if (selectedEntries.length > 1) {
      await this.loadMergedContent(selectedEntries);
      return;
    }

    const entry = selectedEntries[0];
    if (!entry) {
      return;
    }

    const viewer = this.largeViewerState();
    if (viewer?.entryId === entry.id && viewer.mode === 'live') {
      await this.refreshLargeViewerStatus(viewer.sessionId);
      return;
    }

    if (entry.size > INLINE_BLOB_PREVIEW_LIMIT_BYTES) {
      await this.openLargeViewer(entry, 'snapshot', true);
      return;
    }

    await this.loadContentChunk(entry.id);
  }

  async restoreDeletedEntry(id: string): Promise<boolean> {
    const entry = this.resolveEntriesForIds([id])[0];
    if (
      !entry?.isDeleted ||
      entry.versionId ||
      !entry.storageAccountName ||
      !entry.containerName
    ) {
      return false;
    }

    try {
      await this.api.restoreBlob({
        accountName: entry.storageAccountName,
        containerName: entry.containerName,
        blobName: entry.blobName,
      });
      return true;
    } catch {
      return false;
    }
  }

  async setLiveMode(enabled: boolean): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry || this.selectionCount() !== 1) {
      return;
    }

    const viewer = this.largeViewerState();
    if (viewer?.entryId === entry.id) {
      const status = await this.api.setBlobViewSessionMode(
        viewer.sessionId,
        enabled ? 'live' : 'snapshot',
      );
      const livePhase = status.mode === 'live' ? resolveLivePhase(status) : null;
      const liveFollowMode = status.mode === 'live' ? 'following' : null;
      const nextViewportLineCount = viewer.viewportLineCount;
      const nextViewportStartLine =
        status.mode === 'live' && livePhase === 'indexed'
          ? calculateBottomViewportStartLine(
              status.indexedLineCount,
              nextViewportLineCount,
            )
          : viewer.viewportStartLine;

      this.largeViewerState.update((current) => {
        if (!current || current.sessionId !== viewer.sessionId) {
          return current;
        }

        const isIndexedLiveMode = status.mode === 'live' && livePhase === 'indexed';
        return {
          ...current,
          mode: status.mode,
          status,
          viewportStartLine: nextViewportStartLine,
          linesResponse: isIndexedLiveMode ? null : current.linesResponse,
          loadedViewportStartLine: isIndexedLiveMode
            ? null
            : current.loadedViewportStartLine,
          loadedViewportLineCount: isIndexedLiveMode
            ? null
            : current.loadedViewportLineCount,
          scrollCommand: status.mode === 'live' ? this.createBottomScrollCommand() : null,
          livePhase,
          liveFollowMode,
        };
      });

      if (status.mode === 'snapshot' && status.isComplete) {
        this.stopStatusPolling();
      } else {
        this.startStatusPolling(viewer.sessionId, status.mode);
      }

      if (status.mode === 'live' && livePhase === 'indexed') {
        await this.loadLargeViewerViewport(
          viewer.sessionId,
          nextViewportStartLine,
          nextViewportLineCount,
        );
      }

      const activeQuery = this.largeViewerSearchQuery().trim();
      if (activeQuery.length > 0) {
        if (status.livePreviewLines.length > 0) {
          this.applyLivePreviewSearch(viewer.sessionId, activeQuery, false);
        } else {
          await this.loadSearchResults(viewer.sessionId, activeQuery);
        }
      }
      return;
    }

    if (enabled) {
      await this.openLargeViewer(entry, 'live', true);
      return;
    }

    await this.applySelection([entry.id]);
  }

  async updateLargeViewport(
    startLine: number,
    lineCount: number,
    nearBottom: boolean,
  ): Promise<void> {
    const viewer = this.largeViewerState();
    if (!viewer) {
      return;
    }

    const normalizedStartLine = Math.max(0, startLine);
    const normalizedLineCount = Math.max(1, lineCount);

    if (viewer.mode === 'live') {
      const liveFollowMode = resolveLiveFollowModeFromViewport(
        viewer.liveFollowMode,
        nearBottom,
      );
      this.largeViewerState.update((current) => {
        if (!current || current.sessionId !== viewer.sessionId) {
          return current;
        }

        return {
          ...current,
          viewportStartLine: normalizedStartLine,
          viewportLineCount: normalizedLineCount,
          liveFollowMode,
        };
      });
    }

    if (viewer.status.livePreviewLines.length > 0) {
      return;
    }

    await this.loadLargeViewerViewport(
      viewer.sessionId,
      normalizedStartLine,
      normalizedLineCount,
    );
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
        scrollCommand: null,
      };
    });

    if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      return;
    }

    if (viewer.status.livePreviewLines.length > 0) {
      this.applyLivePreviewSearch(viewer.sessionId, normalizedQuery, false);
      return;
    }

    await this.loadSearchResults(viewer.sessionId, normalizedQuery);
  }

  async selectNextSearchMatch(): Promise<void> {
    await this.moveSearchMatch(1);
  }

  async selectPreviousSearchMatch(): Promise<void> {
    await this.moveSearchMatch(-1);
  }

  async exportLargeViewer(): Promise<boolean> {
    const viewer = this.largeViewerState();
    if (!viewer || viewer.mode === 'live' || !viewer.status.isComplete) {
      return false;
    }

    const result = await this.api.exportBlobViewSession(viewer.sessionId);
    return result.cancelled === false;
  }

  clearLargeViewerScrollCommand(): void {
    this.largeViewerState.update((current) =>
      current ? { ...current, scrollCommand: null } : current,
    );
  }

  private async loadLargeViewerViewport(
    sessionId: string,
    startLine: number,
    lineCount: number,
  ): Promise<void> {
    const viewer = this.largeViewerState();
    if (!viewer || viewer.sessionId !== sessionId) {
      return;
    }

    const indexedLinesChanged =
      viewer.status.livePreviewLines.length === 0 &&
      viewer.linesResponse?.totalLines !== viewer.status.indexedLineCount;

    const isRequestedViewportLoaded =
      viewer.loadedViewportStartLine === startLine &&
      viewer.loadedViewportLineCount === lineCount;

    if (
      viewer.linesResponse &&
      isRequestedViewportLoaded &&
      !indexedLinesChanged &&
      !(viewer.linesResponse.lines.length === 0 && viewer.status.indexedLineCount > 0)
    ) {
      return;
    }

    // Viewport reads overlap while scrolling; a slower earlier response must
    // never overwrite the window the user has already scrolled to.
    const requestToken = ++this.viewportRequestToken;
    const response = await this.api.getBlobViewLines(
      viewer.sessionId,
      startLine,
      lineCount,
    );
    if (requestToken !== this.viewportRequestToken) {
      return;
    }

    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== viewer.sessionId) {
        return current;
      }
      return {
        ...current,
        viewportStartLine: startLine,
        viewportLineCount: lineCount,
        linesResponse: response,
        loadedViewportStartLine: startLine,
        loadedViewportLineCount: lineCount,
        scrollCommand:
          current.mode === 'live' &&
          current.livePhase === 'indexed' &&
          current.liveFollowMode === 'following'
            ? this.createBottomScrollCommand()
            : current.scrollCommand,
      };
    });
  }

  private buildNextSelection(id: string | null, additive: boolean): string[] {
    if (!id) {
      return [];
    }

    if (!additive) {
      return [id];
    }

    const currentSelection = this.selectedEntryIdsState();
    if (currentSelection.includes(id)) {
      return currentSelection.filter((currentId) => currentId !== id);
    }

    return [...currentSelection, id];
  }

  private validateSelection(nextSelection: string[]): LogSelectionUpdateResult {
    if (nextSelection.length > MAX_MERGED_SELECTION_COUNT) {
      return {
        kind: 'selection-limit',
        maxFiles: MAX_MERGED_SELECTION_COUNT,
      };
    }

    if (nextSelection.length <= 1) {
      return { kind: 'updated' };
    }

    const oversizedEntry = this.resolveEntriesForIds(nextSelection).find(
      (entry) => entry.size > MAX_MERGED_BLOB_SIZE_BYTES,
    );
    if (oversizedEntry) {
      return {
        kind: 'file-too-large',
        fileName: oversizedEntry.blobName,
        maxSizeBytes: MAX_MERGED_BLOB_SIZE_BYTES,
      };
    }

    return { kind: 'updated' };
  }

  private async applySelection(nextSelection: string[]): Promise<void> {
    this.contentLoadToken += 1;
    this.selectedEntryIdsState.set(nextSelection);
    this.syncSelectedEntriesSnapshot();
    this.selectedContentState.set(null);
    this.selectedContentErrorState.set(null);
    this._contentLoading.set(false);

    await this.closeLargeViewer();

    if (nextSelection.length === 0) {
      return;
    }

    const selectedEntries = this.resolveEntriesForIds(nextSelection);
    if (selectedEntries.length !== nextSelection.length) {
      return;
    }

    if (selectedEntries.length === 1) {
      const entry = selectedEntries[0];
      if (!entry) {
        return;
      }

      if (entry.size > INLINE_BLOB_PREVIEW_LIMIT_BYTES) {
        await this.openLargeViewer(entry, 'snapshot');
        return;
      }

      await this.loadContentChunk(entry.id);
      return;
    }

    await this.loadMergedContent(selectedEntries);
  }

  private async moveSearchMatch(direction: -1 | 1): Promise<void> {
    const viewer = this.largeViewerState();
    if (!viewer || viewer.searchQuery.trim().length === 0) {
      return;
    }

    if (viewer.status.livePreviewLines.length > 0) {
      this.moveLivePreviewSearchMatch(viewer, direction);
      return;
    }

    let nextIndex = viewer.activeMatchIndex + direction;
    if (
      direction > 0 &&
      nextIndex >= viewer.searchMatches.length &&
      !viewer.searchIsComplete
    ) {
      await this.loadSearchResults(
        viewer.sessionId,
        viewer.searchQuery.trim(),
        viewer.searchNextCursor,
        false,
      );
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
            scrollCommand: this.createLineScrollCommand(activeMatch.lineNumber),
            liveFollowMode:
              current.mode === 'live' ? 'paused-by-navigation' : current.liveFollowMode,
          }
        : current,
    );

    if (updatedViewer.status.livePreviewLines.length === 0) {
      const startLine = Math.max(
        activeMatch.lineNumber - Math.floor(updatedViewer.viewportLineCount / 2),
        0,
      );
      await this.loadLargeViewerViewport(
        updatedViewer.sessionId,
        startLine,
        updatedViewer.viewportLineCount,
      );
    }
  }

  private async openLargeViewer(
    entry: LogEntry,
    mode: BlobViewMode,
    forceReload = false,
  ): Promise<void> {
    if (!entry.storageAccountName || !entry.containerName) {
      return;
    }

    const currentViewer = this.largeViewerState();
    if (
      currentViewer &&
      currentViewer.entryId === entry.id &&
      currentViewer.mode === mode &&
      !forceReload
    ) {
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
        ...(entry.versionId ? { versionId: entry.versionId } : {}),
        mode,
      });
      if (status.failureReason) {
        this.selectedContentErrorState.set(
          getBlobFailureMessage(this.i18n, status.failureReason),
        );
        return;
      }

      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        void this.api.closeBlobViewSession(status.sessionId).catch(() => undefined);
        return;
      }

      const livePhase = status.mode === 'live' ? resolveLivePhase(status) : null;
      const initialViewportStartLine =
        status.mode === 'live' && livePhase === 'indexed'
          ? calculateBottomViewportStartLine(
              status.indexedLineCount,
              DEFAULT_LINE_WINDOW_SIZE,
            )
          : 0;

      this.largeViewerState.set({
        entryId: entry.id,
        sessionId: status.sessionId,
        mode: status.mode,
        status,
        linesResponse: null,
        viewportStartLine: initialViewportStartLine,
        viewportLineCount: DEFAULT_LINE_WINDOW_SIZE,
        loadedViewportStartLine: null,
        loadedViewportLineCount: null,
        searchQuery: '',
        searchMatches: [],
        searchNextCursor: 0,
        searchIsComplete: true,
        activeMatchIndex: -1,
        scrollCommand: status.mode === 'live' ? this.createBottomScrollCommand() : null,
        livePhase,
        liveFollowMode: status.mode === 'live' ? 'following' : null,
      });

      this.startStatusPolling(status.sessionId, status.mode);

      if (status.mode === 'live' && livePhase === 'indexed') {
        await this.loadLargeViewerViewport(
          status.sessionId,
          initialViewportStartLine,
          DEFAULT_LINE_WINDOW_SIZE,
        );
      } else if (status.livePreviewLines.length === 0 && status.indexedLineCount > 0) {
        await this.loadLargeViewerViewport(
          status.sessionId,
          initialViewportStartLine,
          DEFAULT_LINE_WINDOW_SIZE,
        );
      }
    } catch {
      this.selectedContentErrorState.set(
        this.i18n.translate('logs.service.loadContentFailedGeneric'),
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
    const currentViewer = this.largeViewerState();
    const viewerMode =
      currentViewer?.sessionId === sessionId ? currentViewer.mode : status.mode;
    const activeQuery = this.largeViewerSearchQuery().trim();
    const previousLivePreviewLength =
      currentViewer?.sessionId === sessionId
        ? currentViewer.status.livePreviewLines.length
        : 0;
    const nextLivePhase = status.mode === 'live' ? resolveLivePhase(status) : null;

    let needsViewportRefresh = false;
    let nextViewportStartLine = 0;
    let nextViewportLineCount = DEFAULT_LINE_WINDOW_SIZE;
    let nextLiveFollowMode: LiveFollowMode | null = null;

    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== sessionId) {
        return current;
      }

      needsViewportRefresh =
        current.status.indexedLineCount !== status.indexedLineCount ||
        current.status.isComplete !== status.isComplete ||
        current.livePhase !== nextLivePhase;
      nextLiveFollowMode =
        status.mode === 'live' ? (current.liveFollowMode ?? 'following') : null;
      nextViewportLineCount = current.viewportLineCount;
      nextViewportStartLine =
        status.mode === 'live' &&
        nextLivePhase === 'indexed' &&
        nextLiveFollowMode === 'following'
          ? calculateBottomViewportStartLine(
              status.indexedLineCount,
              nextViewportLineCount,
            )
          : current.viewportStartLine;
      const shouldInvalidateIndexedLiveLines =
        status.mode === 'live' &&
        nextLivePhase === 'indexed' &&
        current.livePhase !== 'indexed';

      return {
        ...current,
        mode: status.mode,
        status,
        viewportStartLine: nextViewportStartLine,
        linesResponse: shouldInvalidateIndexedLiveLines ? null : current.linesResponse,
        loadedViewportStartLine: shouldInvalidateIndexedLiveLines
          ? null
          : current.loadedViewportStartLine,
        loadedViewportLineCount: shouldInvalidateIndexedLiveLines
          ? null
          : current.loadedViewportLineCount,
        scrollCommand:
          status.mode === 'live' && nextLiveFollowMode === 'following'
            ? this.createBottomScrollCommand()
            : current.scrollCommand,
        livePhase: nextLivePhase,
        liveFollowMode: nextLiveFollowMode,
      };
    });

    if (status.failureReason) {
      this.selectedContentErrorState.set(
        getBlobFailureMessage(this.i18n, status.failureReason),
      );
      this.stopStatusPolling();
      return;
    }

    if (status.errorMessage?.trim()) {
      this.stopStatusPolling();
      return;
    }

    if (viewerMode === 'snapshot' && status.isComplete) {
      this.stopStatusPolling();
    }

    if (
      status.livePreviewLines.length === 0 &&
      (needsViewportRefresh || this.largeViewerLines().length === 0)
    ) {
      await this.loadLargeViewerViewport(
        sessionId,
        nextViewportStartLine,
        nextViewportLineCount,
      );
    }

    if (activeQuery.length === 0) {
      return;
    }

    if (status.livePreviewLines.length > 0) {
      this.applyLivePreviewSearch(sessionId, activeQuery, true);
      return;
    }

    const searchNeedsRefresh =
      this.largeViewerState()?.sessionId === sessionId &&
      (needsViewportRefresh ||
        previousLivePreviewLength !== status.livePreviewLines.length);
    if (!searchNeedsRefresh) {
      return;
    }

    await this.loadSearchResults(sessionId, activeQuery);
  }

  private startStatusPolling(sessionId: string, mode: BlobViewMode): void {
    this.stopStatusPolling();
    const intervalMs =
      mode === 'live'
        ? this.settings.logs().liveRefreshIntervalSeconds * 1000
        : SNAPSHOT_VIEW_POLL_INTERVAL_MS;
    this.statusPollTimer = setInterval(() => {
      void this.refreshLargeViewerStatus(sessionId);
    }, intervalMs);
  }

  private stopStatusPolling(): void {
    if (this.statusPollTimer !== null) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  }

  private async loadSearchResults(
    sessionId: string,
    query: string,
    cursor = 0,
    replace = true,
  ): Promise<void> {
    let nextCursor = cursor;
    let shouldReplace = replace;

    while (true) {
      const response = await this.api.searchBlobView({
        sessionId,
        query,
        cursor: nextCursor,
      });

      this.applySearchResponse(sessionId, response, shouldReplace);

      if (!this.isSearchStillCurrent(sessionId, query)) {
        return;
      }

      if (
        response.isComplete ||
        response.nextCursor < 0 ||
        response.nextCursor <= nextCursor
      ) {
        return;
      }

      nextCursor = response.nextCursor;
      shouldReplace = false;
    }
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
      const nextActiveMatchIndex =
        matches.length > 0
          ? Math.max(Math.min(current.activeMatchIndex, matches.length - 1), 0)
          : -1;
      const hadActiveMatch =
        current.activeMatchIndex >= 0 &&
        current.activeMatchIndex < current.searchMatches.length;
      const shouldScrollToFirstMatch =
        nextActiveMatchIndex >= 0 && (replace || !hadActiveMatch);

      return {
        ...current,
        searchMatches: matches,
        searchNextCursor: response.nextCursor,
        searchIsComplete: response.isComplete,
        activeMatchIndex: nextActiveMatchIndex,
        scrollCommand: shouldScrollToFirstMatch
          ? this.createLineScrollCommand(matches[nextActiveMatchIndex]?.lineNumber ?? 0)
          : current.scrollCommand,
        liveFollowMode:
          shouldScrollToFirstMatch && current.mode === 'live'
            ? 'paused-by-navigation'
            : current.liveFollowMode,
      };
    });
  }

  private isSearchStillCurrent(sessionId: string, query: string): boolean {
    const viewer = this.largeViewerState();
    return viewer?.sessionId === sessionId && viewer.searchQuery.trim() === query.trim();
  }

  private applyLivePreviewSearch(
    sessionId: string,
    query: string,
    preserveActiveMatch: boolean,
  ): void {
    const normalizedQuery = query.trim().toLowerCase();

    this.largeViewerState.update((current) => {
      if (!current || current.sessionId !== sessionId) {
        return current;
      }

      const matches =
        normalizedQuery.length === 0
          ? []
          : current.status.livePreviewLines.flatMap((line, index) =>
              line.toLowerCase().includes(normalizedQuery)
                ? [{ lineNumber: index, preview: line }]
                : [],
            );

      const activeMatchIndex =
        matches.length === 0
          ? -1
          : preserveActiveMatch
            ? Math.min(Math.max(current.activeMatchIndex, 0), matches.length - 1)
            : 0;

      return {
        ...current,
        searchMatches: matches,
        searchNextCursor: 0,
        searchIsComplete: current.status.isComplete,
        activeMatchIndex,
        scrollCommand:
          activeMatchIndex >= 0
            ? this.createLineScrollCommand(matches[activeMatchIndex]?.lineNumber ?? 0)
            : null,
        liveFollowMode:
          activeMatchIndex >= 0 && current.mode === 'live'
            ? 'paused-by-navigation'
            : current.liveFollowMode,
      };
    });
  }

  private moveLivePreviewSearchMatch(viewer: LargeViewerState, direction: -1 | 1): void {
    if (viewer.searchMatches.length === 0) {
      return;
    }

    let nextIndex = viewer.activeMatchIndex + direction;
    if (direction < 0 && nextIndex < 0) {
      nextIndex = viewer.searchMatches.length - 1;
    } else if (direction > 0 && nextIndex >= viewer.searchMatches.length) {
      nextIndex = 0;
    }

    const activeMatch = viewer.searchMatches[nextIndex];
    if (!activeMatch) {
      return;
    }

    this.largeViewerState.update((current) =>
      current && current.sessionId === viewer.sessionId
        ? {
            ...current,
            activeMatchIndex: nextIndex,
            scrollCommand: this.createLineScrollCommand(activeMatch.lineNumber),
            liveFollowMode:
              current.mode === 'live' ? 'paused-by-navigation' : current.liveFollowMode,
          }
        : current,
    );
  }

  private createBottomScrollCommand(): LogLargeViewerScrollCommand {
    return {
      kind: 'bottom',
      requestId: ++this.nextLargeViewerScrollCommandId,
    };
  }

  private createLineScrollCommand(lineNumber: number): LogLargeViewerScrollCommand {
    return {
      kind: 'line',
      lineNumber,
      requestId: ++this.nextLargeViewerScrollCommandId,
    };
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
    const entry = this.resolveEntriesForIds([id])[0];
    if (!entry?.storageAccountName || !entry.containerName) {
      return;
    }

    const connectionLoadToken = this.connectionLoadToken;
    const contentLoadToken = ++this.contentLoadToken;
    this._contentLoading.set(true);
    this.selectedContentErrorState.set(null);

    try {
      const chunk = await this.readEntryContent(entry);
      if (chunk.failureReason) {
        this.selectedContentState.set(null);
        this.selectedContentErrorState.set(
          getBlobFailureMessage(this.i18n, chunk.failureReason),
        );
        return;
      }
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      this.selectedContentState.set({
        mode: 'single',
        entryIds: [id],
        chunk,
      });
    } catch {
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      this.selectedContentState.set(null);
      this.selectedContentErrorState.set(
        this.i18n.translate('logs.service.loadContentFailedGeneric'),
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

  private async loadMergedContent(entries: LogEntry[]): Promise<void> {
    const connectionLoadToken = this.connectionLoadToken;
    const contentLoadToken = ++this.contentLoadToken;
    this._contentLoading.set(true);
    this.selectedContentErrorState.set(null);
    this.selectedContentState.set(null);

    try {
      const chunks = await Promise.all(
        entries.map((entry) => this.readEntryContent(entry, entry.size)),
      );
      const failedChunk = chunks.find((chunk) => chunk.failureReason);
      if (failedChunk?.failureReason) {
        this.selectedContentState.set(null);
        this.selectedContentErrorState.set(
          getBlobFailureMessage(this.i18n, failedChunk.failureReason),
        );
        return;
      }
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      const mergedContent = entries
        .map((entry, index) =>
          buildMergedEntryContent(entry.blobName, chunks[index]?.content ?? ''),
        )
        .join('\n');
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

      this.selectedContentState.set({
        mode: 'merged',
        entryIds: entries.map((entry) => entry.id),
        content: mergedContent,
        totalSize,
      });
    } catch {
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      this.selectedContentState.set(null);
      this.selectedContentErrorState.set(
        this.i18n.translate('logs.service.loadContentFailedGeneric'),
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

  private async readEntryContent(
    entry: LogEntry,
    count?: number | null,
  ): Promise<AzureBlobTextChunk> {
    if (!entry.storageAccountName || !entry.containerName) {
      throw new Error(this.i18n.translate('common.errors.unknownError'));
    }

    return this.api.readBlobTextChunk({
      accountName: entry.storageAccountName,
      containerName: entry.containerName,
      blobName: entry.blobName,
      ...(entry.versionId ? { versionId: entry.versionId } : {}),
      startOffset: count === undefined ? null : 0,
      count: count ?? null,
    });
  }

  private selectedChunk(): AzureBlobTextChunk | null {
    const selectedContentState = this.selectedContentState();
    if (selectedContentState?.mode !== 'single') {
      return null;
    }

    return selectedContentState.chunk;
  }

  private resolveEntriesForIds(ids: string[]): LogEntry[] {
    const entriesById = new Map(this.entries().map((entry) => [entry.id, entry]));
    const snapshotById = new Map(
      this.selectedEntriesSnapshotState().map((entry) => [entry.id, entry]),
    );

    return ids
      .map((id) => entriesById.get(id) ?? snapshotById.get(id))
      .filter((entry): entry is LogEntry => entry !== undefined);
  }

  private syncSelectedEntriesSnapshot(entries = this.entries()): void {
    const selectedIds = this.selectedEntryIdsState();
    if (selectedIds.length === 0) {
      this.selectedEntriesSnapshotState.set([]);
      return;
    }

    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    const snapshotById = new Map(
      this.selectedEntriesSnapshotState().map((entry) => [entry.id, entry]),
    );

    this.selectedEntriesSnapshotState.set(
      selectedIds
        .map((id) => entriesById.get(id) ?? snapshotById.get(id))
        .filter((entry): entry is LogEntry => entry !== undefined),
    );
  }

  private mapBlobToEntry(
    blob: AzureBlobItem,
    accountName: string,
    containerName: string,
  ): LogEntry {
    const createdAt = this.resolveCreatedAt(blob);
    const lastModified = blob.lastModified;

    return {
      id: blob.deleted
        ? `${blob.name}::deleted::${blob.deletedAt || blob.versionId || 'soft-delete'}`
        : blob.name,
      container: containerName,
      blobName: blob.name,
      createdAt,
      lastModified,
      createdLabel: this.formatTimestampLabel(createdAt),
      lastModifiedLabel: this.formatTimestampLabel(lastModified),
      size: blob.size,
      contentType: blob.contentType,
      isDeleted: blob.deleted,
      deletedAt: blob.deletedAt || undefined,
      remainingRetentionDays:
        blob.deleted && blob.deletedAt ? blob.remainingRetentionDays : undefined,
      versionId: blob.versionId,
      path: `${accountName}/${containerName}/${blob.name}`,
      createdRelative: createdAt ? this.relativeTime(createdAt) : undefined,
      storageAccountName: accountName,
      containerName,
    };
  }

  private resolveCreatedAt(blob: AzureBlobItem): string {
    return blob.createdAt || blob.lastModified;
  }

  private formatTimestampLabel(iso: string): string {
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
    return this.i18n.formatDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private relativeTime(iso: string): string {
    if (!iso) {
      return '';
    }
    return this.i18n.formatRelativeFromNow(iso);
  }
}

function resolveLivePhase(status: BlobViewSessionStatus): LivePhase {
  return status.livePreviewLines.length > 0 ? 'preview' : 'indexed';
}

function calculateBottomViewportStartLine(
  indexedLineCount: number,
  viewportLineCount: number,
): number {
  return Math.max(
    indexedLineCount - Math.max(viewportLineCount, DEFAULT_LINE_WINDOW_SIZE),
    0,
  );
}

function resolveLiveFollowModeFromViewport(
  current: LiveFollowMode | null,
  nearBottom: boolean,
): LiveFollowMode {
  if (nearBottom) {
    return 'following';
  }

  return current === 'following' ? 'paused-by-user' : (current ?? 'paused-by-user');
}

function areSelectionsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildMergedEntryContent(blobName: string, content: string): string {
  return [
    `------------ START ${blobName} ------------`,
    content,
    `------------ END ${blobName} ------------`,
  ].join('\n');
}
