import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import type { MenuItem, TooltipOptions } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { SplitButton } from 'primeng/splitbutton';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';

import { LogSortBasis, type LogCreatedRange } from '../../models/logs-view.model';

@Component({
  selector: 'app-logs-filters',
  standalone: true,
  imports: [
    FormsModule,
    DatePicker,
    ButtonDirective,
    TranslatePipe,
    IconField,
    InputIcon,
    InputText,
    SplitButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logs-filters.component.html',
})
export class LogsFiltersComponent {
  private readonly i18n = inject(AppI18nService);

  readonly searchTerm = input('');
  readonly createdOn = input<Date | null>(null);
  readonly createdRange = input<LogCreatedRange>(null);
  readonly sortLabel = input.required<string>();
  readonly sortBasisLabel = input.required<string>();
  readonly sortBasis = input<LogSortBasis>(LogSortBasis.Created);
  readonly isSortDescending = input(true);

  readonly searchChanged = output<string>();
  readonly createdOnChanged = output<Date | null>();
  readonly createdRangeChanged = output<LogCreatedRange>();
  readonly clearFiltersRequested = output<void>();
  readonly sortToggled = output<void>();
  readonly sortBasisChanged = output<LogSortBasis>();

  readonly sortIcon = computed(() =>
    this.isSortDescending() ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up-alt',
  );
  readonly sortTooltip = computed(() =>
    this.i18n.translate('logs.filters.sortTooltip', {
      basis: this.sortBasisLabel(),
      moreActions: this.i18n.translate('logs.filters.moreActionsLabel'),
    }),
  );
  readonly sortTooltipOptions: TooltipOptions = { tooltipPosition: 'bottom' };
  readonly sortButtonProps = computed(() => ({
    ariaLabel: this.i18n.translate('logs.filters.sortAriaLabel'),
  }));
  readonly sortMenuButtonProps = computed(() => ({
    ariaLabel: this.i18n.translate('logs.filters.moreActionsAriaLabel'),
  }));
  readonly sortBasisMenuItems = computed<MenuItem[]>(() => [
    {
      label: this.i18n.translate('logs.filters.sortByCreated'),
      command: () => this.sortBasisChanged.emit(LogSortBasis.Created),
      icon:
        this.sortBasis() === LogSortBasis.Created ? 'pi pi-check-square' : 'pi pi-stop',
    },
    {
      label: this.i18n.translate('logs.filters.sortByLastModified'),
      command: () => this.sortBasisChanged.emit(LogSortBasis.LastModified),
      icon:
        this.sortBasis() === LogSortBasis.LastModified
          ? 'pi pi-check-square'
          : 'pi pi-stop',
    },
  ]);

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

  updateSortBasis(value: LogSortBasis): void {
    this.sortBasisChanged.emit(value);
  }

  alignSortMenu(anchor: HTMLElement, splitButton: SplitButton): void {
    requestAnimationFrame(() => {
      const container = splitButton.menu?.container;
      if (!container) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const nextLeft = Math.max(
        anchorRect.right - container.offsetWidth + window.scrollX,
        window.scrollX,
      );

      container.style.left = `${nextLeft}px`;
    });
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
