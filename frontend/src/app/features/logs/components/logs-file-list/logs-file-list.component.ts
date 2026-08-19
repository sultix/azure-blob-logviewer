import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Scroller } from 'primeng/scroller';

import type { LogFileRowVm, LogFileSelectionEvent } from '../../models/logs-view.model';

@Component({
  selector: 'app-logs-file-list',
  standalone: true,
  imports: [ButtonModule, FormsModule, Scroller, ToggleSwitch, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex min-h-0 flex-1 flex-col overflow-hidden',
  },
  templateUrl: './logs-file-list.component.html',
})
export class LogsFileListComponent {
  readonly rows = input.required<LogFileRowVm[]>();
  readonly loading = input(false);
  readonly includeDeleted = input(false);
  readonly selectedEntryIds = input.required<string[]>();
  readonly selectedEntryIdSet = computed(() => new Set(this.selectedEntryIds()));

  readonly entrySelected = output<LogFileSelectionEvent>();
  readonly includeDeletedChanged = output<boolean>();
  readonly refreshRequested = output<void>();

  readonly trackRow = (_index: number, row: LogFileRowVm): string => row.id;

  onEntryClick(event: MouseEvent, id: string): void {
    this.entrySelected.emit({
      id,
      additive: event.ctrlKey || event.metaKey,
    });
  }

  refresh(): void {
    this.refreshRequested.emit();
  }

  onIncludeDeletedChange(includeDeleted: boolean): void {
    this.includeDeletedChanged.emit(includeDeleted);
  }
}
