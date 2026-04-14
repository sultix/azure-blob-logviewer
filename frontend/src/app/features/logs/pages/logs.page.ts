import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import type { OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MessageService } from "primeng/api";

import { ConnectionsService } from "@app/features/connections/services/connections.service";

import { LogsDetailPanelComponent } from "../components/logs-detail-panel.component";
import { LogsFileListComponent } from "../components/logs-file-list.component";
import { LogsFiltersComponent } from "../components/logs-filters.component";
import type {
  LogFileRowVm,
  LogFooterVm,
  LogsStatus,
  LogToolbarVm,
} from "../models/logs-view.model";
import { LogsService } from "../services/logs.service";

type SortDir = "asc" | "desc";

@Component({
  selector: "app-logs-page",
  imports: [
    LogsFiltersComponent,
    LogsFileListComponent,
    LogsDetailPanelComponent,
  ],
  templateUrl: "./logs.page.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPage implements OnInit {
  private readonly logs = inject(LogsService);
  private readonly route = inject(ActivatedRoute);
  private readonly connectionsService = inject(ConnectionsService);
  private readonly messageService = inject(MessageService);

  readonly status = this.logs.status;
  readonly errorMessage = this.logs.errorMessage;
  readonly isEmpty = this.logs.isEmpty;
  readonly selectedContent = this.logs.selectedContent;
  readonly selectedContentLoaded = this.logs.selectedContentLoaded;
  readonly selectedContentError = this.logs.selectedContentError;
  readonly selectedEntry = this.logs.selectedEntry;
  readonly contentLoading = this.logs.contentLoading;

  readonly searchTerm = signal("");
  readonly sortDir = signal<SortDir>("desc");
  readonly dateFrom = signal<Date | null>(null);
  readonly dateUntil = signal<Date | null>(null);

  readonly rows = computed<LogFileRowVm[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const dir = this.sortDir();
    const from = this.dateFrom();
    const until = this.dateUntil();
    const list = this.logs.entries();

    let filtered = term
      ? list.filter((e) => e.blobName.toLowerCase().includes(term))
      : [...list];

    if (from || until) {
      const start = from
        ? new Date(
            from.getFullYear(),
            from.getMonth(),
            from.getDate(),
          ).getTime()
        : 0;
      const end = until
        ? new Date(
            until.getFullYear(),
            until.getMonth(),
            until.getDate(),
          ).getTime() +
          24 * 60 * 60 * 1000
        : Infinity;
      filtered = filtered.filter((e) => {
        const t = new Date(e.lastModified).getTime();
        return t >= start && t < end;
      });
    }

    const mult = dir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const dateCmp = a.lastModified.localeCompare(b.lastModified);
      if (dateCmp !== 0) return dateCmp * mult;
      return a.blobName.localeCompare(b.blobName) * mult;
    });
    return filtered.map((e) => ({
      id: e.id,
      blobName: e.blobName,
      timestamp: e.timestamp,
      sizeLabel: this.formatSize(e.size),
      isLive: e.isLive === true,
    }));
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
    this.sortDir() === "desc" ? "Newest first" : "Oldest first",
  );
  readonly footer = computed<LogFooterVm | null>(() => {
    const entry = this.selectedEntry();
    if (!entry) {
      return null;
    }

    const footer: LogFooterVm = {};
    if (entry.contentType?.trim()) {
      footer.typeLabel = `${entry.contentType}`;
    }

    if (this.contentLoading() || this.selectedContentError() !== null) {
      return hasFooterContent(footer) ? footer : null;
    }

    const content = this.selectedContent();
    footer.lineCountLabel = `Lines: ${countLogicalLines(content)}`;
    footer.lineEndingsLabel = `${detectLineEndings(content)}`;

    return footer;
  });

  get statusValue(): LogsStatus {
    return this.status();
  }

  get errorMessageValue(): string | null {
    return this.errorMessage();
  }

  get selectedContentValue(): string {
    return this.selectedContent();
  }

  get contentLoadingValue(): boolean {
    return this.contentLoading();
  }

  get selectedContentErrorValue(): string | null {
    return this.selectedContentError();
  }

  get searchTermValue(): string {
    return this.searchTerm();
  }

  get sortLabelValue(): string {
    return this.sortLabel();
  }

  get isSortDescending(): boolean {
    return this.sortDir() === "desc";
  }

  get dateFromValue(): Date | null {
    return this.dateFrom();
  }

  get dateUntilValue(): Date | null {
    return this.dateUntil();
  }

  get rowsValue(): LogFileRowVm[] {
    return this.rows();
  }

  get selectedEntryIdValue(): string | null {
    return this.selectedEntry()?.id ?? null;
  }

  get hasSelectedEntry(): boolean {
    return this.selectedEntry() !== null;
  }

  get toolbarValue(): LogToolbarVm | null {
    return this.toolbar();
  }

  get footerValue(): LogFooterVm | null {
    return this.footer();
  }

  get sidebarLoading(): boolean {
    return this.statusValue === "loading";
  }

  ngOnInit(): void {
    void this.initialize();
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

  async download(): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry || this.contentLoading()) {
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
      summary: "Download complete",
      detail: `${entry.blobName} downloaded`,
      life: 2500,
    });
  }

  private async initialize(): Promise<void> {
    const connectionId = this.route.snapshot.paramMap.get("connectionId");
    if (!connectionId) return;

    await this.connectionsService.load();
    const connection = this.connectionsService.getById(connectionId);
    if (!connection?.storageAccountName || !connection?.containerName) {
      return;
    }

    await this.logs.loadForConnection(
      connection.storageAccountName,
      connection.containerName,
    );

    const firstVisibleRow = this.rows()[0];
    if (firstVisibleRow) {
      this.logs.selectEntry(firstVisibleRow.id);
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

function hasFooterContent(footer: LogFooterVm): boolean {
  return Boolean(
    footer.typeLabel || footer.lineCountLabel || footer.lineEndingsLabel,
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
): "CR" | "CRLF" | "LF" | "Mixed" | "None" {
  const hasCrLf = /\r\n/.test(content);
  const hasStandaloneLf = /(^|[^\r])\n/.test(content);
  const hasStandaloneCr = /\r(?!\n)/.test(content);
  const types = [hasCrLf, hasStandaloneLf, hasStandaloneCr].filter(
    Boolean,
  ).length;

  if (types === 0) {
    return "None";
  }
  if (types > 1) {
    return "Mixed";
  }
  if (hasCrLf) {
    return "CRLF";
  }
  if (hasStandaloneLf) {
    return "LF";
  }
  return "CR";
}
