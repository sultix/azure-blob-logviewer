import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import type { OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MessageService } from "primeng/api";
import { distinctUntilChanged, map } from "rxjs";

import { AppI18nService } from "@app/core/i18n/app-i18n.service";
import { ConnectionsService } from "@app/features/connections/services/connections.service";

import { LogsDetailPanelComponent } from "../components/logs-detail-panel/logs-detail-panel.component";
import { LogsFileListComponent } from "../components/logs-file-list/logs-file-list.component";
import { LogsFiltersComponent } from "../components/logs-filters/logs-filters.component";
import type {
  LogFileRowVm,
  LogFooterVm,
  LogLargeViewerVm,
  LogToolbarVm,
} from "../models/logs-view.model";
import { LogsService } from "../services/logs.service";

type SortDir = "asc" | "desc";

interface PreparedLogFileRowVm extends LogFileRowVm {
  readonly blobNameLower: string;
  readonly lastModifiedTs: number;
}

interface ContentFooterStatsVm {
  readonly lineCountLabel: string;
  readonly lineEndingsLabel: string;
}

const LOG_VIRTUAL_LINE_HEIGHT_PX = 20;

@Component({
  selector: "app-logs-page",
  imports: [
    LogsFiltersComponent,
    LogsFileListComponent,
    LogsDetailPanelComponent,
  ],
  providers: [LogsService],
  templateUrl: "./logs.page.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPage implements OnInit {
  private readonly logs = inject(LogsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly connectionsService = inject(ConnectionsService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(AppI18nService);
  private routeLoadToken = 0;

  readonly status = this.logs.status;
  readonly errorMessage = this.logs.errorMessage;
  readonly isEmpty = this.logs.isEmpty;
  readonly selectedContent = this.logs.selectedContent;
  readonly selectedContentLoaded = this.logs.selectedContentLoaded;
  readonly selectedContentError = this.logs.selectedContentError;
  readonly selectedEntry = this.logs.selectedEntry;
  readonly contentLoading = this.logs.contentLoading;
  readonly isLargeBlob = this.logs.isLargeBlob;
  readonly largeViewerStatus = this.logs.largeViewerStatus;

  readonly searchTerm = signal("");
  readonly sortDir = signal<SortDir>("desc");
  readonly dateFrom = signal<Date | null>(null);
  readonly dateUntil = signal<Date | null>(null);

  readonly preparedRows = computed<PreparedLogFileRowVm[]>(() =>
    this.logs.entries().map((entry) => ({
      id: entry.id,
      blobName: entry.blobName,
      blobNameLower: entry.blobName.toLowerCase(),
      timestamp: entry.timestamp,
      sizeLabel: this.formatSize(entry.size),
      isLive: entry.isLive === true,
      lastModifiedTs: toTimestamp(entry.lastModified),
    })),
  );

  readonly rows = computed<LogFileRowVm[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const dir = this.sortDir();
    const start = startOfDayTimestamp(this.dateFrom());
    const end = endOfDayExclusiveTimestamp(this.dateUntil());

    const filteredRows = this.preparedRows().filter((row) => {
      if (term && !row.blobNameLower.includes(term)) {
        return false;
      }

      return row.lastModifiedTs >= start && row.lastModifiedTs < end;
    });

    const mult = dir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const dateCmp = a.lastModifiedTs - b.lastModifiedTs;
      if (dateCmp !== 0) {
        return dateCmp * mult;
      }

      return a.blobNameLower.localeCompare(b.blobNameLower) * mult;
    });
  });

  readonly toolbar = computed<LogToolbarVm | null>(() => {
    const entry = this.selectedEntry();
    if (!entry) return null;
    return {
      blobName: entry.blobName,
      path: entry.path ?? `/${entry.container}/${entry.blobName}`,
      sizeLabel: this.formatSize(entry.size),
      modified: entry.modifiedRelative ?? entry.timestamp,
    };
  });

  readonly sortLabel = computed(() =>
    this.sortDir() === "desc"
      ? this.i18n.translate('logs.filters.newestFirst')
      : this.i18n.translate('logs.filters.oldestFirst'),
  );
  readonly selectedEntryId = computed(() => this.selectedEntry()?.id ?? null);
  readonly hasSelectedEntry = computed(() => this.selectedEntry() !== null);
  readonly sidebarLoading = computed(() => this.status() === "loading");
  readonly largeViewer = computed<LogLargeViewerVm | null>(() => {
    const status = this.largeViewerStatus();
    if (!status) {
      return null;
    }

    const lines = this.logs.largeViewerLines();
    const viewportStartLine = this.logs.largeViewerViewportStartLine();
    const totalLines = this.logs.largeViewerTotalLines();
    const topSpacerPx = viewportStartLine * LOG_VIRTUAL_LINE_HEIGHT_PX;
    const bottomSpacerPx = Math.max(
      totalLines - viewportStartLine - lines.length,
      0,
    ) * LOG_VIRTUAL_LINE_HEIGHT_PX;

    return {
      progressLabel: this.i18n.translate("logs.detail.viewer.progress", {
        loaded: this.formatProgressSize(status.bytesDownloaded),
        total: this.formatProgressSize(status.blobSize),
      }),
      statusLabel: status.isComplete
        ? this.i18n.translate("logs.detail.viewer.complete")
        : this.i18n.translate("logs.detail.viewer.backgroundLoading"),
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
        ? this.i18n.translate("logs.detail.viewer.pendingBefore")
        : null,
      pendingAfterLabel: status.hasPendingAfter
        ? this.i18n.translate("logs.detail.viewer.pendingAfter")
        : null,
      canEnableWordWrap: status.canEnableWordWrap,
      downloadDisabled: !status.isComplete,
    };
  });
  readonly downloadDisabled = computed(() => this.largeViewer()?.downloadDisabled ?? false);
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
          ? "logs.detail.footer.linesWindow"
          : "logs.detail.footer.lines",
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
    const entry = this.selectedEntry();
    if (!entry) {
      return null;
    }

    const footer: LogFooterVm = {};
    if (entry.contentType?.trim()) {
      footer.typeLabel = `${entry.contentType}`;
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
        map((paramMap) => paramMap.get("connectionId")),
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
    this.sortDir.set(this.sortDir() === "desc" ? "asc" : "desc");
  }

  onDateFromChange(value: Date | null): void {
    this.dateFrom.set(value);
  }

  onDateUntilChange(value: Date | null): void {
    this.dateUntil.set(value);
  }

  clearFilters(): void {
    this.dateFrom.set(null);
    this.dateUntil.set(null);
  }

  select(id: string): void {
    this.logs.selectEntry(id);
  }

  refresh(): void {
    void this.logs.refreshContent();
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

  async download(): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry || this.contentLoading()) {
      return;
    }

    if (this.isLargeBlob()) {
      const exported = await this.logs.exportLargeViewer();
      if (!exported) {
        return;
      }

      this.messageService.add({
        severity: "success",
        summary: this.i18n.translate('logs.detail.toast.downloadComplete'),
        detail: this.i18n.translate('logs.detail.toast.downloaded', {
          name: entry.blobName,
        }),
        life: 2500,
      });
      return;
    }

    let content = this.selectedContent();
    if (!this.selectedContentLoaded()) {
      await this.logs.loadContent(entry.id);
      if (this.selectedContentError() !== null) {
        return;
      }
      content = this.selectedContent();
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = entry.blobName;
    link.click();
    URL.revokeObjectURL(downloadUrl);

    this.messageService.add({
      severity: "success",
      summary: this.i18n.translate('logs.detail.toast.downloadComplete'),
      detail: this.i18n.translate('logs.detail.toast.downloaded', {
        name: entry.blobName,
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
      this.logs.setError(this.i18n.translate("logs.page.connectionNotFound"));
      return;
    }

    if (!connection.storageAccountName || !connection.containerName) {
      this.logs.setError(this.i18n.translate("logs.page.connectionIncomplete"));
      return;
    }

    await this.logs.loadForConnection(
      connection.storageAccountName,
      connection.containerName,
    );
    if (!this.isActiveRouteLoad(routeLoadToken) || this.logs.status() !== "success") {
      return;
    }

    const firstVisibleRow = this.rows()[0];
    if (firstVisibleRow) {
      this.logs.selectEntry(firstVisibleRow.id);
    }
  }

  private resetPageState(): void {
    this.logs.reset();
    this.searchTerm.set("");
    this.sortDir.set("desc");
    this.dateFrom.set(null);
    this.dateUntil.set(null);
  }

  private async ensureConnectionsLoaded(): Promise<void> {
    if (this.connectionsService.status() === "success") {
      return;
    }

    await this.connectionsService.load();
  }

  private isActiveRouteLoad(routeLoadToken: number): boolean {
    return routeLoadToken === this.routeLoadToken;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private formatProgressSize(bytes: number): string {
    return this.formatSize(bytes);
  }

  private buildLargeViewerSearchStatusLabel(): string {
    const matches = this.logs.largeViewerSearchMatches();
    const query = this.logs.largeViewerSearchQuery().trim();
    const isComplete = this.logs.largeViewerSearchIsComplete();
    if (query.length === 0) {
      return "";
    }
    if (matches.length === 0) {
      return isComplete
        ? this.i18n.translate('logs.detail.zeroMatches')
        : this.i18n.translate('logs.detail.viewer.searchPartialZero');
    }
    return isComplete
      ? this.i18n.translate('logs.detail.viewer.matches', { count: matches.length })
      : this.i18n.translate('logs.detail.viewer.matchesPartial', { count: matches.length });
  }
}

function hasFooterContent(footer: LogFooterVm): boolean {
  return Boolean(
    footer.typeLabel || footer.lineCountLabel || footer.lineEndingsLabel,
  );
}

function startOfDayTimestamp(value: Date | null): number {
  if (!value) {
    return 0;
  }

  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

function endOfDayExclusiveTimestamp(value: Date | null): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
    ).getTime() +
    24 * 60 * 60 * 1000
  );
}

function countLogicalLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.split(/\r\n|\n|\r/).length;
}

function detectLineEndings(
  content: string,
): "cr" | "crlf" | "lf" | "mixed" | "none" {
  const hasCrLf = /\r\n/.test(content);
  const hasStandaloneLf = /(^|[^\r])\n/.test(content);
  const hasStandaloneCr = /\r(?!\n)/.test(content);
  const types = [hasCrLf, hasStandaloneLf, hasStandaloneCr].filter(
    Boolean,
  ).length;

  if (types === 0) {
    return "none";
  }
  if (types > 1) {
    return "mixed";
  }
  if (hasCrLf) {
    return "crlf";
  }
  if (hasStandaloneLf) {
    return "lf";
  }
  return "cr";
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}
