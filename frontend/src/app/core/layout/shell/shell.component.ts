import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Toast } from 'primeng/toast';

import { AppApiService } from '@app/core/services/app-api.service';
import { WindowControlsService } from '@app/core/services/window-controls.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, Toast, TranslatePipe],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  private readonly appApi = inject(AppApiService);
  protected readonly controls = inject(WindowControlsService);
  protected readonly appLogoPath = 'assets/branding/app-logo-80.png';
  protected readonly appVersion = signal<string | null>(null);
  protected readonly isMaximized = computed(() => this.controls.isMaximized());
  protected readonly maximizeButtonLabel = computed(() =>
    this.controls.isMaximized()
      ? 'shell.window.restore'
      : 'shell.window.maximize',
  );

  ngOnInit(): void {
    void this.loadVersion();
  }

  protected onToggleMaximize(): void {
    void this.controls.toggleMaximize();
  }

  protected onMinimize(): void {
    this.controls.minimize();
  }

  protected onClose(): void {
    this.controls.close();
  }

  private async loadVersion(): Promise<void> {
    try {
      this.appVersion.set(await this.appApi.getVersion());
    } catch {
      this.appVersion.set(null);
    }
  }
}
