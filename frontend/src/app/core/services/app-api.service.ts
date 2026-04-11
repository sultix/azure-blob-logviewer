import { Injectable } from '@angular/core';

import type { LogEntry } from '@app/features/logs/models/log-entry.model';

export interface AppApi {
  getVersion(): Promise<string>;
  listLogEntries(): Promise<LogEntry[]>;
  getLogEntry(id: string): Promise<LogEntry | null>;
}

interface WailsAppBridge {
  GetVersion(): Promise<string>;
  ListLogEntries(): Promise<LogEntry[] | null>;
  GetLogEntry(id: string): Promise<LogEntry | null>;
}

interface WailsWindow {
  go?: {
    app?: {
      App?: WailsAppBridge;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class AppApiService implements AppApi {
  async getVersion(): Promise<string> {
    return this.bridge().GetVersion();
  }

  async listLogEntries(): Promise<LogEntry[]> {
    const result = await this.bridge().ListLogEntries();
    return result ?? [];
  }

  async getLogEntry(id: string): Promise<LogEntry | null> {
    return this.bridge().GetLogEntry(id);
  }

  private bridge(): WailsAppBridge {
    const bridge = (window as unknown as WailsWindow).go?.app?.App;
    if (!bridge) {
      throw new Error(
        'Wails bridge unavailable. Run `wails dev` to generate bindings.'
      );
    }
    return bridge;
  }
}
