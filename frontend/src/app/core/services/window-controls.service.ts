import { Injectable } from '@angular/core';

interface WailsEnvironment {
  platform: string;
}

interface WailsAppBridge {
  ToggleMacFullscreen?: () => Promise<void> | void;
  IsMacFullscreen?: () => Promise<boolean> | boolean;
}

interface WailsRuntime {
  Environment: () => Promise<WailsEnvironment>;
  WindowMinimise: () => void;
  WindowToggleMaximise: () => void;
  WindowFullscreen: () => void;
  WindowUnfullscreen: () => void;
  WindowIsFullscreen: () => Promise<boolean>;
  WindowIsMaximised: () => Promise<boolean>;
  Quit: () => void;
}

interface WailsRuntimeWindow {
  runtime?: WailsRuntime;
  go?: {
    app?: {
      App?: WailsAppBridge;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class WindowControlsService {
  private environment?: Promise<WailsEnvironment | null>;

  minimize(): void {
    this.runtime()?.WindowMinimise();
  }

  async toggleMaximize(): Promise<void> {
    const runtime = this.runtime();
    if (!runtime) {
      return;
    }

    await this.toggleWindowState(runtime);
  }

  close(): void {
    this.runtime()?.Quit();
  }

  async isMaximized(): Promise<boolean> {
    const runtime = this.runtime();
    if (!runtime) {
      return false;
    }

    if (await this.isMacOS(runtime)) {
      return this.isMacFullscreen(runtime);
    }

    return runtime.WindowIsMaximised();
  }

  private runtime(): WailsRuntime | undefined {
    return (window as unknown as WailsRuntimeWindow).runtime;
  }

  private async toggleWindowState(runtime: WailsRuntime): Promise<void> {
    if (!(await this.isMacOS(runtime))) {
      runtime.WindowToggleMaximise();
      return;
    }

    const appBridge = this.appBridge();
    if (appBridge?.ToggleMacFullscreen) {
      await appBridge.ToggleMacFullscreen();
      return;
    }

    if (await runtime.WindowIsFullscreen()) {
      runtime.WindowUnfullscreen();
      return;
    }

    runtime.WindowFullscreen();
  }

  private async isMacOS(runtime: WailsRuntime): Promise<boolean> {
    const environment = await this.environmentInfo(runtime);
    return environment?.platform === 'darwin';
  }

  private environmentInfo(runtime: WailsRuntime): Promise<WailsEnvironment | null> {
    if (!this.environment) {
      this.environment = runtime.Environment().catch(() => null);
    }

    return this.environment;
  }

  private async isMacFullscreen(runtime: WailsRuntime): Promise<boolean> {
    const appBridge = this.appBridge();
    if (appBridge?.IsMacFullscreen) {
      return appBridge.IsMacFullscreen();
    }

    return runtime.WindowIsFullscreen();
  }

  private appBridge(): WailsAppBridge | undefined {
    return (window as unknown as WailsRuntimeWindow).go?.app?.App;
  }
}
