import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import { WindowControlsService } from '@app/core/services/window-controls.service';
import { AzureService } from '@app/features/settings/services/azure.service';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { AppComponent } from './app.component';

class AzureServiceStub implements Partial<AzureService> {
  initializeStartupAuth = vi.fn<() => Promise<void>>(async () => undefined);
}

class WindowControlsServiceStub implements Partial<WindowControlsService> {
  readonly isMaximized = signal(false);
  minimize = vi.fn();
  toggleMaximize = vi.fn<() => Promise<void>>(async () => undefined);
  close = vi.fn();
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let azure: AzureServiceStub;

  beforeEach(async () => {
    azure = new AzureServiceStub();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideTranslateTesting(),
        MessageService,
        { provide: AzureService, useValue: azure },
        { provide: WindowControlsService, useValue: new WindowControlsServiceStub() },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(AppComponent);
  });

  it('starts the silent Azure session restore on app init', () => {
    fixture.detectChanges();

    expect(azure.initializeStartupAuth).toHaveBeenCalledOnce();
  });
});
