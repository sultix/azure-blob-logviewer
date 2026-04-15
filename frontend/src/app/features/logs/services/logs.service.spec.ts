import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppApiService } from '@app/core/services/app-api.service';
import type { AzureBlobItem } from '@app/features/settings/models/azure.model';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { LogsService } from './logs.service';

class AppApiServiceStub implements Partial<AppApiService> {
  listBlobs = vi.fn<() => Promise<AzureBlobItem[]>>();
  downloadBlobContent = vi.fn<() => Promise<string>>();
}

describe('LogsService', () => {
  let service: LogsService;
  let api: AppApiServiceStub;

  beforeEach(async () => {
    api = new AppApiServiceStub();
    await TestBed.configureTestingModule({
      providers: [
        provideTranslateTesting(),
        LogsService,
        { provide: AppApiService, useValue: api },
      ],
    }).compileComponents();
    await initializeI18nForTests();
    service = TestBed.inject(LogsService);
  });

  it('starts in the idle state', () => {
    expect(service.status()).toBe('idle');
    expect(service.entries()).toEqual([]);
    expect(service.selectedEntry()).toBeNull();
    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.selectedContentError()).toBeNull();
  });

  it('transitions to success and exposes the loaded entries', async () => {
    const blobs: AzureBlobItem[] = [
      {
        name: '2026/04/11/log.json',
        size: 42,
        contentType: 'application/json',
        lastModified: '2026-04-11T00:00:00Z',
        blobType: 'BlockBlob',
      },
    ];
    api.listBlobs.mockResolvedValue(blobs);

    await service.loadForConnection('myaccount', 'logs');

    expect(service.status()).toBe('success');
    expect(service.entries().length).toBe(1);
    expect(service.entries()[0].blobName).toBe('2026/04/11/log.json');
    expect(service.entries()[0].contentType).toBe('application/json');
    expect(service.errorMessage()).toBeNull();
  });

  it('sets empty entries when the api returns an empty list', async () => {
    api.listBlobs.mockResolvedValue([]);

    await service.loadForConnection('myaccount', 'logs');

    expect(service.status()).toBe('success');
    expect(service.entries().length).toBe(0);
  });

  it('captures an error message when the api fails', async () => {
    api.listBlobs.mockRejectedValue(new Error('boom'));

    await service.loadForConnection('myaccount', 'logs');

    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('boom');
  });

  it('ignores a stale blob list response from a previous connection load', async () => {
    const firstLoad = createDeferred<AzureBlobItem[]>();
    const secondLoad = createDeferred<AzureBlobItem[]>();
    api.listBlobs
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);

    const firstPromise = service.loadForConnection('myaccount', 'logs');
    const secondPromise = service.loadForConnection('myaccount', 'archive');

    secondLoad.resolve([
      {
        name: 'archive.log',
        size: 12,
        contentType: 'text/plain',
        lastModified: '2026-04-12T00:00:00Z',
        blobType: 'BlockBlob',
      },
    ]);
    await secondPromise;

    firstLoad.resolve([
      {
        name: 'stale.log',
        size: 7,
        contentType: 'text/plain',
        lastModified: '2026-04-11T00:00:00Z',
        blobType: 'BlockBlob',
      },
    ]);
    await firstPromise;

    expect(service.status()).toBe('success');
    expect(service.entries()).toHaveLength(1);
    expect(service.entries()[0].blobName).toBe('archive.log');
    expect(service.entries()[0].containerName).toBe('archive');
  });

  it('selects an entry and loads its content', async () => {
    const blobs: AzureBlobItem[] = [
      {
        name: 'file.log',
        size: 1,
        contentType: 'text/plain',
        lastModified: '2026-04-11T00:00:00Z',
        blobType: 'BlockBlob',
      },
    ];
    api.listBlobs.mockResolvedValue(blobs);
    api.downloadBlobContent.mockResolvedValue('log line 1\nlog line 2');

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await service.loadContent('file.log');

    expect(service.selectedEntry()?.id).toBe('file.log');
    expect(service.selectedContent()).toBe('log line 1\nlog line 2');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(service.selectedContentError()).toBeNull();
  });

  it('tracks content loading errors separately from the rendered content', async () => {
    const blobs: AzureBlobItem[] = [
      {
        name: 'file.log',
        size: 1,
        contentType: 'text/plain',
        lastModified: '2026-04-11T00:00:00Z',
        blobType: 'BlockBlob',
      },
    ];
    api.listBlobs.mockResolvedValue(blobs);
    api.downloadBlobContent.mockRejectedValue(new Error('network failed'));

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('file.log');
    await Promise.resolve();
    await Promise.resolve();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.selectedContentError()).toBe('Error loading content: network failed');
  });

  it('ignores stale content responses from the previous connection and keeps loading active for the current selection', async () => {
    const sharedBlob: AzureBlobItem = {
      name: 'shared.log',
      size: 1,
      contentType: 'text/plain',
      lastModified: '2026-04-11T00:00:00Z',
      blobType: 'BlockBlob',
    };
    const previousContent = createDeferred<string>();
    const currentContent = createDeferred<string>();

    api.listBlobs
      .mockResolvedValueOnce([sharedBlob])
      .mockResolvedValueOnce([sharedBlob]);
    api.downloadBlobContent
      .mockImplementationOnce(() => previousContent.promise)
      .mockImplementationOnce(() => currentContent.promise);

    await service.loadForConnection('myaccount', 'logs');
    service.selectEntry('shared.log');
    await flushAsync();

    await service.loadForConnection('myaccount', 'archive');
    service.selectEntry('shared.log');
    await flushAsync();

    previousContent.resolve('stale content');
    await flushAsync();

    expect(service.selectedContent()).toBe('');
    expect(service.selectedContentLoaded()).toBe(false);
    expect(service.contentLoading()).toBe(true);

    currentContent.resolve('fresh content');
    await flushAsync();

    expect(service.selectedEntry()?.containerName).toBe('archive');
    expect(service.selectedContent()).toBe('fresh content');
    expect(service.selectedContentLoaded()).toBe(true);
    expect(service.contentLoading()).toBe(false);
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
