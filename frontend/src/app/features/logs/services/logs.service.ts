import { Injectable, computed, inject, signal } from '@angular/core';

import { AppApiService } from '@app/core/services/app-api.service';

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

  async load(): Promise<void> {
    this.state.set({ status: 'loading' });
    try {
      const entries = await this.api.listLogEntries();
      this.state.set({ status: 'success', entries });
    } catch (error) {
      this.state.set({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to load log entries',
      });
    }
  }
}
