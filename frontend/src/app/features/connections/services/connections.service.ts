import { Injectable, computed, signal } from '@angular/core';

import type { StorageConnection } from '../models/storage-connection.model';

type ConnectionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; connections: StorageConnection[] }
  | { status: 'error'; message: string };

const STUB_CONNECTIONS: StorageConnection[] = [
  {
    id: 'az-prod-eus-logs',
    name: 'az-prod-eus-logs',
    displayName: 'Production East US',
    environment: 'production',
    status: 'online',
    lastUsed: '2026-04-11T13:58:00Z',
    accessTier: 'Hot',
    stateText: 'Syncing logs...',
    containerCount: 12,
  },
  {
    id: 'az-stage-weu-logs',
    name: 'az-stage-weu-logs',
    displayName: 'Staging West Europe',
    environment: 'staging',
    status: 'syncing',
    lastUsed: '2026-04-11T12:14:00Z',
    accessTier: 'Hot',
    stateText: 'Idle',
    containerCount: 8,
  },
  {
    id: 'az-dev-neu-logs',
    name: 'az-dev-neu-logs',
    displayName: 'Development North Europe',
    environment: 'development',
    status: 'online',
    lastUsed: '2026-04-10T18:02:00Z',
    accessTier: 'Cool',
    stateText: 'Idle',
    containerCount: 5,
  },
  {
    id: 'az-test-sea-logs',
    name: 'az-test-sea-logs',
    displayName: 'Test Southeast Asia',
    environment: 'test',
    status: 'offline',
    lastUsed: '2026-04-08T09:31:00Z',
    accessTier: 'Archive',
    stateText: 'Auth expired',
    containerCount: 3,
  },
];

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

  // TODO: replace stub with AppApiService.listConnections() once backend lands.
  async load(): Promise<void> {
    this.state.set({ status: 'loading' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.state.set({ status: 'success', connections: STUB_CONNECTIONS });
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  add(connection: StorageConnection): void {
    const current = this.state();
    if (current.status !== 'success') {
      this.state.set({ status: 'success', connections: [connection] });
      return;
    }
    this.state.set({
      status: 'success',
      connections: [...current.connections, connection],
    });
  }

  remove(id: string): void {
    const current = this.state();
    if (current.status !== 'success') return;
    this.state.set({
      status: 'success',
      connections: current.connections.filter((c) => c.id !== id),
    });
  }
}
