import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { SettingsPage } from './settings.page';
import { AzureService } from '../services/azure.service';
import { SettingsService } from '../services/settings.service';

class AzureServiceStub implements Partial<AzureService> {
  readonly authStep = signal<'disconnected' | 'authenticating' | 'authenticated' | 'error'>('disconnected');
  readonly authError = signal<string | null>(null);
  readonly azureCliMissing = signal(false);
  login = vi.fn<() => Promise<void>>(async () => undefined);
  logout = vi.fn<() => Promise<void>>(async () => undefined);
}

class SettingsServiceStub implements Partial<SettingsService> {
  readonly general = signal({
    refreshIntervalMinutes: 15,
    retentionPolicy: '30d' as const,
    language: 'en' as const,
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
        provideTranslateTesting(),
        { provide: AzureService, useValue: azure },
        { provide: SettingsService, useValue: new SettingsServiceStub() },
        { provide: ConnectionsService, useValue: connections },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(SettingsPage);
  });

  it('loads saved connections on init without triggering another auth startup check', () => {
    fixture.detectChanges();

    expect(connections.load).toHaveBeenCalledOnce();
  });

  it('updates TS-derived auth badge labels when the language changes', async () => {
    azure.authStep.set('authenticated');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('AUTHENTICATED');

    await TestBed.inject(AppI18nService).setLanguage('de');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('AUTHENTIFIZIERT');
  });

  it('shows the disconnected Azure CLI warning when the CLI is missing', () => {
    azure.azureCliMissing.set(true);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Azure CLI not found');
    expect(fixture.nativeElement.textContent).not.toContain('Make sure you have run az login in your terminal.');
  });
});
