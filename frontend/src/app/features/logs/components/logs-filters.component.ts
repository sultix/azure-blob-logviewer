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
  template: `
    <div class="flex flex-col gap-3 p-5">
      <div
        class="flex items-center gap-2 rounded-lg bg-surface-container-lowest px-3 py-2"
      >
        <i class="pi pi-search text-xs text-on-surface-variant"></i>
        <input
          type="text"
          [placeholder]="'logs.filters.searchPlaceholder' | translate"
          [ngModel]="searchTermValue"
          (ngModelChange)="onSearchInput($event)"
          class="flex-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          [attr.aria-label]="'logs.filters.searchAriaLabel' | translate"
        />
      </div>

      <div class="flex flex-col gap-2">
        <p-datepicker
          [ngModel]="dateFromValue"
          (ngModelChange)="onDateFromInput($event)"
          [placeholder]="'logs.filters.from' | translate"
          dateFormat="dd.mm.yy"
          [showIcon]="true"
          iconDisplay="input"
          [showClear]="true"
          styleClass="w-full text-xs"
          inputStyleClass="text-xs w-full"
          size="small"
          appendTo="body"
        />
        <p-datepicker
          [ngModel]="dateUntilValue"
          (ngModelChange)="onDateUntilInput($event)"
          [placeholder]="'logs.filters.until' | translate"
          dateFormat="dd.mm.yy"
          [showIcon]="true"
          iconDisplay="input"
          [showClear]="true"
          styleClass="w-full text-xs"
          inputStyleClass="text-xs w-full"
          size="small"
          appendTo="body"
        />
      </div>

      <div class="flex items-center justify-start gap-4">
        <button
          pButton
          type="button"
          severity="secondary"
          size="small"
          icon="pi pi-times"
          [text]="true"
          (click)="clearFiltersRequested.emit()"
        >
          {{ 'logs.filters.clear' | translate }}
        </button>

        <button
          pButton
          type="button"
          severity="secondary"
          size="small"
          [text]="true"
          (click)="sortToggled.emit()"
          [attr.aria-label]="'logs.filters.sortAriaLabel' | translate"
        >
          <i
            class="pi text-xs"
            [class.pi-sort-amount-down]="isSortDescendingValue"
            [class.pi-sort-amount-up-alt]="!isSortDescendingValue"
          ></i>
          {{ sortLabelText }}
        </button>
      </div>
    </div>
  `,
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

  get searchTermValue(): string {
    return this.searchTerm();
  }

  get dateFromValue(): Date | null {
    return this.dateFrom();
  }

  get dateUntilValue(): Date | null {
    return this.dateUntil();
  }

  get sortLabelText(): string {
    return this.sortLabel();
  }

  get isSortDescendingValue(): boolean {
    return this.isSortDescending();
  }

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
