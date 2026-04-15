import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';

import type { LogCreatedRange } from '../../models/logs-view.model';

@Component({
  selector: 'app-logs-filters',
  standalone: true,
  imports: [FormsModule, DatePicker, ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logs-filters.component.html',
})
export class LogsFiltersComponent {
  readonly searchTerm = input('');
  readonly createdOn = input<Date | null>(null);
  readonly createdRange = input<LogCreatedRange>(null);
  readonly sortLabel = input.required<string>();
  readonly isSortDescending = input(true);

  readonly searchChanged = output<string>();
  readonly createdOnChanged = output<Date | null>();
  readonly createdRangeChanged = output<LogCreatedRange>();
  readonly clearFiltersRequested = output<void>();
  readonly sortToggled = output<void>();

  onSearchInput(value: string): void {
    this.searchChanged.emit(value);
  }

  onCreatedOnInput(value: Date | null): void {
    if (value !== null) {
      this.createdRangeChanged.emit(null);
    }
    this.createdOnChanged.emit(value);
  }

  onCreatedRangeInput(value: Date[] | null): void {
    const createdRange = normalizeCreatedRange(value);
    if (createdRange !== null) {
      this.createdOnChanged.emit(null);
    }
    this.createdRangeChanged.emit(createdRange);
  }

  clearFilters(): void {
    this.createdOnChanged.emit(null);
    this.createdRangeChanged.emit(null);
    this.clearFiltersRequested.emit();
  }
}

function normalizeCreatedRange(value: Date[] | null): LogCreatedRange {
  if (!value || value.length === 0) {
    return null;
  }

  const start = value[0];
  if (!start) {
    return null;
  }

  const end = value[1];
  if (!end) {
    return [start];
  }

  return [start, end];
}
