import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';

@Component({
  selector: 'app-logs-filters',
  standalone: true,
  imports: [FormsModule, DatePicker, ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logs-filters.component.html',
})
export class LogsFiltersComponent {
  readonly searchTerm = input('');
  readonly dateFrom = input<Date | null>(null);
  readonly dateUntil = input<Date | null>(null);
  readonly sortLabel = input.required<string>();
  readonly isSortDescending = input(true);

  readonly searchChanged = output<string>();
  readonly dateFromChanged = output<Date | null>();
  readonly dateUntilChanged = output<Date | null>();
  readonly clearFiltersRequested = output<void>();
  readonly sortToggled = output<void>();

  onSearchInput(value: string): void {
    this.searchChanged.emit(value);
  }

  onDateFromInput(value: Date | null): void {
    this.dateFromChanged.emit(value);
  }

  onDateUntilInput(value: Date | null): void {
    this.dateUntilChanged.emit(value);
  }
}
