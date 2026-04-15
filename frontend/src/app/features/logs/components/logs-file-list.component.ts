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
  templateUrl: './logs-file-list.component.html',
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
