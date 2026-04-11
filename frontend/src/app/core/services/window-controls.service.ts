import { Injectable } from '@angular/core';

interface WailsRuntime {
  WindowMinimise: () => void;
  WindowToggleMaximise: () => void;
  WindowIsMaximised: () => Promise<boolean>;
  Quit: () => void;
}

interface WailsRuntimeWindow {
  runtime?: WailsRuntime;
}

@Injectable({ providedIn: 'root' })
export class WindowControlsService {
  minimize(): void {
    this.runtime()?.WindowMinimise();
  }

  toggleMaximize(): void {
    this.runtime()?.WindowToggleMaximise();
  }

  close(): void {
    this.runtime()?.Quit();
  }

  async isMaximized(): Promise<boolean> {
    const runtime = this.runtime();
    if (!runtime) {
      return false;
    }
    return runtime.WindowIsMaximised();
  }

  private runtime(): WailsRuntime | undefined {
    return (window as unknown as WailsRuntimeWindow).runtime;
  }
}
