import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { TranslatePipe } from "@ngx-translate/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { Toast } from "primeng/toast";

import { WindowControlsService } from "@app/core/services/window-controls.service";

@Component({
  selector: "app-shell",
  imports: [RouterLink, RouterLinkActive, Toast, TranslatePipe],
  templateUrl: "./shell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly controls = inject(WindowControlsService);
  protected readonly appLogoPath = 'assets/branding/app-logo-80.png';
  protected readonly isMaximized = computed(() => this.controls.isMaximized());
  protected readonly maximizeButtonLabel = computed(() =>
    this.controls.isMaximized()
      ? 'shell.window.restore'
      : 'shell.window.maximize',
  );

  protected get isMaximizedValue(): boolean {
    return this.isMaximized();
  }

  protected get maximizeButtonLabelValue(): string {
    return this.maximizeButtonLabel();
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
}
