import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type {
  LogFileRowVm,
  LogFileSelectionEvent,
} from '../../models/logs-view.model';

@Component({
  selector: 'app-logs-file-list',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex min-h-0 flex-1 flex-col overflow-hidden',
  },
  templateUrl: './logs-file-list.component.html',
})
export class LogsFileListComponent {
  readonly rows = input.required<LogFileRowVm[]>();
  readonly loading = input(false);
  readonly selectedEntryIds = input.required<string[]>();
  readonly selectedEntryIdSet = computed(() => new Set(this.selectedEntryIds()));

  readonly entrySelected = output<LogFileSelectionEvent>();

  onEntryClick(event: MouseEvent, id: string): void {
    this.entrySelected.emit({
      id,
      additive: event.ctrlKey || event.metaKey,
    });
  }
}
