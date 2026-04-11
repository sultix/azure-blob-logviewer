import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { LogsService } from '../services/logs.service';
import type { LogEntry } from '../models/log-entry.model';

type SortKey = 'name' | 'date' | 'size';

interface FileRowVm {
  id: string;
  blobName: string;
  timestamp: string;
  sizeLabel: string;
  isLive: boolean;
}

@Component({
  selector: 'app-logs-page',
  imports: [FormsModule],
  templateUrl: './logs.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPage implements OnInit {
  private readonly logs = inject(LogsService);
  private readonly route = inject(ActivatedRoute);

  readonly status = this.logs.status;
  readonly errorMessage = this.logs.errorMessage;
  readonly isEmpty = this.logs.isEmpty;
  readonly selectedContent = this.logs.selectedContent;
  readonly selectedEntry = this.logs.selectedEntry;

  readonly searchTerm = signal('');
  readonly sortKey = signal<SortKey>('date');
  readonly copyFeedback = signal<'idle' | 'copied'>('idle');

  readonly rows = computed<FileRowVm[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const key = this.sortKey();
    const list = this.logs.entries();
    const filtered = term
      ? list.filter((e) => e.blobName.toLowerCase().includes(term))
      : [...list];
    filtered.sort((a, b) => this.compareBy(a, b, key));
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

  readonly sortLabel = computed(() => {
    switch (this.sortKey()) {
      case 'name':
        return 'Name';
      case 'date':
        return 'Date';
      case 'size':
        return 'Size';
    }
  });

  ngOnInit(): void {
    void this.initialize();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  cycleSort(): void {
    const next: Record<SortKey, SortKey> = {
      date: 'name',
      name: 'size',
      size: 'date',
    };
    this.sortKey.set(next[this.sortKey()]);
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
      this.copyFeedback.set('copied');
      setTimeout(() => this.copyFeedback.set('idle'), 1500);
    } catch {
      this.copyFeedback.set('idle');
    }
  }

  private async initialize(): Promise<void> {
    await this.logs.load();
    const entries = this.logs.entries();
    if (entries.length === 0) return;
    const requestedId = this.route.snapshot.paramMap.get('connectionId');
    const match = requestedId
      ? entries.find((e) => e.id === requestedId)
      : undefined;
    this.logs.selectEntry((match ?? entries[0]).id);
  }

  private compareBy(a: LogEntry, b: LogEntry, key: SortKey): number {
    if (key === 'name') return a.blobName.localeCompare(b.blobName);
    if (key === 'size') return b.size - a.size;
    return a.timestamp.localeCompare(b.timestamp) * -1;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
