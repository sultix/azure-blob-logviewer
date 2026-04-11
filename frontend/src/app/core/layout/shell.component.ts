import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { WindowControlsService } from '@app/core/services/window-controls.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-full flex-col bg-surface">
      <header
        class="drag-region flex h-12 shrink-0 items-center justify-between bg-surface-container-high pl-5 pr-0"
      >
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <span
              class="flex h-6 w-6 items-center justify-center rounded bg-primary-gradient text-on-primary"
            >
              <i class="pi pi-database text-[12px]"></i>
            </span>
            <span class="font-display text-sm font-semibold tracking-wide text-on-surface">
              Azure Blob Log Viewer
            </span>
            <span class="text-[11px] font-medium uppercase tracking-widest text-on-surface-variant">
              v0.1.0
            </span>
          </div>

          <nav class="no-drag flex items-center gap-1">
            <a
              routerLink="/connections"
              routerLinkActive="text-on-surface border-primary"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <i class="pi pi-th-large text-[13px]"></i>
              Dashboard
            </a>
            <a
              routerLink="/logs"
              routerLinkActive="text-on-surface border-primary"
              class="flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <i class="pi pi-server text-[13px]"></i>
              Log Stream
            </a>
            <a
              routerLink="/settings"
              routerLinkActive="text-on-surface border-primary"
              class="flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <i class="pi pi-cog text-[13px]"></i>
              Settings
            </a>
          </nav>
        </div>

        <div class="no-drag flex h-full items-stretch">
          <button
            type="button"
            (click)="controls.minimize()"
            aria-label="Minimize window"
            class="flex h-full w-12 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <i class="pi pi-minus text-[11px]"></i>
          </button>
          <button
            type="button"
            (click)="controls.toggleMaximize()"
            aria-label="Maximize window"
            class="flex h-full w-12 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <i class="pi pi-stop text-[11px]"></i>
          </button>
          <button
            type="button"
            (click)="controls.close()"
            aria-label="Close window"
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
}
