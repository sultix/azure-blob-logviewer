import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { AppApiService } from '@app/core/services/app-api.service';
import { ConnectionsService } from '@app/features/connections/services/connections.service';
import { LogSortBasis } from '@app/features/logs/models/logs-view.model';
import {
  initializeI18nForTests,
  provideTranslateTesting,
} from '@app/testing/translate-testing';

import { SettingsPage } from './settings.page';
import type { GeneralConfig, LogsPreferences } from '../models/app-config.model';
import { AzureService } from '../services/azure.service';
import { SettingsService } from '../services/settings.service';

class AzureServiceStub implements Partial<AzureService> {
  readonly authStep = signal<
    'disconnected' | 'authenticating' | 'authenticated' | 'error'
  >('disconnected');
  readonly authError = signal<string | null>(null);
  readonly azureCliMissing = signal(false);
  login = vi.fn<() => Promise<void>>(async () => undefined);
  logout = vi.fn<() => Promise<void>>(async () => undefined);
}

class SettingsServiceStub implements Partial<SettingsService> {
  readonly general = signal<GeneralConfig>({
    refreshIntervalMinutes: 15,
    retentionPolicy: '30d' as const,
    language: 'en' as const,
    appearance: 'system' as const,
  });
  readonly logs = signal<LogsPreferences>({
    wordWrapEnabled: false,
    tailRefreshIntervalSeconds: 10,
    sortBasis: LogSortBasis.LastModified,
  });
  updateGeneral = vi.fn();
  updateLogsPreferences = vi.fn();
  reset = vi.fn();
}

class ConnectionsServiceStub implements Partial<ConnectionsService> {
  readonly connectionsState = signal([
    {
      id: 'conn-1',
      name: 'prod-storage',
      displayName: 'storage / logs',
      environment: 'production' as const,
      status: 'online' as const,
      lastUsed: '2026-04-13T10:30:00Z',
      accessTier: 'Hot' as const,
      stateText: 'Connected',
    },
  ]);
  readonly connections = computed(() => this.connectionsState());
  load = vi.fn<() => Promise<void>>(async () => undefined);
  importFromJson = vi.fn<(json: string) => number>(() => 1);
  exportJson = vi.fn<() => string>(() => '[\n  {}\n]');
}

class AppApiServiceStub implements Partial<AppApiService> {
  getVersion = vi.fn<() => Promise<string>>(async () => '0.1.1');
  importConnectionsFile = vi.fn<
    () => Promise<{ cancelled: boolean; content: string }>
  >(async () => ({
    cancelled: false,
    content: '[{"id":"conn-2"}]',
  }));
  exportConnectionsFile = vi.fn<
    (content: string) => Promise<{ cancelled: boolean }>
  >(async () => ({
    cancelled: false,
  }));
}

class MessageServiceStub implements Partial<MessageService> {
  add = vi.fn();
}

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let azure: AzureServiceStub;
  let api: AppApiServiceStub;
  let connections: ConnectionsServiceStub;
  let messageService: MessageServiceStub;

  beforeEach(async () => {
    azure = new AzureServiceStub();
    api = new AppApiServiceStub();
    connections = new ConnectionsServiceStub();
    messageService = new MessageServiceStub();

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideRouter([]),
        provideTranslateTesting(),
        { provide: AppApiService, useValue: api },
        { provide: AzureService, useValue: azure },
        { provide: MessageService, useValue: messageService },
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

  it('loads and renders the app version in the app info section', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.getVersion).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('v0.1.1');
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
    expect(fixture.nativeElement.textContent).not.toContain(
      'Make sure you have run az login in your terminal.',
    );
  });

  it('renders and updates the tail refresh interval preference', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tail Refresh Interval');
    const intervalButton = getButtonByText(fixture, '30s');
    intervalButton.click();

    const settings = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    expect(settings.updateLogsPreferences).toHaveBeenCalledWith({
      tailRefreshIntervalSeconds: 30,
    });
  });

  it('renders and updates the appearance preference', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Appearance');
    const darkButton = getButtonByText(fixture, 'Dark');
    darkButton.click();

    const settings = TestBed.inject(SettingsService) as unknown as SettingsServiceStub;
    expect(settings.updateGeneral).toHaveBeenCalledWith({
      appearance: 'dark',
    });
  });

  it('renders import/export actions and the dashboard management hint instead of a connection list', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Import');
    expect(fixture.nativeElement.textContent).toContain('Export');
    expect(fixture.nativeElement.textContent).toContain(
      'Manage connections in the Dashboard',
    );
    expect(fixture.nativeElement.textContent).not.toContain('AUTH EXPIRED');
  });

  it('disables export when no saved connections exist', () => {
    connections.connectionsState.set([]);
    fixture.detectChanges();

    const exportButton = getButtonByText(fixture, 'Export');
    expect(exportButton.disabled).toBe(true);
  });

  it('imports connections through the native file bridge and shows success feedback', async () => {
    fixture.detectChanges();

    const importButton = getButtonByText(fixture, 'Import');
    importButton.click();
    await fixture.whenStable();

    expect(api.importConnectionsFile).toHaveBeenCalledOnce();
    expect(connections.importFromJson).toHaveBeenCalledWith(
      '[{"id":"conn-2"}]',
    );
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' }),
    );
  });
});

function getButtonByText(
  fixture: ComponentFixture<SettingsPage>,
  text: string,
): HTMLButtonElement {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
  const match = buttons.find((button) => button.textContent?.includes(text));
  if (!match) {
    throw new Error(`Button with text "${text}" not found`);
  }
  return match;
}
