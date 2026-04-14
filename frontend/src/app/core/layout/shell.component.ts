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
  template: `
    <div class="flex h-full flex-col bg-surface">
      <p-toast position="bottom-right" />

      <header
        class="drag-region flex h-12 shrink-0 items-center justify-between bg-surface-container-high pl-5 pr-0"
        (dblclick)="controls.toggleMaximize()"
      >
        <div class="flex min-w-0 flex-1 items-center gap-0">
          <div
            class="flex w-[var(--layout-sidebar-width)] shrink-0 items-center gap-2"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded bg-primary-gradient text-on-primary"
            >
              <i class="pi pi-database text-[12px]"></i>
            </span>
            <span
              class="font-display text-sm font-semibold tracking-wide text-on-surface"
            >
              {{ 'shell.appName' | translate }}
            </span>
            <span
              class="text-[11px] font-medium uppercase tracking-widest text-on-surface-variant"
            >
              v0.1.0
            </span>
          </div>

          <nav class="no-drag flex items-center gap-1">
            <a
              routerLink="/connections"
              routerLinkActive="text-on-surface border-primary"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-2 border-b-2 border-transparent pe-3 py-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <i class="pi pi-th-large text-[13px]"></i>
              {{ 'shell.navigation.dashboard' | translate }}
            </a>
            <a
              routerLink="/settings"
              routerLinkActive="text-on-surface border-primary"
              class="flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <i class="pi pi-cog text-[13px]"></i>
              {{ 'shell.navigation.settings' | translate }}
            </a>
          </nav>
        </div>

        <div class="no-drag flex h-full items-stretch">
          <button
            type="button"
            (click)="controls.minimize()"
            [attr.aria-label]="'shell.window.minimize' | translate"
            class="flex h-full w-12 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <i class="pi pi-minus text-[11px]"></i>
          </button>
          <button
            type="button"
            (click)="controls.toggleMaximize()"
            [attr.aria-label]="maximizeButtonLabel() | translate"
            class="flex h-full w-12 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <!-- <i [class]="maximizeButtonIconClass()"></i> -->

            @if (isMaximized()) {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
                class="size-8"
              >
                <path
                  stroke-linecap="square"
                  stroke-linejoin="miter"
                  d="M9.75 7.5h6.75v6.75"
                />
                <path
                  stroke-linecap="square"
                  stroke-linejoin="miter"
                  d="M7.5 9.75h6.75v6.75H7.5z"
                />
              </svg>
            } @else {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
                class="size-8"
              >
                <rect
                  x="7.5"
                  y="7.5"
                  width="9"
                  height="9"
                  stroke-linejoin="miter"
                />
              </svg>
            }
          </button>
          <button
            type="button"
            (click)="controls.close()"
            [attr.aria-label]="'shell.window.close' | translate"
            class="flex h-full w-12 items-center justify-center text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-surface"
          >
            <i class="pi pi-times text-[11px]"></i>
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-hidden bg-surface">
        <ng-content />
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly controls = inject(WindowControlsService);
  protected readonly isMaximized = computed(() => this.controls.isMaximized());
  protected readonly maximizeButtonLabel = computed(() =>
    this.controls.isMaximized()
      ? 'shell.window.restore'
      : 'shell.window.maximize',
  );
}
