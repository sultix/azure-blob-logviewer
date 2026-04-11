import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppApiService } from '@app/core/services/app-api.service';

import type { LogEntry } from '../models/log-entry.model';
import { LogsService } from './logs.service';

class AppApiServiceStub implements Partial<AppApiService> {
  listLogEntries = vi.fn<() => Promise<LogEntry[]>>();
}

describe('LogsService', () => {
  let service: LogsService;
  let api: AppApiServiceStub;

  beforeEach(() => {
    api = new AppApiServiceStub();
    TestBed.configureTestingModule({
      providers: [
        LogsService,
        { provide: AppApiService, useValue: api },
      ],
    });
    service = TestBed.inject(LogsService);
  });

  it('starts in the idle state', () => {
    expect(service.status()).toBe('idle');
    expect(service.entries()).toEqual([]);
    expect(service.selectedEntry()).toBeNull();
    expect(service.selectedContent()).toBe('');
  });

  it('transitions to success and exposes the loaded entries', async () => {
    const entries: LogEntry[] = [
      {
        id: 'a',
        container: 'logs',
        blobName: '2026/04/11/log.json',
        timestamp: '2026-04-11T00:00:00Z',
        size: 42,
      },
    ];
    api.listLogEntries.mockResolvedValue(entries);

    await service.load();

    expect(service.status()).toBe('success');
    expect(service.entries()).toEqual(entries);
    expect(service.errorMessage()).toBeNull();
  });

  it('falls back to stub entries when the api returns an empty list', async () => {
    api.listLogEntries.mockResolvedValue([]);

    await service.load();

    expect(service.status()).toBe('success');
    expect(service.entries().length).toBeGreaterThan(0);
  });

  it('captures an error message when the api fails', async () => {
    api.listLogEntries.mockRejectedValue(new Error('boom'));

    await service.load();

    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('boom');
  });

  it('selects an entry and loads its content', async () => {
    const entries: LogEntry[] = [
      {
        id: 'a',
        container: 'logs',
        blobName: 'file.log',
        timestamp: 'now',
        size: 1,
      },
    ];
    api.listLogEntries.mockResolvedValue(entries);
    await service.load();

    service.selectEntry('a');
    await service.loadContent('a');

    expect(service.selectedEntry()?.id).toBe('a');
    expect(service.selectedContent().length).toBeGreaterThan(0);
  });
});
