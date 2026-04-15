import { Injectable, computed, signal } from '@angular/core';

import type { StorageConnection } from '../models/storage-connection.model';

type ConnectionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; connections: StorageConnection[] }
  | { status: 'error'; message: string };

const STORAGE_KEY = 'obsidian-console:connections';

const ENVIRONMENTS = ['production', 'staging', 'development', 'test'] as const;
const CONNECTION_STATUSES = ['online', 'offline', 'syncing', 'error'] as const;
const ACCESS_TIERS = ['Hot', 'Cool', 'Archive'] as const;

export type ConnectionsImportErrorCode = 'invalid_json' | 'invalid_file';

export class ConnectionsImportError extends Error {
  constructor(readonly code: ConnectionsImportErrorCode) {
    super(code);
    this.name = 'ConnectionsImportError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRequiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConnectionsImportError('invalid_file');
  }
  return value;
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConnectionsImportError('invalid_file');
  }
  return value;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ConnectionsImportError('invalid_file');
  }
  return value;
}

function parseEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ConnectionsImportError('invalid_file');
  }
  return value as T[number];
}

function parseConnection(value: unknown): StorageConnection {
  if (!isRecord(value)) {
    throw new ConnectionsImportError('invalid_file');
  }

  return {
    id: parseRequiredString(value['id']),
    name: parseRequiredString(value['name']),
    category: parseOptionalString(value['category']),
    displayName: parseRequiredString(value['displayName']),
    environment: parseEnum(value['environment'], ENVIRONMENTS),
    status: parseEnum(value['status'], CONNECTION_STATUSES),
    lastUsed: parseRequiredString(value['lastUsed']),
    accessTier: parseEnum(value['accessTier'], ACCESS_TIERS),
    stateText: parseRequiredString(value['stateText']),
    containerCount: parseOptionalNumber(value['containerCount']),
    subscriptionId: parseOptionalString(value['subscriptionId']),
    resourceGroup: parseOptionalString(value['resourceGroup']),
    storageAccountName: parseOptionalString(value['storageAccountName']),
    containerName: parseOptionalString(value['containerName']),
  };
}

function parseConnectionsPayload(value: unknown): StorageConnection[] {
  if (!Array.isArray(value)) {
    throw new ConnectionsImportError('invalid_file');
  }

  const ids = new Set<string>();
  return value.map((entry) => {
    const connection = parseConnection(entry);
    if (ids.has(connection.id)) {
      throw new ConnectionsImportError('invalid_file');
    }
    ids.add(connection.id);
    return connection;
  });
}

function parseConnectionsJson(json: string): StorageConnection[] {
  try {
    return parseConnectionsPayload(JSON.parse(json) as unknown);
  } catch (error) {
    if (error instanceof ConnectionsImportError) {
      throw error;
    }
    throw new ConnectionsImportError('invalid_json');
  }
}

function loadFromStorage(): StorageConnection[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseConnectionsJson(raw);
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

  replaceAll(connections: StorageConnection[]): void {
    this.state.set({ status: 'success', connections: [...connections] });
    const selectedId = this.selectedId();
    if (selectedId && !connections.some((connection) => connection.id === selectedId)) {
      this.selectedId.set(null);
    }
    this.persist();
  }

  importFromJson(json: string): number {
    const connections = parseConnectionsJson(json);
    this.replaceAll(connections);
    return connections.length;
  }

  exportJson(): string {
    return JSON.stringify(this.connections(), null, 2);
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
