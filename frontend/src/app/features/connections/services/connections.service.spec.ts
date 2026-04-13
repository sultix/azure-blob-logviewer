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

  it('falls back to an empty list when persisted data is invalid', async () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    await service.load();

    expect(service.status()).toBe('success');
    expect(service.connections()).toEqual([]);
    expect(service.isEmpty()).toBe(true);
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
