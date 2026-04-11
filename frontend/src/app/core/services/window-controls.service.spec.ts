import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WindowControlsService } from './window-controls.service';

interface MockRuntime {
  Environment: ReturnType<typeof vi.fn<() => Promise<{ platform: string }>>>;
  WindowMinimise: ReturnType<typeof vi.fn<() => void>>;
  WindowToggleMaximise: ReturnType<typeof vi.fn<() => void>>;
  WindowFullscreen: ReturnType<typeof vi.fn<() => void>>;
  WindowUnfullscreen: ReturnType<typeof vi.fn<() => void>>;
  WindowIsFullscreen: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  WindowIsMaximised: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  Quit: ReturnType<typeof vi.fn<() => void>>;
}

interface MockAppBridge {
  ToggleMacFullscreen: ReturnType<typeof vi.fn<() => Promise<void>>>;
  IsMacFullscreen: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
}

interface RuntimeWindow {
  runtime?: MockRuntime;
  go?: {
    app?: {
      App?: Partial<MockAppBridge>;
    };
  };
}

describe('WindowControlsService', () => {
  let runtime: MockRuntime;
  let appBridge: MockAppBridge;
  let runtimeWindow: RuntimeWindow;

  beforeEach(() => {
    runtime = {
      Environment: vi.fn().mockResolvedValue({ platform: 'linux' }),
      WindowMinimise: vi.fn(),
      WindowToggleMaximise: vi.fn(),
      WindowFullscreen: vi.fn(),
      WindowUnfullscreen: vi.fn(),
      WindowIsFullscreen: vi.fn().mockResolvedValue(false),
      WindowIsMaximised: vi.fn().mockResolvedValue(true),
      Quit: vi.fn(),
    };
    appBridge = {
      ToggleMacFullscreen: vi.fn().mockResolvedValue(undefined),
      IsMacFullscreen: vi.fn().mockResolvedValue(true),
    };
    runtimeWindow = window as unknown as RuntimeWindow;
    runtimeWindow.runtime = runtime;
    runtimeWindow.go = {
      app: {
        App: appBridge,
      },
    };

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    delete runtimeWindow.runtime;
    delete runtimeWindow.go;
  });

  it('sets the initial maximized state for non-macOS', async () => {
    const service = TestBed.inject(WindowControlsService);
    await flushAsync();

    expect(service.isMaximized()).toBe(true);
    expect(runtime.WindowIsMaximised).toHaveBeenCalledOnce();
  });

  it('uses fullscreen state on macOS instead of maximized state', async () => {
    runtime.Environment.mockResolvedValue({ platform: 'darwin' });
    appBridge.IsMacFullscreen.mockResolvedValue(true);

    const service = TestBed.inject(WindowControlsService);
    await flushAsync();

    expect(service.isMaximized()).toBe(true);
    expect(appBridge.IsMacFullscreen).toHaveBeenCalledOnce();
    expect(runtime.WindowIsMaximised).not.toHaveBeenCalled();
  });

  it('resynchronizes the state after toggling maximize', async () => {
    runtime.WindowIsMaximised
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const service = TestBed.inject(WindowControlsService);
    await flushAsync();
    runtime.WindowIsMaximised.mockClear();

    await service.toggleMaximize();

    expect(runtime.WindowToggleMaximise).toHaveBeenCalledOnce();
    expect(service.isMaximized()).toBe(true);
    expect(runtime.WindowIsMaximised).toHaveBeenCalledOnce();
  });

  it('resynchronizes the state on resize and focus events', async () => {
    runtime.WindowIsMaximised
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const service = TestBed.inject(WindowControlsService);
    await flushAsync();
    runtime.WindowIsMaximised.mockClear();

    window.dispatchEvent(new Event('resize'));
    await flushAsync();
    expect(service.isMaximized()).toBe(true);

    window.dispatchEvent(new Event('focus'));
    await flushAsync();
    expect(service.isMaximized()).toBe(false);
    expect(runtime.WindowIsMaximised).toHaveBeenCalledTimes(2);
  });
});

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}
