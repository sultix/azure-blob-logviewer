import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { ButtonDirective } from "primeng/button";
import { DatePicker } from "primeng/datepicker";

import { ConnectionsService } from "@app/features/connections/services/connections.service";

import { LogsService } from "../services/logs.service";

type SortDir = "asc" | "desc";

interface FileRowVm {
  id: string;
  blobName: string;
  timestamp: string;
  sizeLabel: string;
  isLive: boolean;
}

@Component({
  selector: "app-logs-page",
  imports: [FormsModule, DatePicker, ButtonDirective],
  templateUrl: "./logs.page.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPage implements OnInit {
  private readonly logs = inject(LogsService);
  private readonly route = inject(ActivatedRoute);
  private readonly connectionsService = inject(ConnectionsService);

  readonly status = this.logs.status;
  readonly errorMessage = this.logs.errorMessage;
  readonly isEmpty = this.logs.isEmpty;
  readonly selectedContent = this.logs.selectedContent;
  readonly selectedEntry = this.logs.selectedEntry;
  readonly contentLoading = this.logs.contentLoading;

  readonly searchTerm = signal("");
  readonly sortDir = signal<SortDir>("desc");
  readonly dateFrom = signal<Date | null>(null);
  readonly dateUntil = signal<Date | null>(null);
  readonly copyFeedback = signal<"idle" | "copied">("idle");

  readonly rows = computed<FileRowVm[]>(() => {
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

  readonly toolbar = computed(() => {
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

  async copyContent(): Promise<void> {
    const text = this.selectedContent();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedback.set("copied");
      setTimeout(() => this.copyFeedback.set("idle"), 1500);
    } catch {
      this.copyFeedback.set("idle");
    }
  }

  private async initialize(): Promise<void> {
    const connectionId = this.route.snapshot.paramMap.get("connectionId");
    console.log("[LogsPage] connectionId from route:", connectionId);
    if (!connectionId) return;

    await this.connectionsService.load();
    const connection = this.connectionsService.getById(connectionId);
    console.log("[LogsPage] resolved connection:", connection);
    if (!connection?.storageAccountName || !connection?.containerName) {
      console.warn(
        "[LogsPage] connection missing storageAccountName or containerName",
      );
      return;
    }

    console.log(
      "[LogsPage] loading blobs for",
      connection.storageAccountName,
      connection.containerName,
    );
    await this.logs.loadForConnection(
      connection.storageAccountName,
      connection.containerName,
    );

    const entries = this.logs.entries();
    console.log("[LogsPage] loaded entries:", entries.length);
    if (entries.length > 0) {
      this.logs.selectEntry(entries[0].id);
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
