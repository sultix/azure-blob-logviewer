import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { StorageConnection } from '../models/storage-connection.model';

import { ConnectionsService } from './connections.service';

const STORAGE_KEY = 'obsidian-console:connections';

describe('ConnectionsService', () => {
  let service: ConnectionsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ConnectionsService],
    });
    service = TestBed.inject(ConnectionsService);
  });

  it('loads saved connections from localStorage', async () => {
    const saved = [createConnection({ id: 'conn-1', name: 'prod-logs' })];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await service.load();

    expect(service.status()).toBe('success');
    expect(service.connections()).toEqual(saved);
    expect(service.isEmpty()).toBe(false);
  });

  it('preserves optional categories when loading persisted connections', async () => {
    const saved = [createConnection({ id: 'conn-1', category: 'Operations' })];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await service.load();

    expect(service.connections()[0]?.category).toBe('Operations');
  });

  it('falls back to an empty list when persisted data is invalid', async () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    await service.load();

    expect(service.status()).toBe('success');
    expect(service.connections()).toEqual([]);
    expect(service.isEmpty()).toBe(true);
  });

  it('falls back to an empty list when persisted connections do not match the schema', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'conn-1' }]));

    await service.load();

    expect(service.connections()).toEqual([]);
  });

  it('adds a connection, persists it, and exposes selection helpers', () => {
    const connection = createConnection({ id: 'conn-1', name: 'prod-logs' });

    service.add(connection);
    service.select('conn-1');

    expect(service.status()).toBe('success');
    expect(service.connections()).toEqual([connection]);
    expect(service.selected()).toEqual(connection);
    expect(service.getById('conn-1')).toEqual(connection);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([connection]));
  });

  it('updates an existing connection, persists the changes, and keeps selection for the same id', () => {
    const original = createConnection({ id: 'conn-1', name: 'prod-logs' });
    service.add(original);
    service.select('conn-1');

    const updated = createConnection({
      id: 'conn-1',
      name: 'prod-archive',
      category: 'Operations',
      displayName: 'storage-b / archive',
      resourceGroup: 'rg-2',
      storageAccountName: 'storage-b',
      containerName: 'archive',
    });

    service.update(updated);

    expect(service.connections()).toEqual([updated]);
    expect(service.selected()).toEqual(updated);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([updated]));
  });

  it('removes a connection and persists the remaining list', async () => {
    const connections = [
      createConnection({ id: 'conn-1', name: 'prod-logs' }),
      createConnection({ id: 'conn-2', name: 'staging-logs' }),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    await service.load();

    service.remove('conn-1');

    expect(service.connections()).toEqual([connections[1]]);
    expect(service.getById('conn-1')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([connections[1]]));
  });

  it('replaces all saved connections and clears the selection when the selected id disappears', () => {
    service.add(createConnection({ id: 'conn-1' }));
    service.select('conn-1');

    const replacement = [createConnection({ id: 'conn-2', name: 'staging-logs' })];
    service.replaceAll(replacement);

    expect(service.connections()).toEqual(replacement);
    expect(service.selected()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(replacement));
  });

  it('imports valid connections JSON and replaces the existing list', () => {
    service.add(createConnection({ id: 'conn-1' }));

    const importedJson = JSON.stringify([
      createConnection({ id: 'conn-2', name: 'staging-logs', category: 'Operations' }),
    ]);

    const importedCount = service.importFromJson(importedJson);

    expect(importedCount).toBe(1);
    expect(service.connections()).toEqual([
      createConnection({ id: 'conn-2', name: 'staging-logs', category: 'Operations' }),
    ]);
  });

  it('rejects invalid JSON imports without overwriting the existing list', () => {
    const original = createConnection({ id: 'conn-1' });
    service.add(original);

    expect(() => service.importFromJson('{bad-json')).toThrowError('invalid_json');
    expect(service.connections()).toEqual([original]);
  });

  it('rejects duplicate ids in imported connections without overwriting the existing list', () => {
    const original = createConnection({ id: 'conn-1' });
    service.add(original);

    const duplicateJson = JSON.stringify([
      createConnection({ id: 'dup' }),
      createConnection({ id: 'dup', name: 'other' }),
    ]);

    expect(() => service.importFromJson(duplicateJson)).toThrowError('invalid_file');
    expect(service.connections()).toEqual([original]);
  });

  it('exports the current connections as formatted JSON', () => {
    const connection = createConnection({ id: 'conn-1' });
    service.add(connection);

    expect(service.exportJson()).toBe(JSON.stringify([connection], null, 2));
  });

  it('keeps selection null when no selected id is present', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([createConnection({ id: 'conn-1' })]));
    await service.load();

    expect(service.selected()).toBeNull();

    service.select('missing');

    expect(service.selected()).toBeNull();
  });
});

function createConnection(overrides: Partial<StorageConnection> = {}): StorageConnection {
  return {
    id: 'connection-1',
    name: 'prod-storage',
    displayName: 'storage / logs',
    environment: 'production',
    status: 'online',
    lastUsed: '2026-04-13T10:30:00Z',
    accessTier: 'Hot',
    stateText: 'Connected',
    containerCount: 1,
    subscriptionId: 'sub-1',
    resourceGroup: 'rg-1',
    storageAccountName: 'storage',
    containerName: 'logs',
    ...overrides,
  };
}
