import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import {
  initializeI18nForTests,
  provideTranslateTesting,
} from '@app/testing/translate-testing';

import type { LogFileRowVm } from '../../models/logs-view.model';

import { LogsFileListComponent } from './logs-file-list.component';

describe('LogsFileListComponent', () => {
  let fixture: ComponentFixture<LogsFileListComponent>;
  let component: LogsFileListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogsFileListComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(LogsFileListComponent);
    component = fixture.componentInstance;
  });

  it('renders the loading state', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('selectedEntryIds', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading blobs…');
    expect(fixture.nativeElement.querySelector('p-button')).not.toBeNull();
  });

  it('renders the empty state when there are no rows', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('selectedEntryIds', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No blobs found in this container.',
    );
  });

  it('highlights selected rows and emits additive selection metadata', () => {
    const rows: LogFileRowVm[] = [
      {
        id: 'entry-1',
        blobName: 'alpha.log',
        createdLabel: 'Today, 10:30',
        lastModifiedLabel: 'Today, 10:45',
        sizeLabel: '1.0 KB',
        isLive: true,
        isDeleted: false,
      },
      {
        id: 'entry-2',
        blobName: 'beta.log',
        createdLabel: 'Today, 10:00',
        lastModifiedLabel: 'Today, 10:05',
        sizeLabel: '2.0 KB',
        isLive: false,
        isDeleted: false,
      },
    ];
    const entrySelected = vi.fn<(event: { id: string; additive: boolean }) => void>();
    component.entrySelected.subscribe(entrySelected);

    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('selectedEntryIds', ['entry-1', 'entry-2']);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('li button');
    const firstButton = buttons[0] as HTMLButtonElement;
    const secondButton = buttons[1] as HTMLButtonElement;

    expect(firstButton.className).toContain('bg-surface-container-highest');
    expect(secondButton.className).toContain('bg-surface-container-highest');
    expect(firstButton.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('LIVE');
    expect(fixture.nativeElement.textContent).toContain('Created Today, 10:30');
    expect(fixture.nativeElement.textContent).toContain('Modified Today, 10:45');

    secondButton.dispatchEvent(new MouseEvent('click', { ctrlKey: true }));

    expect(entrySelected).toHaveBeenCalledWith({
      id: 'entry-2',
      additive: true,
    });
  });

  it('emits refresh requests from the header action', () => {
    const refreshRequested = vi.fn<() => void>();
    component.refreshRequested.subscribe(refreshRequested);

    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('selectedEntryIds', []);
    fixture.detectChanges();

    component.refresh();

    expect(refreshRequested).toHaveBeenCalledOnce();
  });

  it('emits deleted-filter changes and keeps deleted rows selectable', () => {
    const includeDeletedChanged = vi.fn<(value: boolean) => void>();
    const entrySelected = vi.fn<(event: { id: string; additive: boolean }) => void>();
    component.includeDeletedChanged.subscribe(includeDeletedChanged);
    component.entrySelected.subscribe(entrySelected);

    fixture.componentRef.setInput('rows', [
      {
        id: 'deleted-1',
        blobName: 'deleted.log',
        createdLabel: 'Today, 10:30',
        lastModifiedLabel: 'Today, 10:45',
        sizeLabel: '1.0 KB',
        isLive: false,
        isDeleted: true,
        deletedLabel: 'Deleted · 4 days left',
      },
    ] satisfies LogFileRowVm[]);
    fixture.componentRef.setInput('includeDeleted', true);
    fixture.componentRef.setInput('selectedEntryIds', []);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('li button') as HTMLButtonElement;
    expect(row.disabled).toBe(false);
    expect(row.title).toBe('Deleted · 4 days left');
    expect(row.className).toContain('bg-error-container/10');
    expect(row.className).toContain('ring-error/30');
    expect(row.querySelector('.pi-trash')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Deleted · 4 days left');

    row.click();

    expect(entrySelected).toHaveBeenCalledWith({
      id: 'deleted-1',
      additive: false,
    });

    component.onIncludeDeletedChange(false);

    expect(includeDeletedChanged).toHaveBeenCalledWith(false);
  });
});
