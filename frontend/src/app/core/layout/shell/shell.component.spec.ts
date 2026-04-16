import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import { AppApiService } from '@app/core/services/app-api.service';
import { WindowControlsService } from '@app/core/services/window-controls.service';
import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { ShellComponent } from './shell.component';

class WindowControlsServiceStub implements Partial<WindowControlsService> {
  readonly isMaximized = signal(false);
  minimize = vi.fn();
  toggleMaximize = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  close = vi.fn();
}

class AppApiServiceStub implements Partial<AppApiService> {
  getVersion = vi.fn<() => Promise<string>>().mockResolvedValue('0.1.1');
}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let controls: WindowControlsServiceStub;
  let appApi: AppApiServiceStub;

  beforeEach(async () => {
    controls = new WindowControlsServiceStub();
    appApi = new AppApiServiceStub();

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideTranslateTesting(),
        MessageService,
        { provide: AppApiService, useValue: appApi },
        { provide: WindowControlsService, useValue: controls },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  it('renders the maximize icon and label in the normal window state', () => {
    const branding = getBrandingBlock(fixture);
    const maximizeButton = getMaximizeButton(fixture);
    const maximizeIcon = maximizeButton.querySelector('rect');

    expect(branding.className).toContain('w-[var(--layout-sidebar-width)]');
    expect(branding.className).toContain('shrink-0');
    expect(branding.textContent).toContain('Azure Blob Log Viewer');
    expect(maximizeButton.getAttribute('aria-label')).toBe('Maximize window');
    expect(maximizeIcon).not.toBeNull();
  });

  it('loads and renders the version from the app bridge', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const branding = getBrandingBlock(fixture);

    expect(appApi.getVersion).toHaveBeenCalledOnce();
    expect(branding.textContent).toContain('v0.1.1');
  });

  it('renders the restore icon and label in the maximized window state', () => {
    controls.isMaximized.set(true);
    fixture.detectChanges();

    const maximizeButton = getMaximizeButton(fixture);
    const maximizeIconPaths = maximizeButton.querySelectorAll('path');

    expect(maximizeButton.getAttribute('aria-label')).toBe('Restore window');
    expect(maximizeIconPaths).toHaveLength(2);
  });
});

function getMaximizeButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
  const buttons = fixture.nativeElement.querySelectorAll('button');
  return buttons[1] as HTMLButtonElement;
}

function getBrandingBlock(fixture: ComponentFixture<ShellComponent>): HTMLDivElement {
  return fixture.nativeElement.querySelector(
    '.w-\\[var\\(--layout-sidebar-width\\)\\]',
  ) as HTMLDivElement;
}
