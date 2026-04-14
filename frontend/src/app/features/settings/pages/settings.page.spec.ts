import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import { ConnectionsService } from '@app/features/connections/services/connections.service';

import { SettingsPage } from './settings.page';
import { AzureService } from '../services/azure.service';
import { SettingsService } from '../services/settings.service';

class AzureServiceStub implements Partial<AzureService> {
  readonly authStep = signal<'disconnected' | 'authenticating' | 'authenticated' | 'error'>('disconnected');
  readonly authError = signal<string | null>(null);
  login = vi.fn<() => Promise<void>>(async () => undefined);
  logout = vi.fn<() => Promise<void>>(async () => undefined);
}

class SettingsServiceStub implements Partial<SettingsService> {
  readonly general = signal({
    refreshIntervalMinutes: 15,
    retentionPolicy: '30d' as const,
  });
  updateGeneral = vi.fn();
  reset = vi.fn();
}

class ConnectionsServiceStub implements Partial<ConnectionsService> {
  readonly connections = computed(() => []);
  load = vi.fn<() => Promise<void>>(async () => undefined);
  remove = vi.fn<(id: string) => void>();
}

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let azure: AzureServiceStub;
  let connections: ConnectionsServiceStub;

  beforeEach(async () => {
    azure = new AzureServiceStub();
    connections = new ConnectionsServiceStub();

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: AzureService, useValue: azure },
        { provide: SettingsService, useValue: new SettingsServiceStub() },
        { provide: ConnectionsService, useValue: connections },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
  });

  it('loads saved connections on init without triggering another auth startup check', () => {
    fixture.detectChanges();

    expect(connections.load).toHaveBeenCalledOnce();
  });
});
