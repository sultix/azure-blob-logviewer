import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { distinctUntilChanged, map } from 'rxjs';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type { StorageConnection } from '@app/features/connections/models/storage-connection.model';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import { SettingsService } from '@app/features/settings/services/settings.service';

import { LogsDetailPanelComponent } from '../components/logs-detail-panel/logs-detail-panel.component';
import { LogsFileListComponent } from '../components/logs-file-list/logs-file-list.component';
import { LogsFiltersComponent } from '../components/logs-filters/logs-filters.component';
import type {
  LogCreatedRange,
  LogFileSelectionEvent,
  LogFileRowVm,
  LogFooterVm,
  LogLargeViewerVm,
  LogToolbarVm,
} from '../models/logs-view.model';
import { LogSortBasis } from '../models/logs-view.model';
import { LogsService, type LogSelectionUpdateResult } from '../services/logs.service';

type SortDir = 'asc' | 'desc';

interface PreparedLogFileRowVm extends LogFileRowVm {
  readonly blobNameLower: string;
  readonly createdAtTs: number;
  readonly lastModifiedAtTs: number;
}

interface ContentFooterStatsVm {
  readonly lineCountLabel: string;
  readonly lineEndingsLabel: string;
}

interface SidebarConnectionFooterVm {
  readonly label: string;
  readonly name: string;
  readonly updatedLabel: string;
  readonly updatedText: string;
}

const LOG_VIRTUAL_LINE_HEIGHT_PX = 20;
const MIN_CONTENT_SEARCH_QUERY_LENGTH = 3;

