import { Injectable, computed, inject, signal } from '@angular/core';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { AppApiService } from '@app/core/services/app-api.service';
import type { AzureBlobItem } from '@app/features/settings/models/azure.model';

import type { LogEntry } from '../models/log-entry.model';

type LogsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; entries: LogEntry[] }
  | { status: 'error'; message: string };

@Injectable()
export class LogsService {
  private readonly api = inject(AppApiService);
  private readonly i18n = inject(AppI18nService);

  private readonly state = signal<LogsState>({ status: 'idle' });
  private readonly selectedEntryId = signal<string | null>(null);
  private readonly contentMap = signal<Record<string, string>>({});
  private readonly contentErrorMap = signal<Record<string, string>>({});
  private readonly _contentLoading = signal(false);
  private connectionLoadToken = 0;
  private contentLoadToken = 0;

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

  readonly selectedContentLoaded = computed<boolean>(() => {
    const id = this.selectedEntryId();
    if (!id) return false;
    return hasStoredContent(this.contentMap(), id);
  });

  readonly selectedContentError = computed<string | null>(() => {
    const id = this.selectedEntryId();
    if (!id) return null;
    return this.contentErrorMap()[id] ?? null;
  });

  readonly contentLoading = this._contentLoading.asReadonly();

  reset(): void {
    this.connectionLoadToken += 1;
    this.contentLoadToken += 1;
    this.state.set({ status: 'idle' });
    this.selectedEntryId.set(null);
    this.contentMap.set({});
    this.contentErrorMap.set({});
    this._contentLoading.set(false);
  }

  setError(message: string): void {
    this.connectionLoadToken += 1;
    this.contentLoadToken += 1;
    this.selectedEntryId.set(null);
    this.contentMap.set({});
    this.contentErrorMap.set({});
    this._contentLoading.set(false);
    this.state.set({ status: 'error', message });
  }

  async loadForConnection(accountName: string, containerName: string): Promise<void> {
    const token = ++this.connectionLoadToken;
    this.contentLoadToken += 1;
    this.state.set({ status: 'loading' });
    this.selectedEntryId.set(null);
    this.contentMap.set({});
    this.contentErrorMap.set({});
    this._contentLoading.set(false);

    try {
      const blobs = await this.api.listBlobs(accountName, containerName, '');
      if (token !== this.connectionLoadToken) {
        return;
      }

      const entries = blobs.map((b) => this.mapBlobToEntry(b, accountName, containerName));
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
    if (
      id &&
      !hasStoredContent(this.contentMap(), id) &&
      !hasStoredContent(this.contentErrorMap(), id)
    ) {
      void this.loadContent(id);
    }
  }

  async loadContent(id: string): Promise<void> {
    const entry = this.entries().find((e) => e.id === id);
    if (!entry?.storageAccountName || !entry?.containerName) return;

    const connectionLoadToken = this.connectionLoadToken;
    const contentLoadToken = ++this.contentLoadToken;
    this._contentLoading.set(true);
    this.contentErrorMap.update((map) => {
      const next = { ...map };
      delete next[id];
      return next;
    });
    try {
      const content = await this.api.downloadBlobContent(
        entry.storageAccountName,
        entry.containerName,
        entry.blobName,
      );
      if (
        connectionLoadToken !== this.connectionLoadToken ||
        contentLoadToken !== this.contentLoadToken
      ) {
        return;
      }

      this.contentMap.update((map) => ({ ...map, [id]: content }));
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
      this.contentErrorMap.update((map) => ({
        ...map,
        [id]: this.i18n.translate('logs.service.loadContentFailed', { message }),
      }));
    } finally {
      if (
        connectionLoadToken === this.connectionLoadToken &&
        contentLoadToken === this.contentLoadToken
      ) {
        this._contentLoading.set(false);
      }
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
    this.contentErrorMap.update((map) => {
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
      contentType: blob.contentType,
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

function hasStoredContent(map: Record<string, string>, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, id);
}
