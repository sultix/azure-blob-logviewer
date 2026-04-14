import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { LogFileRowVm } from '../models/logs-view.model';

@Component({
  selector: 'app-logs-file-list',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex min-h-0 flex-1 flex-col overflow-hidden',
  },
  template: `
    <div class="shrink-0 px-5 pb-2">
      <h2
        class="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant"
      >
        {{ 'logs.fileList.title' | translate }}
      </h2>
    </div>

    @if (loadingValue) {
      <div
        class="flex min-h-0 flex-1 items-center justify-center text-xs text-on-surface-variant"
      >
        {{ 'logs.fileList.loading' | translate }}
      </div>
    } @else {
      <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-5">
        @for (row of rowsValue; track row.id) {
          <li>
            <button
              type="button"
              (click)="entrySelected.emit(row.id)"
              class="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors"
              [class.bg-surface-container-highest]="selectedEntryIdValue === row.id"
              [class.hover:bg-surface-container]="selectedEntryIdValue !== row.id"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-mono text-xs text-on-surface">
                  {{ row.blobName }}
                </span>
                @if (row.isLive) {
                  <span
                    class="shrink-0 rounded-full bg-tertiary-container px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface"
                  >
                    {{ 'logs.fileList.live' | translate }}
                  </span>
                }
              </div>
              <div
                class="flex items-center justify-between text-[10px] text-on-surface-variant"
              >
                <span>{{ row.timestamp }}</span>
                <span>{{ row.sizeLabel }}</span>
              </div>
            </button>
          </li>
        } @empty {
          <li class="px-3 py-6 text-center text-xs text-on-surface-variant">
            {{ 'logs.fileList.empty' | translate }}
          </li>
        }
      </ul>
    }
  `,
})
export class LogsFileListComponent {
  readonly rows = input.required<LogFileRowVm[]>();
  readonly loading = input(false);
  readonly selectedEntryId = input<string | null>(null);

  readonly entrySelected = output<string>();

  get rowsValue(): LogFileRowVm[] {
    return this.rows();
  }

  get loadingValue(): boolean {
    return this.loading();
  }

  get selectedEntryIdValue(): string | null {
    return this.selectedEntryId();
  }
}
