import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

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
    fixture.componentRef.setInput('dateFrom', new Date('2026-04-12T00:00:00Z'));
    fixture.componentRef.setInput('dateUntil', new Date('2026-04-13T00:00:00Z'));
    fixture.componentRef.setInput('sortLabel', 'Newest first');
    fixture.componentRef.setInput('isSortDescending', true);
    fixture.detectChanges();
  });

  it('renders the current filter state', () => {
    const searchInput = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const buttons = fixture.nativeElement.querySelectorAll('button');

    expect(searchInput.value).toBe('alpha');
    expect(buttons[0]?.textContent).toContain('Clear filters');
    expect(buttons[1]?.textContent).toContain('Newest first');
    expect(buttons[1]?.querySelector('.pi-sort-amount-down')).not.toBeNull();
  });

  it('emits events for search, date changes, clear, and sort toggle', () => {
    const searchChanged = vi.fn<(value: string) => void>();
    const dateFromChanged = vi.fn<(value: Date | null) => void>();
    const dateUntilChanged = vi.fn<(value: Date | null) => void>();
    const clearRequested = vi.fn<() => void>();
    const sortToggled = vi.fn<() => void>();
    component.searchChanged.subscribe(searchChanged);
    component.dateFromChanged.subscribe(dateFromChanged);
    component.dateUntilChanged.subscribe(dateUntilChanged);
    component.clearFiltersRequested.subscribe(clearRequested);
    component.sortToggled.subscribe(sortToggled);

    component.onSearchInput('beta');
    component.onDateFromInput(new Date('2026-04-10T00:00:00Z'));
    component.onDateUntilInput(new Date('2026-04-11T00:00:00Z'));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0]?.click();
    buttons[1]?.click();

    expect(searchChanged).toHaveBeenCalledWith('beta');
    expect(dateFromChanged).toHaveBeenCalledWith(new Date('2026-04-10T00:00:00Z'));
    expect(dateUntilChanged).toHaveBeenCalledWith(new Date('2026-04-11T00:00:00Z'));
    expect(clearRequested).toHaveBeenCalledOnce();
    expect(sortToggled).toHaveBeenCalledOnce();
  });
});
