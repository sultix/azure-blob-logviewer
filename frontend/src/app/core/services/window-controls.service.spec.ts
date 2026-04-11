import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  let service: WindowControlsService;
  let runtime: MockRuntime;
  let appBridge: MockAppBridge;
  let runtimeWindow: RuntimeWindow;

  beforeEach(() => {
    service = new WindowControlsService();
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
  });

  it('uses maximize on non-macOS platforms', async () => {
    await service.toggleMaximize();

    expect(runtime.WindowToggleMaximise).toHaveBeenCalledOnce();
    expect(runtime.WindowFullscreen).not.toHaveBeenCalled();
    expect(runtime.WindowUnfullscreen).not.toHaveBeenCalled();
  });

  it('uses fullscreen when maximizing on macOS', async () => {
    runtime.Environment.mockResolvedValue({ platform: 'darwin' });

    await service.toggleMaximize();

    expect(appBridge.ToggleMacFullscreen).toHaveBeenCalledOnce();
    expect(runtime.WindowToggleMaximise).not.toHaveBeenCalled();
    expect(runtime.WindowFullscreen).not.toHaveBeenCalled();
  });

  it('falls back to the runtime fullscreen path on macOS when the app bridge is unavailable', async () => {
    runtime.Environment.mockResolvedValue({ platform: 'darwin' });
    runtime.WindowIsFullscreen.mockResolvedValue(true);
    runtimeWindow.go = undefined;

    await service.toggleMaximize();

    expect(runtime.WindowUnfullscreen).toHaveBeenCalledOnce();
    expect(runtime.WindowFullscreen).not.toHaveBeenCalled();
    expect(runtime.WindowToggleMaximise).not.toHaveBeenCalled();
  });

  it('treats fullscreen as the maximized state on macOS', async () => {
    runtime.Environment.mockResolvedValue({ platform: 'darwin' });

    await expect(service.isMaximized()).resolves.toBe(true);
    expect(appBridge.IsMacFullscreen).toHaveBeenCalledOnce();
    expect(runtime.WindowIsMaximised).not.toHaveBeenCalled();
  });
});
