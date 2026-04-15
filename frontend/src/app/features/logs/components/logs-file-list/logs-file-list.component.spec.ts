import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';

import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

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
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading blobs…');
  });

  it('renders the empty state when there are no rows', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No blobs found in this container.');
  });

  it('highlights the selected row and emits the selected id', () => {
    const rows: LogFileRowVm[] = [
      {
        id: 'entry-1',
        blobName: 'alpha.log',
        timestamp: 'Today, 10:30',
        sizeLabel: '1.0 KB',
        isLive: true,
      },
      {
        id: 'entry-2',
        blobName: 'beta.log',
        timestamp: 'Today, 10:00',
        sizeLabel: '2.0 KB',
        isLive: false,
      },
    ];
    const entrySelected = vi.fn<(id: string) => void>();
    component.entrySelected.subscribe(entrySelected);

    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('selectedEntryId', 'entry-1');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('li button');
    const firstButton = buttons[0] as HTMLButtonElement;
    const secondButton = buttons[1] as HTMLButtonElement;

    expect(firstButton.className).toContain('bg-surface-container-highest');
    expect(secondButton.className).toContain('hover:bg-surface-container');
    expect(fixture.nativeElement.textContent).toContain('LIVE');

    secondButton.click();

    expect(entrySelected).toHaveBeenCalledWith('entry-2');
  });
});
