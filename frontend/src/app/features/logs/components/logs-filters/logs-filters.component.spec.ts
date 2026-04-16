import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { DatePicker } from 'primeng/datepicker';
import { SplitButton } from 'primeng/splitbutton';

import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { LogSortBasis } from '../../models/logs-view.model';
import { LogsFiltersComponent } from './logs-filters.component';

describe('LogsFiltersComponent', () => {
  let fixture: ComponentFixture<LogsFiltersComponent>;
  let component: LogsFiltersComponent;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [LogsFiltersComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(LogsFiltersComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('searchTerm', 'alpha');
    fixture.componentRef.setInput('createdOn', new Date('2026-04-12T00:00:00Z'));
    fixture.componentRef.setInput('createdRange', [
      new Date('2026-04-12T00:00:00Z'),
      new Date('2026-04-13T00:00:00Z'),
    ]);
    fixture.componentRef.setInput('sortLabel', 'Newest first');
    fixture.componentRef.setInput('sortBasisLabel', 'Created');
    fixture.componentRef.setInput('sortBasis', LogSortBasis.Created);
    fixture.componentRef.setInput('isSortDescending', true);
    fixture.detectChanges();
  });

  it('renders the current filter state', () => {
    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search log files"]',
    ) as HTMLInputElement;
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const datePickers = fixture.debugElement.queryAll(By.directive(DatePicker));
    const splitButton = fixture.debugElement.query(By.directive(SplitButton));
    const clearButton = buttons.find((button) =>
      button.textContent?.includes('Clear filters'),
    );
    const sortButton = fixture.nativeElement.querySelector(
      'button[aria-label="Sort logs"]',
    ) as HTMLButtonElement;
    const moreButton = fixture.nativeElement.querySelector(
      'button[aria-label="More sort options"]',
    ) as HTMLButtonElement;

    expect(searchInput.value).toBe('alpha');
    expect(datePickers).toHaveLength(2);
    expect(clearButton?.textContent).toContain('Clear filters');
    expect(splitButton).not.toBeNull();
    expect(sortButton.textContent).toContain('Newest first');
    expect(sortButton.textContent).not.toContain('Created');
    expect(sortButton.querySelector('.pi-sort-amount-down')).not.toBeNull();
    expect(moreButton).not.toBeNull();
    expect(component.sortTooltip()).toBe(
      'Sorted by creation date. Change it in More actions.',
    );
  });

  it('emits events for search, clear, and sort toggle', () => {
    const searchChanged = vi.fn<(value: string) => void>();
    const clearRequested = vi.fn<() => void>();
    const sortToggled = vi.fn<() => void>();
    component.searchChanged.subscribe(searchChanged);
    component.clearFiltersRequested.subscribe(clearRequested);
    component.sortToggled.subscribe(sortToggled);

    component.onSearchInput('beta');

    const clearButton = fixture.nativeElement.querySelectorAll('button')[0] as HTMLButtonElement;
    const sortButton = fixture.nativeElement.querySelector(
      'button[aria-label="Sort logs"]',
    ) as HTMLButtonElement;
    clearButton.click();
    sortButton.click();

    expect(searchChanged).toHaveBeenCalledWith('beta');
    expect(clearRequested).toHaveBeenCalledOnce();
    expect(sortToggled).toHaveBeenCalledOnce();
  });

  it('emits sort basis changes independently from sort direction', () => {
    const sortBasisChanged = vi.fn<(value: LogSortBasis) => void>();
    component.sortBasisChanged.subscribe(sortBasisChanged);

    component.updateSortBasis(LogSortBasis.LastModified);
    component.updateSortBasis(LogSortBasis.Created);

    expect(sortBasisChanged).toHaveBeenNthCalledWith(1, LogSortBasis.LastModified);
    expect(sortBasisChanged).toHaveBeenNthCalledWith(2, LogSortBasis.Created);
  });

  it('clears the range when a single created-on date is selected', () => {
    const createdOnChanged = vi.fn<(value: Date | null) => void>();
    const createdRangeChanged = vi.fn<
      (value: [Date] | [Date, Date] | null) => void
    >();
    component.createdOnChanged.subscribe(createdOnChanged);
    component.createdRangeChanged.subscribe(createdRangeChanged);

    const value = new Date('2026-04-10T00:00:00Z');
    component.onCreatedOnInput(value);

    expect(createdRangeChanged).toHaveBeenCalledWith(null);
    expect(createdOnChanged).toHaveBeenCalledWith(value);
  });

  it('clears the single-date filter when a range selection starts and keeps partial ranges', () => {
    const createdOnChanged = vi.fn<(value: Date | null) => void>();
    const createdRangeChanged = vi.fn<
      (value: [Date] | [Date, Date] | null) => void
    >();
    component.createdOnChanged.subscribe(createdOnChanged);
    component.createdRangeChanged.subscribe(createdRangeChanged);

    const start = new Date('2026-04-10T00:00:00Z');
    component.onCreatedRangeInput([start]);

    expect(createdOnChanged).toHaveBeenCalledWith(null);
    expect(createdRangeChanged).toHaveBeenCalledWith([start]);
  });

  it('emits a full range when both range dates are selected', () => {
    const createdRangeChanged = vi.fn<
      (value: [Date] | [Date, Date] | null) => void
    >();
    component.createdRangeChanged.subscribe(createdRangeChanged);

    const start = new Date('2026-04-10T00:00:00Z');
    const end = new Date('2026-04-11T00:00:00Z');
    component.onCreatedRangeInput([start, end]);

    expect(createdRangeChanged).toHaveBeenCalledWith([start, end]);
  });
});
