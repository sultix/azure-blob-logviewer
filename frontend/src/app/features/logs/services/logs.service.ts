import { Injectable, computed, inject, signal } from '@angular/core';

import { AppApiService } from '@app/core/services/app-api.service';

import type { LogEntry } from '../models/log-entry.model';

type LogsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; entries: LogEntry[] }
  | { status: 'error'; message: string };

const STUB_ENTRIES: LogEntry[] = [
  {
    id: 'production-api',
    container: 'prod-logs',
    blobName: 'production-api.log',
    path: '/var/logs/services/api/production-api.log',
    timestamp: 'Today, 14:22',
    size: 4_400_000,
    isLive: true,
    modifiedRelative: '2 min ago',
  },
  {
    id: 'auth-service-error',
    container: 'prod-logs',
    blobName: 'auth-service-error.log',
    path: '/var/logs/services/auth/auth-service-error.log',
    timestamp: 'Today, 09:15',
    size: 128_000,
    modifiedRelative: '5 hr ago',
  },
  {
    id: 'database-worker-01',
    container: 'prod-logs',
    blobName: 'database-worker-01.log',
    path: '/var/logs/workers/database-worker-01.log',
    timestamp: 'Yesterday, 23:59',
    size: 15_700_000,
    modifiedRelative: '14 hr ago',
  },
  {
    id: 'redis-cache',
    container: 'prod-logs',
    blobName: 'redis-cache.log',
    path: '/var/logs/cache/redis-cache.log',
    timestamp: 'Oct 24, 2023',
    size: 842_000,
    modifiedRelative: '6 months ago',
  },
  {
    id: 'nginx-access',
    container: 'prod-logs',
    blobName: 'nginx-access.log.0.gz',
    path: '/var/logs/nginx/nginx-access.log.0.gz',
    timestamp: 'Oct 23, 2023',
    size: 1_200_000_000,
    modifiedRelative: '6 months ago',
  },
];

const STUB_CONTENT = `1024  2026-04-11T14:22:01.142Z  [INFO]  Incoming request POST /api/v1/ingest {actor: "svc-collector"}
1025  2026-04-11T14:22:01.187Z  [INFO]  Validated payload size=842.1 KB batches=3
1026  2026-04-11T14:22:01.201Z  [INFO]  Dispatch to queue "logs.primary" partition=4
1027  2026-04-11T14:22:01.208Z  [WARN]  Backpressure signal from partition=4 depth=1042
1028  2026-04-11T14:22:01.214Z  [INFO]  Applied throttling policy throttle.v2
1029  2026-04-11T14:22:01.309Z  [ERR!]  BlobLeaseConflict container="prod-logs" blob="chunk-0042.jsonl"
1030  2026-04-11T14:22:01.311Z  [INFO]  Retry scheduled attempt=1 backoff=250ms
1031  2026-04-11T14:22:01.562Z  [INFO]  Retry succeeded attempt=1 duration=179ms
1032  2026-04-11T14:22:01.584Z  [INFO]  Persisted chunk-0042.jsonl bytes=842154
1033  2026-04-11T14:22:01.590Z  [INFO]  ACK sent to svc-collector corr-id=1b7e-a4f2-0091
1034  2026-04-11T14:22:01.602Z  [INFO]  Batch complete elapsed=460ms
-- Waiting for further events --`;

@Injectable({ providedIn: 'root' })
export class LogsService {
  private readonly api = inject(AppApiService);

  private readonly state = signal<LogsState>({ status: 'idle' });
  private readonly selectedEntryId = signal<string | null>(null);
  private readonly contentMap = signal<Record<string, string>>({});

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

  async load(): Promise<void> {
    this.state.set({ status: 'loading' });
    try {
      const entries = await this.api.listLogEntries();
      const final = entries.length > 0 ? entries : STUB_ENTRIES;
      this.state.set({ status: 'success', entries: final });
    } catch (error) {
      this.state.set({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to load log entries',
      });
    }
  }

  selectEntry(id: string | null): void {
    this.selectedEntryId.set(id);
    if (id && !this.contentMap()[id]) {
      void this.loadContent(id);
    }
  }

  // TODO: replace stub with AppApiService.getLogContent() once backend lands.
  async loadContent(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.contentMap.update((map) => ({ ...map, [id]: STUB_CONTENT }));
  }

  async refreshContent(): Promise<void> {
    const id = this.selectedEntryId();
    if (!id) return;
    await this.loadContent(id);
  }
}
