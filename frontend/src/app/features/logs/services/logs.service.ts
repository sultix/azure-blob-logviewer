import { Injectable, computed, inject, signal } from '@angular/core';

import { AppApiService } from '@app/core/services/app-api.service';
import type { AzureBlobItem } from '@app/features/settings/models/azure.model';

import type { LogEntry } from '../models/log-entry.model';

type LogsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; entries: LogEntry[] }
  | { status: 'error'; message: string };

@Injectable({ providedIn: 'root' })
export class LogsService {
  private readonly api = inject(AppApiService);

  private readonly state = signal<LogsState>({ status: 'idle' });
  private readonly selectedEntryId = signal<string | null>(null);
  private readonly contentMap = signal<Record<string, string>>({});
  private readonly _contentLoading = signal(false);

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
    () => this.status() === 'success' && this.entries().length === 0
  );

  readonly selectedEntry = computed<LogEntry | null>(() => {
    const id = this.selectedEntryId();
    if (!id) return null;
    return this.entries().find((e) => e.id === id) ?? null;
  });

  readonly selectedContent = computed<string>(() => {
    const id = this.selectedEntryId();
    if (!id) return '';
    return this.contentMap()[id] ?? '';
  });

  readonly contentLoading = this._contentLoading.asReadonly();

  async loadForConnection(accountName: string, containerName: string): Promise<void> {
    this.state.set({ status: 'loading' });
    this.selectedEntryId.set(null);
    this.contentMap.set({});

    try {
      console.log('[LogsService] calling listBlobs:', accountName, containerName);
      const blobs = await this.api.listBlobs(accountName, containerName, '');
      console.log('[LogsService] blobs returned:', blobs.length, blobs);
      const entries = blobs.map((b) => this.mapBlobToEntry(b, accountName, containerName));
      this.state.set({ status: 'success', entries });
    } catch (error) {
      console.error('[LogsService] error loading blobs:', error);
      this.state.set({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load blobs',
      });
    }
  }

  selectEntry(id: string | null): void {
    this.selectedEntryId.set(id);
    if (id && !this.contentMap()[id]) {
      void this.loadContent(id);
    }
  }

  async loadContent(id: string): Promise<void> {
    const entry = this.entries().find((e) => e.id === id);
    if (!entry?.storageAccountName || !entry?.containerName) return;

    this._contentLoading.set(true);
    try {
      const content = await this.api.downloadBlobContent(
        entry.storageAccountName,
        entry.containerName,
        entry.blobName,
      );
      this.contentMap.update((map) => ({ ...map, [id]: content }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.contentMap.update((map) => ({ ...map, [id]: `Error loading content: ${message}` }));
    } finally {
      this._contentLoading.set(false);
    }
  }

  async refreshContent(): Promise<void> {
    const id = this.selectedEntryId();
    if (!id) return;
    this.contentMap.update((map) => {
      const next = { ...map };
      delete next[id];
      return next;
    });
    await this.loadContent(id);
  }

  private mapBlobToEntry(blob: AzureBlobItem, accountName: string, containerName: string): LogEntry {
    return {
      id: blob.name,
      container: containerName,
      blobName: blob.name,
      timestamp: this.formatTimestamp(blob.lastModified),
      lastModified: blob.lastModified,
      size: blob.size,
      path: `${accountName}/${containerName}/${blob.name}`,
      modifiedRelative: this.relativeTime(blob.lastModified),
      storageAccountName: accountName,
      containerName,
    };
  }

  private formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';

    const diffMs = Date.now() - then;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }
}
