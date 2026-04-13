import { Injectable, computed, signal } from '@angular/core';

import type { StorageConnection } from '../models/storage-connection.model';

type ConnectionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; connections: StorageConnection[] }
  | { status: 'error'; message: string };

const STORAGE_KEY = 'obsidian-console:connections';

function loadFromStorage(): StorageConnection[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StorageConnection[];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class ConnectionsService {
  private readonly state = signal<ConnectionsState>({ status: 'idle' });
  private readonly selectedId = signal<string | null>(null);

  readonly status = computed(() => this.state().status);

  readonly connections = computed(() => {
    const current = this.state();
    return current.status === 'success' ? current.connections : [];
  });

  readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.message : null;
  });

  readonly isEmpty = computed(
    () => this.status() === 'success' && this.connections().length === 0
  );

  readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.connections().find((c) => c.id === id) ?? null;
  });

  getById(id: string): StorageConnection | null {
    return this.connections().find((c) => c.id === id) ?? null;
  }

  async load(): Promise<void> {
    this.state.set({ status: 'loading' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = loadFromStorage();
    this.state.set({ status: 'success', connections: saved });
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  add(connection: StorageConnection): void {
    const current = this.state();
    if (current.status !== 'success') {
      this.state.set({ status: 'success', connections: [connection] });
    } else {
      this.state.set({
        status: 'success',
        connections: [...current.connections, connection],
      });
    }
    this.persist();
  }

  remove(id: string): void {
    const current = this.state();
    if (current.status !== 'success') return;
    this.state.set({
      status: 'success',
      connections: current.connections.filter((c) => c.id !== id),
    });
    this.persist();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.connections()));
  }
}
