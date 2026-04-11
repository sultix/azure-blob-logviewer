import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ShellComponent } from './core/layout/shell.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShellComponent],
  template: `
    <app-shell>
      <router-outlet />
    </app-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
