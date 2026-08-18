import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import { AppApiService } from '@app/core/services/app-api.service';
import { WindowControlsService } from '@app/core/services/window-controls.service';
import { AzureService } from '@app/features/settings/services/azure.service';
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

class AzureServiceStub implements Partial<AzureService> {
  readonly authInProgress = signal(false);
}

@Component({
  standalone: true,
  template: '',
})
class TestRouteComponent {}

describe('ShellComponent', () => {
  let controls: WindowControlsServiceStub;
  let appApi: AppApiServiceStub;
  let azure: AzureServiceStub;
  let router: Router;

  beforeEach(async () => {
    controls = new WindowControlsServiceStub();
    appApi = new AppApiServiceStub();
    azure = new AzureServiceStub();

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
        { provide: AzureService, useValue: azure },
      ],
    }).compileComponents();

    await initializeI18nForTests();
    router = TestBed.inject(Router);
  });

  it('renders the maximize icon and label in the normal window state', () => {
    const fixture = createFixture();
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
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    const branding = getBrandingBlock(fixture);

    expect(appApi.getVersion).toHaveBeenCalledOnce();
    expect(branding.textContent).toContain('v0.1.1');
  });

  it('hides the Azure authentication chip while no authentication runs', () => {
    const fixture = createFixture();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('renders the Azure authentication chip while authentication runs', () => {
    const fixture = createFixture();
    azure.authInProgress.set(true);
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector(
      '[role="status"]',
    ) as HTMLElement | null;

    expect(chip?.textContent).toContain('Authenticating');
    expect(chip?.getAttribute('aria-label')).toBe('Azure authentication in progress');
    expect(chip?.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('renders the restore icon and label in the maximized window state', () => {
    const fixture = createFixture();
    controls.isMaximized.set(true);
    fixture.detectChanges();

    const maximizeButton = getMaximizeButton(fixture);
    const maximizeIconPaths = maximizeButton.querySelectorAll('path');

    expect(maximizeButton.getAttribute('aria-label')).toBe('Restore window');
    expect(maximizeIconPaths).toHaveLength(2);
  });

  it('shows the back link on the logs overview route', async () => {
    const fixture = createFixture();
    await navigateTo('/logs', fixture, router);

    expect(getBackButton(fixture)).not.toBeNull();
  });

  it('shows the back link on the logs detail route', async () => {
    const fixture = createFixture();
    await navigateTo('/logs/connection-1', fixture, router);

    expect(getBackButton(fixture)).not.toBeNull();
  });

  it('shows the back link on the settings route', async () => {
    const fixture = createFixture();
    await navigateTo('/settings', fixture, router);

    expect(getBackButton(fixture)).not.toBeNull();
  });

  it('hides the back link on the connections route', async () => {
    const fixture = createFixture();
    await navigateTo('/connections', fixture, router);

    expect(getBackButton(fixture)).toBeNull();
  });

  it('navigates back to connections from logs detail', async () => {
    const fixture = createFixture();
    await navigateTo('/connections', fixture, router);
    await navigateTo('/logs/connection-1', fixture, router);

    await clickBackButton(fixture);

    expect(router.url).toBe('/connections');
  });

  it('navigates back to the previous in-app route from settings', async () => {
    const fixture = createFixture();
    await navigateTo('/connections', fixture, router);
    await navigateTo('/logs/connection-1', fixture, router);
    await navigateTo('/settings', fixture, router);

    await clickBackButton(fixture);

    expect(router.url).toBe('/logs/connection-1');
  });

  it('navigates back across multiple pages without bouncing forward again', async () => {
    const fixture = createFixture();
    await navigateTo('/connections', fixture, router);
    await navigateTo('/logs/connection-1', fixture, router);
    await navigateTo('/settings', fixture, router);

    await clickBackButton(fixture);
    expect(router.url).toBe('/logs/connection-1');

    await clickBackButton(fixture);
    expect(router.url).toBe('/connections');
  });

  it('navigates back across logs overview and settings to connections', async () => {
    const fixture = createFixture();
    await navigateTo('/connections', fixture, router);
    await navigateTo('/logs', fixture, router);
    await navigateTo('/settings', fixture, router);

    await clickBackButton(fixture);
    expect(router.url).toBe('/logs');

    await clickBackButton(fixture);
    expect(router.url).toBe('/connections');
  });

  it('falls back to connections when logs detail is the initial route', async () => {
    await router.navigateByUrl('/logs/connection-1');
    const fixture = createFixture();

    await clickBackButton(fixture);

    expect(router.url).toBe('/connections');
  });

  it('falls back to connections when settings is the initial route', async () => {
    await router.navigateByUrl('/settings');
    const fixture = createFixture();

    await clickBackButton(fixture);

    expect(router.url).toBe('/connections');
  });

  it('does not create duplicate history entries for the same route', async () => {
    const fixture = createFixture();
    await navigateTo('/connections', fixture, router);
    await navigateTo('/logs/connection-1', fixture, router);
    await navigateTo('/settings', fixture, router);
    await navigateTo('/settings', fixture, router);

    await clickBackButton(fixture);

    expect(router.url).toBe('/logs/connection-1');
  });
});

function createFixture(): ComponentFixture<ShellComponent> {
  const fixture = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  return fixture;
}

function getMaximizeButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
  const buttons = fixture.nativeElement.querySelectorAll('button');
  return buttons[1] as HTMLButtonElement;
}

function getBrandingBlock(fixture: ComponentFixture<ShellComponent>): HTMLDivElement {
  const title = [...fixture.nativeElement.querySelectorAll('span')].find((element) =>
    element.textContent?.includes('Azure Blob Log Viewer'),
  ) as HTMLSpanElement | undefined;

  return title?.parentElement as HTMLDivElement;
}

function getBackButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement | null {
  const icon = fixture.nativeElement.querySelector(
    'nav.no-drag button .pi-arrow-left',
  ) as HTMLElement | null;

  return (icon?.parentElement as HTMLButtonElement | null) ?? null;
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

async function clickBackButton(fixture: ComponentFixture<ShellComponent>): Promise<void> {
  getBackButton(fixture)?.click();
  await fixture.whenStable();
  fixture.detectChanges();
}