@Component({
  selector: 'app-logs-page',
  imports: [LogsFiltersComponent, LogsFileListComponent, LogsDetailPanelComponent],
  providers: [LogsService],
  templateUrl: './logs.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPage implements OnInit {
  private readonly logs = inject(LogsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly connectionsService = inject(ConnectionsService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(AppI18nService);
  private readonly settings = inject(SettingsService);
  private routeLoadToken = 0;
  private readonly currentConnection = signal<StorageConnection | null>(null);
  private readonly sidebarLastUpdatedAt = signal<Date | null>(null);
  private readonly sidebarRefreshing = signal(false);

  readonly status = this.logs.status;
  readonly errorMessage = this.logs.errorMessage;
  readonly isEmpty = this.logs.isEmpty;
  readonly selectedContent = this.logs.selectedContent;
  readonly selectedContentLoaded = this.logs.selectedContentLoaded;
  readonly selectedContentError = this.logs.selectedContentError;
  readonly selectedEntry = this.logs.selectedEntry;
  readonly selectedEntries = this.logs.selectedEntries;
  readonly selectedEntryIds = this.logs.selectedEntryIds;
  readonly contentMode = this.logs.contentMode;
  readonly contentLoading = this.logs.contentLoading;
  readonly isLargeBlob = this.logs.isLargeBlob;
  readonly largeViewerStatus = this.logs.largeViewerStatus;

  readonly searchTerm = signal('');
  readonly sortDir = signal<SortDir>('desc');
  readonly sortBasis = signal<LogSortBasis>(this.settings.logs().sortBasis);
  readonly createdOn = signal<Date | null>(null);
  readonly createdRange = signal<LogCreatedRange>(null);

  readonly preparedRows = computed<PreparedLogFileRowVm[]>(() =>
    this.logs.entries().map((entry) => ({
      id: entry.id,
      blobName: entry.blobName,
      blobNameLower: entry.blobName.toLowerCase(),
      createdLabel: entry.createdLabel,
      lastModifiedLabel: entry.lastModifiedLabel,
      sizeLabel: this.formatSize(entry.size),
      isLive: entry.isLive === true,
      createdAtTs: toTimestamp(entry.createdAt),
      lastModifiedAtTs: toTimestamp(entry.lastModified),
    })),
  );

  readonly rows = computed<LogFileRowVm[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const dir = this.sortDir();
    const sortBasis = this.sortBasis();
    const createdOn = this.createdOn();
    const createdRange = this.createdRange();
    const rangeStart = isCompleteCreatedRange(createdRange)
      ? startOfDayTimestamp(createdRange[0])
      : 0;
    const rangeEnd = isCompleteCreatedRange(createdRange)
      ? endOfDayExclusiveTimestamp(createdRange[1])
      : Number.POSITIVE_INFINITY;

    const filteredRows = this.preparedRows().filter((row) => {
      if (term && !row.blobNameLower.includes(term)) {
        return false;
      }

      if (createdOn) {
        const start = startOfDayTimestamp(createdOn);
        const end = endOfDayExclusiveTimestamp(createdOn);
        return row.createdAtTs >= start && row.createdAtTs < end;
      }

      if (isCompleteCreatedRange(createdRange)) {
        return row.createdAtTs >= rangeStart && row.createdAtTs < rangeEnd;
      }

      return true;
    });

    const mult = dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const dateCmp =
        sortBasis === LogSortBasis.Created
          ? a.createdAtTs - b.createdAtTs
          : a.lastModifiedAtTs - b.lastModifiedAtTs;
      if (dateCmp !== 0) {
        return dateCmp * mult;
      }

      return a.blobNameLower.localeCompare(b.blobNameLower) * mult;
    });
  });

  readonly toolbar = computed<LogToolbarVm | null>(() => {
    const contentMode = this.contentMode();
    const connectionName = this.currentConnection()?.name;
    if (contentMode === 'none') {
      return null;
    }

    if (contentMode === 'merged') {
      const selectedEntries = this.selectedEntries();
      return {
        connectionName,
        title: this.i18n.translate('logs.detail.mergedTitle', {
          count: selectedEntries.length,
        }),
        subtitle: this.i18n.translate('logs.detail.mergedSubtitle'),
        metaBadges: [
          this.i18n.translate('logs.detail.size', {
            value: this.formatSize(
              selectedEntries.reduce((sum, entry) => sum + entry.size, 0),
            ),
          }),
          this.i18n.translate('logs.detail.mergeOrder'),
        ],
      };
    }

    const entry = this.selectedEntry();
    if (!entry) return null;
    return {
      connectionName,
      title: entry.blobName,
      subtitle: entry.path ?? `/${entry.container}/${entry.blobName}`,
      metaBadges: [
        this.i18n.translate('logs.detail.size', {
          value: this.formatSize(entry.size),
        }),
        this.i18n.translate('logs.detail.created', {
          value: this.formatDetailTimestamp(entry.createdAt),
        }),
        this.i18n.translate('logs.detail.modified', {
          value: this.formatDetailTimestamp(entry.lastModified),
        }),
      ],
    };
  });

  readonly sortLabel = computed(() =>
    this.sortDir() === 'desc'
      ? this.i18n.translate('logs.filters.newestFirst')
      : this.i18n.translate('logs.filters.oldestFirst'),
  );
  readonly sortBasisLabel = computed(() =>
    this.sortBasis() === LogSortBasis.Created
      ? this.i18n.translate('logs.filters.sortBasisCreated')
      : this.i18n.translate('logs.filters.sortBasisLastModified'),
  );
  readonly sidebarConnectionFooter = computed<SidebarConnectionFooterVm | null>(() => {
    const connection = this.currentConnection();
    const lastUpdatedAt = this.sidebarLastUpdatedAt();
    if (!connection || !lastUpdatedAt) {
      return null;
    }

    return {
      label: this.i18n.translate('logs.page.sidebarConnectionLabel'),
      name: connection.name,
      updatedLabel: this.i18n.translate('logs.page.sidebarUpdatedLabel'),
      updatedText: this.formatSidebarUpdatedAt(lastUpdatedAt),
    };
  });
  readonly hasSelectedEntry = computed(() => this.selectedEntryIds().length > 0);
  readonly detailSelectionKey = computed(() => this.selectedEntryIds().join('|'));
  readonly sidebarLoading = computed(
    () => this.status() === 'loading' || this.sidebarRefreshing(),
  );
  readonly tailAvailable = computed(
    () => this.selectedEntryIds().length === 1 && this.contentMode() === 'single',
  );
  readonly tailEnabled = computed(() => this.logs.isTailMode());
  readonly tailRefreshIntervalSeconds = computed(
    () => this.settings.logs().tailRefreshIntervalSeconds,
  );
  readonly largeViewer = computed<LogLargeViewerVm | null>(() => {
    const status = this.largeViewerStatus();
    if (!status) {
      return null;
    }

    const lines = this.logs.largeViewerLines();
    const viewportStartLine = this.logs.largeViewerViewportStartLine();
    const totalLines = this.logs.largeViewerTotalLines();
    const topSpacerPx = viewportStartLine * LOG_VIRTUAL_LINE_HEIGHT_PX;
    const bottomSpacerPx =
      Math.max(totalLines - viewportStartLine - lines.length, 0) *
      LOG_VIRTUAL_LINE_HEIGHT_PX;

    return {
      mode: status.mode,
      progressLabel: this.i18n.translate('logs.detail.viewer.progress', {
        loaded: this.formatProgressSize(status.bytesDownloaded),
        total: this.formatProgressSize(status.blobSize),
      }),
      statusLabel:
        status.mode === 'tail'
          ? this.i18n.translate('logs.detail.viewer.tailActive')
          : status.isComplete
            ? this.i18n.translate('logs.detail.viewer.complete')
            : this.i18n.translate('logs.detail.viewer.backgroundLoading'),
      searchStatusLabel: this.buildLargeViewerSearchStatusLabel(),
      searchQuery: this.logs.largeViewerSearchQuery(),
      matchCount: this.logs.largeViewerSearchMatches().length,
      activeMatchLineNumber: this.logs.largeViewerActiveMatchLine(),
      requestedScrollLine: this.logs.largeViewerRequestedScrollLine(),
      topSpacerPx,
      bottomSpacerPx,
      lines: lines.map((line) => ({
        lineNumber: line.lineNumber,
        content: line.content,
      })),
      totalLines,
      tailPreviewLines: this.logs.largeViewerTailPreviewLines(),
      pendingBeforeLabel: status.hasPendingBefore
        ? this.i18n.translate('logs.detail.viewer.pendingBefore')
        : null,
      pendingAfterLabel: status.hasPendingAfter
        ? this.i18n.translate('logs.detail.viewer.pendingAfter')
        : null,
      canEnableWordWrap: status.canEnableWordWrap,
      downloadDisabled: status.mode === 'tail' || !status.isComplete,
    };
  });
  readonly downloadDisabled = computed(
    () => this.largeViewer()?.downloadDisabled ?? false,
  );
  readonly contentFooterStats = computed<ContentFooterStatsVm | null>(() => {
    const largeViewer = this.largeViewer();
    if (largeViewer) {
      const status = this.largeViewerStatus();
      if (!status) {
        return null;
      }
      return {
        lineCountLabel: this.i18n.translate('logs.detail.footer.linesWindow', {
          count: status.indexedLineCount,
        }),
        lineEndingsLabel: status.isComplete
          ? this.i18n.translate('logs.detail.footer.lineEndings.unknown')
          : this.i18n.translate('logs.detail.footer.loadingSearch'),
      };
    }

    if (this.contentLoading() || this.selectedContentError() !== null) {
      return null;
    }

    const content = this.selectedContent();
    return {
      lineCountLabel: this.i18n.translate(
        this.isLargeBlob()
          ? 'logs.detail.footer.linesWindow'
          : 'logs.detail.footer.lines',
        {
          count: countLogicalLines(content),
        },
      ),
      lineEndingsLabel: this.i18n.translate(
        `logs.detail.footer.lineEndings.${detectLineEndings(content)}`,
      ),
    };
  });
  readonly footer = computed<LogFooterVm | null>(() => {
    const selectedEntries = this.selectedEntries();
    if (selectedEntries.length === 0) {
      return null;
    }

    const footer: LogFooterVm = {};
    if (selectedEntries.length === 1) {
      const entry = selectedEntries[0];
      if (entry?.contentType?.trim()) {
        footer.typeLabel = `${entry.contentType}`;
      }
    }

    const contentFooterStats = this.contentFooterStats();
    if (!contentFooterStats) {
      return hasFooterContent(footer) ? footer : null;
    }

    footer.lineCountLabel = contentFooterStats.lineCountLabel;
    footer.lineEndingsLabel = contentFooterStats.lineEndingsLabel;

    return footer;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((paramMap) => paramMap.get('connectionId')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((connectionId) => {
        const routeLoadToken = ++this.routeLoadToken;
        void this.handleConnectionChange(connectionId, routeLoadToken);
      });
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  toggleSort(): void {
    this.sortDir.set(this.sortDir() === 'desc' ? 'asc' : 'desc');
  }

  onSortBasisChange(value: LogSortBasis): void {
    this.sortBasis.set(value);
    this.settings.updateLogsPreferences({ sortBasis: value });
  }

  onCreatedOnChange(value: Date | null): void {
    this.createdOn.set(value);
    if (value !== null) {
      this.createdRange.set(null);
    }
  }

  onCreatedRangeChange(value: LogCreatedRange): void {
    this.createdRange.set(value);
    if (value !== null) {
      this.createdOn.set(null);
    }
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.createdOn.set(null);
    this.createdRange.set(null);
  }

  async select(event: LogFileSelectionEvent): Promise<void> {
    await this.updateSelection(event.id, event.additive);
  }

  async refresh(): Promise<void> {
    await this.logs.refreshContent();
    if (this.currentConnection()) {
      this.sidebarLastUpdatedAt.set(new Date());
    }
  }

  async refreshList(): Promise<void> {
    const connection = this.currentConnection();
    if (
      !connection?.storageAccountName ||
      !connection.containerName ||
      this.sidebarRefreshing()
    ) {
      return;
    }

    this.sidebarRefreshing.set(true);
    try {
      const refreshed = await this.logs.refreshEntriesForConnection(
        connection.storageAccountName,
        connection.containerName,
      );
      if (!refreshed || this.currentConnection()?.id !== connection.id) {
        return;
      }

      this.sidebarLastUpdatedAt.set(new Date());
    } finally {
      this.sidebarRefreshing.set(false);
    }
  }

  onLargeViewportChange(event: { startLine: number; lineCount: number }): void {
    void this.logs.updateLargeViewport(event.startLine, event.lineCount);
  }

  onLargeSearchChange(query: string): void {
    void this.logs.updateLargeSearchQuery(query);
  }

  onPreviousLargeMatch(): void {
    void this.logs.selectPreviousSearchMatch();
  }

  onNextLargeMatch(): void {
    void this.logs.selectNextSearchMatch();
  }

  onLargeScrollHandled(): void {
    this.logs.clearRequestedScrollLine();
  }

  onTailToggled(enabled: boolean): void {
    if (enabled) {
      this.settings.updateLogsPreferences({ wordWrapEnabled: false });
    }

    void this.logs.setTailMode(enabled);
  }

  async download(): Promise<void> {
    const selectedEntries = this.selectedEntries();
    if (selectedEntries.length === 0 || this.contentLoading()) {
      return;
    }

    if (this.isLargeBlob()) {
      const entry = this.selectedEntry();
      if (!entry) {
        return;
      }

      const exported = await this.logs.exportLargeViewer();
      if (!exported) {
        return;
      }

      this.messageService.add({
        severity: 'success',
        summary: this.i18n.translate('logs.detail.toast.downloadComplete'),
        detail: this.i18n.translate('logs.detail.toast.downloaded', {
          name: entry.blobName,
        }),
        life: 2500,
      });
      return;
    }

    const isMerged = selectedEntries.length > 1;
    let content = this.selectedContent();
    if (!this.selectedContentLoaded()) {
      if (isMerged) {
        await this.logs.refreshContent();
      } else {
        const entry = selectedEntries[0];
        if (!entry) {
          return;
        }
        await this.logs.loadContent(entry.id);
      }

      if (this.selectedContentError() !== null) {
        return;
      }
      content = this.selectedContent();
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = isMerged
      ? buildMergedDownloadFileName(new Date())
      : (selectedEntries[0]?.blobName ?? 'log.txt');
    link.click();
    URL.revokeObjectURL(downloadUrl);

    this.messageService.add({
      severity: 'success',
      summary: this.i18n.translate('logs.detail.toast.downloadComplete'),
      detail: isMerged
        ? this.i18n.translate('logs.detail.toast.downloadedMerged', {
            name: link.download,
          })
        : this.i18n.translate('logs.detail.toast.downloaded', {
            name: selectedEntries[0]?.blobName ?? link.download,
          }),
      life: 2500,
    });
  }

  private async handleConnectionChange(
    connectionId: string | null,
    routeLoadToken: number,
  ): Promise<void> {
    this.resetPageState();
    if (!connectionId) {
      return;
    }

    await this.ensureConnectionsLoaded();
    if (!this.isActiveRouteLoad(routeLoadToken)) {
      return;
    }

    const connection = this.connectionsService.getById(connectionId);
    if (!connection) {
      this.currentConnection.set(null);
      this.logs.setError(this.i18n.translate('logs.page.connectionNotFound'));
      return;
    }

    if (!connection.storageAccountName || !connection.containerName) {
      this.currentConnection.set(null);
      this.logs.setError(this.i18n.translate('logs.page.connectionIncomplete'));
      return;
    }

    this.currentConnection.set(connection);

    await this.logs.loadForConnection(
      connection.storageAccountName,
      connection.containerName,
    );
    if (!this.isActiveRouteLoad(routeLoadToken) || this.logs.status() !== 'success') {
      return;
    }

    this.sidebarLastUpdatedAt.set(new Date());
  }

  private async updateSelection(id: string, additive: boolean): Promise<void> {
    const result = await this.logs.updateSelection(id, additive);
    this.showSelectionMessage(result);
  }

  private resetPageState(): void {
    this.logs.reset();
    this.currentConnection.set(null);
    this.sidebarLastUpdatedAt.set(null);
    this.sidebarRefreshing.set(false);
    this.searchTerm.set('');
    this.sortDir.set('desc');
    this.sortBasis.set(this.settings.logs().sortBasis);
    this.createdOn.set(null);
    this.createdRange.set(null);
  }

  private async ensureConnectionsLoaded(): Promise<void> {
    if (this.connectionsService.status() === 'success') {
      return;
    }

    await this.connectionsService.load();
  }

  private formatSidebarUpdatedAt(value: Date): string {
    return this.i18n.formatDate(value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDetailTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return this.i18n.formatDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private isActiveRouteLoad(routeLoadToken: number): boolean {
    return routeLoadToken === this.routeLoadToken;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private formatProgressSize(bytes: number): string {
    return this.formatSize(bytes);
  }

  private showSelectionMessage(result: LogSelectionUpdateResult): void {
    if (result.kind === 'updated') {
      return;
    }

    if (result.kind === 'selection-limit') {
      this.messageService.add({
        severity: 'warn',
        summary: this.i18n.translate('logs.detail.toast.selectionLimitTitle'),
        detail: this.i18n.translate('logs.detail.toast.selectionLimitDetail', {
          max: result.maxFiles,
        }),
        life: 3000,
      });
      return;
    }

    this.messageService.add({
      severity: 'warn',
      summary: this.i18n.translate('logs.detail.toast.fileTooLargeTitle'),
      detail: this.i18n.translate('logs.detail.toast.fileTooLargeDetail', {
        name: result.fileName,
        maxSize: this.formatSize(result.maxSizeBytes),
      }),
      life: 3000,
    });
  }

  private buildLargeViewerSearchStatusLabel(): string {
    const matches = this.logs.largeViewerSearchMatches();
    const query = this.logs.largeViewerSearchQuery().trim();
    const isComplete = this.logs.largeViewerSearchIsComplete();
    const activeMatchLine = this.logs.largeViewerActiveMatchLine();
    if (query.length < MIN_CONTENT_SEARCH_QUERY_LENGTH) {
      return '';
    }
    if (matches.length === 0) {
      return isComplete
        ? this.i18n.translate('logs.detail.zeroMatches')
        : this.i18n.translate('logs.detail.viewer.searchPartialZero');
    }

    const activeMatchIndex = activeMatchLine === null
      ? 0
      : Math.max(
          matches.findIndex((match) => match.lineNumber === activeMatchLine),
          0,
        );

    return `${activeMatchIndex + 1} / ${matches.length}`;
  }
}

function hasFooterContent(footer: LogFooterVm): boolean {
  return Boolean(footer.typeLabel || footer.lineCountLabel || footer.lineEndingsLabel);
}

function buildMergedDownloadFileName(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `merged-logs-${year}${month}${day}-${hours}${minutes}${seconds}.txt`;
}

function startOfDayTimestamp(value: Date | null): number {
  if (!value) {
    return 0;
  }

  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function endOfDayExclusiveTimestamp(value: Date | null): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime() +
    24 * 60 * 60 * 1000
  );
}

function isCompleteCreatedRange(value: LogCreatedRange): value is [Date, Date] {
  return value !== null && value.length === 2;
}

function countLogicalLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.split(/\r\n|\n|\r/).length;
}

function detectLineEndings(content: string): 'cr' | 'crlf' | 'lf' | 'mixed' | 'none' {
  const hasCrLf = /\r\n/.test(content);
  const hasStandaloneLf = /(^|[^\r])\n/.test(content);
  const hasStandaloneCr = /\r(?!\n)/.test(content);
  const types = [hasCrLf, hasStandaloneLf, hasStandaloneCr].filter(Boolean).length;

  if (types === 0) {
    return 'none';
  }
  if (types > 1) {
    return 'mixed';
  }
  if (hasCrLf) {
    return 'crlf';
  }
  if (hasStandaloneLf) {
    return 'lf';
  }
  return 'cr';
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}
