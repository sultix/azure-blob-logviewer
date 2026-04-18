import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

@Component({
  standalone: true,
  template: '',
})
class TestRouteComponent {}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let controls: WindowControlsServiceStub;
  let appApi: AppApiServiceStub;
  let router: Router;

  beforeEach(async () => {
    controls = new WindowControlsServiceStub();
    appApi = new AppApiServiceStub();

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([
          { path: 'connections', component: TestRouteComponent },
          { path: 'logs', component: TestRouteComponent },
          { path: 'logs/:connectionId', component: TestRouteComponent },
          { path: 'settings', component: TestRouteComponent },
        ]),
        provideTranslateTesting(),
        MessageService,
        { provide: AppApiService, useValue: appApi },
        { provide: WindowControlsService, useValue: controls },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    router = TestBed.inject(Router);
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

  it('shows the back link on the logs overview route', async () => {
    await navigateTo('/logs', fixture, router);

    expect(getBackLink(fixture)?.getAttribute('href')).toBe('/connections');
  });

  it('shows the back link on the logs detail route', async () => {
    await navigateTo('/logs/connection-1', fixture, router);

    expect(getBackLink(fixture)?.getAttribute('href')).toBe('/connections');
  });

  it('shows the back link on the settings route', async () => {
    await navigateTo('/settings', fixture, router);

    expect(getBackLink(fixture)?.getAttribute('href')).toBe('/connections');
  });

  it('hides the back link on the connections route', async () => {
    await navigateTo('/connections', fixture, router);

    expect(getBackLink(fixture)).toBeNull();
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

function getBackLink(fixture: ComponentFixture<ShellComponent>): HTMLAnchorElement | null {
  const icon = fixture.nativeElement.querySelector(
    'nav.no-drag a[href="/connections"] .pi-arrow-left',
  ) as HTMLElement | null;

  return (icon?.parentElement as HTMLAnchorElement | null) ?? null;
}

async function navigateTo(
  url: string,
  fixture: ComponentFixture<ShellComponent>,
  router: Router,
): Promise<void> {
  await router.navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
}
