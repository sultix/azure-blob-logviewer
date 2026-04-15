import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { AzureAuthStep } from '../services/azure.service';

@Component({
  selector: 'app-azure-login',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './azure-login.component.html',
})
export class AzureLoginComponent {
  readonly authStep = input.required<AzureAuthStep>();
  readonly authError = input<string | null>(null);
  readonly azureCliMissing = input(false);

  readonly loginRequested = output<void>();
  readonly logoutRequested = output<void>();

  get authStepValue(): AzureAuthStep {
    return this.authStep();
  }

  get authErrorValue(): string | null {
    return this.authError();
  }

  get azureCliMissingValue(): boolean {
    return this.azureCliMissing();
  }
}
