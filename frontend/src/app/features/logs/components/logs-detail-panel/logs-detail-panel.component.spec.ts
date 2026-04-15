import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { Tooltip } from 'primeng/tooltip';

import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';
import { SettingsService } from '@app/features/settings/services/settings.service';

import type { LogFooterVm, LogLargeViewerVm, LogToolbarVm } from '../../models/logs-view.model';

import { LogsDetailPanelComponent } from './logs-detail-panel.component';

const SETTINGS_STORAGE_KEY = 'obsidian-console:config';

describe('LogsDetailPanelComponent', () => {
  let fixture: ComponentFixture<LogsDetailPanelComponent>;
  let component: LogsDetailPanelComponent;
  let scrollToSpy: ReturnType<typeof vi.fn>;
  let settings: SettingsService;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    scrollToSpy = vi.fn();
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
    });

    await TestBed.configureTestingModule({
      imports: [LogsDetailPanelComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(LogsDetailPanelComponent);
    component = fixture.componentInstance;
    settings = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading, error, and no-selection states', () => {
    fixture.componentRef.setInput('status', 'loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading logs…');

    fixture.componentRef.setInput('status', 'error');
    fixture.componentRef.setInput('errorMessage', 'Request failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Request failed');

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Select a log file to view its contents');
  });

  it('renders toolbar metadata and content', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };
    const footer: LogFooterVm = {
      typeLabel: 'Type text/plain',
      lineCountLabel: 'Lines 2',
      lineEndingsLabel: 'Line endings LF',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'line 1\nline 2');
    fixture.componentRef.setInput('contentLoading', false);
    fixture.componentRef.setInput('footer', footer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('alpha.log');
    expect(fixture.nativeElement.textContent).toContain('storage-a/logs/alpha.log');
    expect(fixture.nativeElement.textContent).toContain('Size 1.5 KB');
    expect(fixture.nativeElement.textContent).toContain('Created 1 hr ago');
    expect(fixture.nativeElement.textContent).toContain('line 1');
    expect(fixture.nativeElement.textContent).toContain('Lines 2');
    expect(fixture.nativeElement.textContent).toContain('Type text/plain');
    expect(fixture.nativeElement.textContent).toContain('Line endings LF');
    expect(fixture.nativeElement.textContent).not.toContain('Ln 1034, Col 42');
    expect(fixture.nativeElement.textContent).not.toContain('UTF-8');
    expect(fixture.nativeElement.textContent).not.toContain('Spaces: 4');
    expect(fixture.nativeElement.textContent).toContain('Word Wrap');
    expect(fixture.nativeElement.querySelector('p-toggleswitch')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('input[aria-label="Search within log content"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="More actions"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Refresh');
    expect(fixture.nativeElement.textContent).not.toContain('Download');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect((buttons[0] as HTMLButtonElement).title).toBe('');
    expect((buttons[1] as HTMLButtonElement).title).toBe('');

    const tooltips = fixture.debugElement.queryAll(By.directive(Tooltip));
    expect(tooltips).toHaveLength(2);
    expect(tooltips[0].injector.get(Tooltip).content).toBe('Refresh');
    expect(tooltips[1].injector.get(Tooltip).content).toBe('Download');
    expect(component.mobileActionItems().map((item) => item.label)).toEqual([
      'Refresh',
      'Download',
      'Word Wrap: Off',
    ]);

    const scrollContainer = fixture.nativeElement.querySelector('.overflow-auto');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer.className).toContain('min-h-0');

    const content = fixture.nativeElement.querySelector('pre');
    expect(content.className).toContain('whitespace-pre');
    expect(content.className).not.toContain('whitespace-pre-wrap');
  });

  it('renders the content loading state and emits refresh actions', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };
    const refreshRequested = vi.fn<() => void>();
    component.refreshRequested.subscribe(refreshRequested);

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('contentLoading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading blob content…');

    const refreshButton = fixture.nativeElement.querySelector(
      'button[aria-label="Refresh"]',
    ) as HTMLButtonElement;
    refreshButton.click();

    expect(refreshRequested).toHaveBeenCalledOnce();
  });

  it('renders a real content error and hides content-based footer values', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };
    const footer: LogFooterVm = {
      typeLabel: 'Type application/json',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('contentErrorMessage', 'Error loading content: network failed');
    fixture.componentRef.setInput('footer', footer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Error loading content: network failed');
    expect(fixture.nativeElement.textContent).toContain('Type application/json');
    expect(fixture.nativeElement.textContent).not.toContain('Lines ');
    expect(fixture.nativeElement.textContent).not.toContain('Line endings ');
    expect(fixture.nativeElement.querySelector('pre')).toBeNull();
  });

  it('omits the footer when no real footer values are provided', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'line 1');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('footer')).toBeNull();
  });

  it('emits download actions', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };
    const downloadRequested = vi.fn<() => void>();
    component.downloadRequested.subscribe(downloadRequested);

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.detectChanges();

    const downloadButton = fixture.nativeElement.querySelector(
      'button[aria-label="Download"]',
    ) as HTMLButtonElement;
    downloadButton.click();

    expect(downloadRequested).toHaveBeenCalledOnce();
  });

  it('renders the large viewer state, emits search actions, and disables download until export is ready', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      progressLabel: '4.0 MB / 100.0 MB loaded',
      statusLabel: 'File is loading in the background',
      searchStatusLabel: '2 matches so far',
      searchQuery: 'error',
      matchCount: 2,
      activeMatchLineNumber: 18,
      requestedScrollLine: 18,
      topSpacerPx: 0,
      bottomSpacerPx: 800,
      lines: [
        { lineNumber: 18, content: 'error on current line' },
        { lineNumber: 19, content: 'next error line' },
      ],
      totalLines: 42,
      tailPreviewLines: [],
      pendingBeforeLabel: 'Earlier lines are still loading',
      pendingAfterLabel: 'Later lines are still loading',
      canEnableWordWrap: false,
      downloadDisabled: true,
    };
    const downloadRequested = vi.fn<() => void>();
    const largeSearchChanged = vi.fn<(value: string) => void>();
    const previousLargeMatchRequested = vi.fn<() => void>();
    const nextLargeMatchRequested = vi.fn<() => void>();
    const largeViewportChanged = vi.fn<
      (value: { startLine: number; lineCount: number }) => void
    >();
    component.downloadRequested.subscribe(downloadRequested);
    component.largeSearchChanged.subscribe(largeSearchChanged);
    component.previousLargeMatchRequested.subscribe(previousLargeMatchRequested);
    component.nextLargeMatchRequested.subscribe(nextLargeMatchRequested);
    component.largeViewportChanged.subscribe(largeViewportChanged);

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', largeViewer);
    fixture.componentRef.setInput('downloadDisabled', true);
    fixture.detectChanges();
    await settleComponent();

    const scrollContainer = fixture.nativeElement.querySelector('.overflow-auto') as HTMLDivElement;
    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 160,
    });
    scrollContainer.scrollTop = 0;
    component.onLargeViewerScroll();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('File is loading in the background');
    expect(fixture.nativeElement.textContent).toContain('4.0 MB / 100.0 MB loaded');
    expect(fixture.nativeElement.textContent).toContain('Earlier lines are still loading');
    expect(fixture.nativeElement.textContent).toContain('Later lines are still loading');
    expect(fixture.nativeElement.textContent).toContain('error on current line');
    const highlights = fixture.nativeElement.querySelectorAll('mark.log-search-match');
    const renderedLine = highlights[0]?.closest('span') as HTMLSpanElement | null;
    expect(renderedLine).not.toBeNull();
    expect(renderedLine.className).toContain('block');
    expect(renderedLine.className).toContain('min-w-0');
    expect(renderedLine.className).toContain('w-full');
    expect(highlights).toHaveLength(2);
    expect(highlights[0]?.className).toContain('active-search-match');
    expect(highlights[1]?.className).not.toContain('active-search-match');

    const downloadButton = fixture.nativeElement.querySelector(
      'button[aria-label="Download"]',
    ) as HTMLButtonElement;
    expect(downloadButton.disabled).toBe(true);
    downloadButton.click();
    expect(downloadRequested).not.toHaveBeenCalled();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    searchInput.value = 'warning';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const previousButton = fixture.nativeElement.querySelector(
      'button[aria-label="Previous match"]',
    ) as HTMLButtonElement;
    const nextButton = fixture.nativeElement.querySelector(
      'button[aria-label="Next match"]',
    ) as HTMLButtonElement;
    previousButton.click();
    nextButton.click();

    expect(largeSearchChanged).toHaveBeenCalledWith('warning');
    expect(previousLargeMatchRequested).toHaveBeenCalledOnce();
    expect(nextLargeMatchRequested).toHaveBeenCalledOnce();
    expect(largeViewportChanged).toHaveBeenCalledWith({ startLine: 0, lineCount: 40 });
    expect(component.mobileActionItems()[1]?.disabled).toBe(true);
    expect(component.canToggleWordWrap()).toBe(false);
  });

  it('renders large viewer lines without highlight markup when no search query is set', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      progressLabel: '100.0 MB / 100.0 MB loaded',
      statusLabel: 'File fully loaded',
      searchStatusLabel: '',
      searchQuery: '',
      matchCount: 0,
      activeMatchLineNumber: null,
      requestedScrollLine: null,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      lines: [{ lineNumber: 7, content: 'plain line content' }],
      totalLines: 1,
      tailPreviewLines: [],
      pendingBeforeLabel: null,
      pendingAfterLabel: null,
      canEnableWordWrap: true,
      downloadDisabled: false,
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', largeViewer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('plain line content');
    expect(fixture.nativeElement.querySelectorAll('mark.log-search-match')).toHaveLength(0);
  });

  it('renders tail preview lines with precomputed html', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      progressLabel: '4.0 MB / 100.0 MB loaded',
      statusLabel: 'File is loading in the background',
      searchStatusLabel: '1 match so far',
      searchQuery: 'error',
      matchCount: 1,
      activeMatchLineNumber: 0,
      requestedScrollLine: null,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      lines: [],
      totalLines: 0,
      tailPreviewLines: ['tail error line', 'tail info line'],
      pendingBeforeLabel: null,
      pendingAfterLabel: null,
      canEnableWordWrap: false,
      downloadDisabled: true,
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', largeViewer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Showing the newest lines first while the full file is loading.',
    );
    expect(fixture.nativeElement.textContent).toContain('tail error line');
    const highlights = fixture.nativeElement.querySelectorAll('mark.log-search-match');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.className).toContain('active-search-match');
  });

  it('shows a placeholder while visible large-file lines are still being prepared', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      progressLabel: '100.0 MB / 100.0 MB loaded',
      statusLabel: 'File fully loaded',
      searchStatusLabel: '',
      searchQuery: '',
      matchCount: 0,
      activeMatchLineNumber: null,
      requestedScrollLine: null,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      lines: [],
      totalLines: 1500,
      tailPreviewLines: [],
      pendingBeforeLabel: null,
      pendingAfterLabel: null,
      canEnableWordWrap: true,
      downloadDisabled: false,
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', largeViewer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Preparing visible lines…');
  });

  it('toggles word wrap for the log content', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'averyveryveryverylongloglinewithoutspaces');
    fixture.detectChanges();

    const toggleInput = fixture.nativeElement.querySelector(
      'p-toggleswitch input[type="checkbox"]',
    ) as HTMLInputElement;
    toggleInput.click();
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('pre');
    expect(content.className).toContain('whitespace-pre-wrap');
    expect(content.className).toContain('break-all');
    expect(settings.logs().wordWrapEnabled).toBe(true);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"wordWrapEnabled":true');
  });

  it('uses the persisted word wrap preference on startup', async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        azure: {
          lastSubscriptionId: '',
          lastStorageAccountName: '',
          lastContainerName: '',
        },
        general: {
          refreshIntervalMinutes: 15,
          retentionPolicy: '30d',
          language: 'en',
        },
        logs: {
          wordWrapEnabled: true,
        },
      }),
    );

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LogsDetailPanelComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(LogsDetailPanelComponent);
    component = fixture.componentInstance;

    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'averyveryveryverylongloglinewithoutspaces');
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('pre') as HTMLPreElement;
    expect(content.className).toContain('whitespace-pre-wrap');
    expect(content.className).toContain('break-all');
  });

  it('searches and highlights matches inside the log content', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'Error line\ninfo\nSecond ERROR line');
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, 'error');

    expect(fixture.nativeElement.textContent).toContain('1 / 2');

    const highlights = fixture.nativeElement.querySelectorAll('mark');
    expect(highlights).toHaveLength(2);
    expect(highlights[0]?.textContent).toBe('Error');
    expect(highlights[1]?.textContent).toBe('ERROR');
    expect(highlights[0]?.className).toContain('active-search-match');
    expect(highlights[1]?.className).not.toContain('active-search-match');
  });

  it('clears the content search from the inline clear button', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'Error line\nSecond ERROR line');
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, 'error');

    const clearButton = fixture.nativeElement.querySelector(
      'button[aria-label="Clear content search"]',
    ) as HTMLButtonElement;
    clearButton.click();
    fixture.detectChanges();

    expect(searchInput.value).toBe('');
    expect(fixture.nativeElement.querySelectorAll('mark')).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Clear content search"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('1 / 2');
  });

  it('preserves the exact log formatting while highlighting matches', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };
    const content = 'prefix  ERROR\tvalue\n  next line';

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', content);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, 'error');

    const renderedContent = fixture.nativeElement.querySelector('pre') as HTMLPreElement;
    expect(renderedContent.textContent).toBe(content);
  });

  it('navigates between matches and scrolls the active result into view', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'first error\nsecond error\nthird error');
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, 'error');

    const scrollContainer = fixture.nativeElement.querySelector('.overflow-auto') as HTMLDivElement;
    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 100,
    });
    scrollContainer.scrollTop = 0;
    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ top: 0, bottom: 100, height: 100 }),
    );

    const marks = fixture.nativeElement.querySelectorAll('mark');
    vi.spyOn(marks[0] as HTMLElement, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ top: 12, bottom: 28, height: 16 }),
    );
    vi.spyOn(marks[1] as HTMLElement, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ top: 180, bottom: 196, height: 16 }),
    );

    const nextButton = fixture.nativeElement.querySelector(
      'button[aria-label="Next match"]',
    ) as HTMLButtonElement;
    nextButton.click();
    fixture.detectChanges();
    await settleComponent();

    expect(fixture.nativeElement.textContent).toContain('2 / 3');

    const highlights = fixture.nativeElement.querySelectorAll('mark');
    expect(highlights[1]?.className).toContain('active-search-match');
    expect(scrollToSpy).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        top: expect.any(Number),
        behavior: 'auto',
      }),
    );
  });

  it('does not scroll again when the active match stays the same', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'first error\nsecond error');
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, 'error');

    scrollToSpy.mockClear();
    fixture.detectChanges();
    await settleComponent();

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});

async function runContentSearch(
  fixture: ComponentFixture<LogsDetailPanelComponent>,
  input: HTMLInputElement,
  value: string,
): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  vi.advanceTimersByTime(130);
  await settleComponent(fixture);
}

async function settleComponent(
  fixture?: ComponentFixture<LogsDetailPanelComponent>,
): Promise<void> {
  await Promise.resolve();
  fixture?.detectChanges();
  await Promise.resolve();
  fixture?.detectChanges();
}

function createDomRect(
  overrides: Partial<DOMRect> & Pick<DOMRect, 'top' | 'bottom' | 'height'>,
): DOMRect {
  return {
    x: 0,
    y: overrides.top,
    width: 200,
    left: 0,
    right: 200,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}
