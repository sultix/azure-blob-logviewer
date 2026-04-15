import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { DatePicker } from 'primeng/datepicker';

import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { LogsFiltersComponent } from './logs-filters.component';

describe('LogsFiltersComponent', () => {
  let fixture: ComponentFixture<LogsFiltersComponent>;
  let component: LogsFiltersComponent;

  beforeEach(async () => {
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
    fixture.componentRef.setInput('isSortDescending', true);
    fixture.detectChanges();
  });

  it('renders the current filter state', () => {
    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search log files"]',
    ) as HTMLInputElement;
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const datePickers = fixture.debugElement.queryAll(By.directive(DatePicker));

    expect(searchInput.value).toBe('alpha');
    expect(datePickers).toHaveLength(2);
    expect(buttons[0]?.textContent).toContain('Clear filters');
    expect(buttons[1]?.textContent).toContain('Newest first');
    expect(buttons[1]?.querySelector('.pi-sort-amount-down')).not.toBeNull();
  });

  it('emits events for search, clear, and sort toggle', () => {
    const searchChanged = vi.fn<(value: string) => void>();
    const clearRequested = vi.fn<() => void>();
    const sortToggled = vi.fn<() => void>();
    component.searchChanged.subscribe(searchChanged);
    component.clearFiltersRequested.subscribe(clearRequested);
    component.sortToggled.subscribe(sortToggled);

    component.onSearchInput('beta');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0]?.click();
    buttons[1]?.click();

    expect(searchChanged).toHaveBeenCalledWith('beta');
    expect(clearRequested).toHaveBeenCalledOnce();
    expect(sortToggled).toHaveBeenCalledOnce();
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
