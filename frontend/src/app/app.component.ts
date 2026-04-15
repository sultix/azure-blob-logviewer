import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ShellComponent } from './core/layout/shell/shell.component';
import { AzureService } from './features/settings/services/azure.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShellComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly azure = inject(AzureService);

  ngOnInit(): void {
    void this.azure.initializeStartupAuth();
  }
}
