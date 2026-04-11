import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { LogsService } from '../services/logs.service';

@Component({
  selector: 'app-logs-page',
  templateUrl: './logs.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPage implements OnInit {
  private readonly logs = inject(LogsService);

  readonly status = this.logs.status;
  readonly entries = this.logs.entries;
  readonly errorMessage = this.logs.errorMessage;
  readonly isEmpty = this.logs.isEmpty;

  ngOnInit(): void {
    void this.logs.load();
  }
}
