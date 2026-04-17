import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsService } from '@app/features/settings/services/settings.service';

import { ThemeService } from './theme.service';

class MatchMediaController {
  private listeners = new Set<(event: MediaQueryListEvent) => void>();

  readonly query = '(prefers-color-scheme: dark)';
  readonly mediaQueryList = {
    matches: false,
    media: this.query,
    onchange: null,
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      this.listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      this.listeners.delete(listener);
    },
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type !== 'change') {
        return;
      }

      if (typeof listener === 'function') {
        this.listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type !== 'change') {
        return;
      }

      if (typeof listener === 'function') {
        this.listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    dispatchEvent: vi.fn(),
  } satisfies MediaQueryList;

  setMatches(matches: boolean): void {
    this.mediaQueryList.matches = matches;
    const event = { matches, media: this.query } as MediaQueryListEvent;
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe('ThemeService', () => {
  let controller: MatchMediaController;
  let settings: SettingsService;
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    delete document.body.dataset.theme;
    document.body.style.colorScheme = '';

    controller = new MatchMediaController();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => controller.mediaQueryList),
    });

    TestBed.configureTestingModule({
      providers: [SettingsService, ThemeService],
    });

    settings = TestBed.inject(SettingsService);
    service = TestBed.inject(ThemeService);
  });

  it('resolves system mode from the OS preference and applies the light theme by default', () => {
    service.initialize();

    expect(service.appearance()).toBe('system');
    expect(service.resolvedTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.body.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.body.style.colorScheme).toBe('light');
  });

  it('applies the dark theme when explicitly selected and ignores later OS changes', async () => {
    service.initialize();
    settings.updateGeneral({ appearance: 'dark' });
    await settleEffects();

    expect(service.resolvedTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');

    controller.setMatches(false);
    await settleEffects();

    expect(service.resolvedTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('follows live system theme changes while appearance is set to system', async () => {
    service.initialize();

    controller.setMatches(true);
    await settleEffects();

    expect(service.resolvedTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');

    controller.setMatches(false);
    await settleEffects();

    expect(service.resolvedTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

async function settleEffects(): Promise<void> {
  TestBed.flushEffects();
  await Promise.resolve();
}
