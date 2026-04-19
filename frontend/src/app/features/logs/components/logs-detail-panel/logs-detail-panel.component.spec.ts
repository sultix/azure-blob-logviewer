import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { Tooltip } from 'primeng/tooltip';

import {
  initializeI18nForTests,
  provideTranslateTesting,
} from '@app/testing/translate-testing';
import { SettingsService } from '@app/features/settings/services/settings.service';

import type {
  LogFooterVm,
  LogLargeViewerVm,
  LogToolbarVm,
} from '../../models/logs-view.model';
import { LOG_VIRTUAL_LINE_HEIGHT_PX } from '../../models/logs-viewer.constants';

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
    expect(fixture.nativeElement.textContent).toContain(
      'Select a log file to view its contents',
    );
  });

  it('renders toolbar metadata and content', () => {
    const toolbar: LogToolbarVm = {
      connectionName: 'prod-storage',
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: 'Apr 13, 2026, 11:00 AM',
      lastModified: 'Apr 13, 2026, 11:30 AM',
    };
    const footer: LogFooterVm = {
      typeLabel: 'Type text/plain',
      lineCountLabel: 'Lines 2',
      lineEndingsLabel: 'Line endings LF',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('tailAvailable', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'line 1\nline 2');
    fixture.componentRef.setInput('contentLoading', false);
    fixture.componentRef.setInput('footer', footer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('alpha.log');
    expect(fixture.nativeElement.textContent).toContain('storage-a/logs/alpha.log');
    expect(fixture.nativeElement.textContent).toContain('Size 1.5 KB');
    expect(fixture.nativeElement.textContent).toContain('Created Apr 13, 2026, 11:00 AM');
    expect(fixture.nativeElement.textContent).toContain(
      'Modified Apr 13, 2026, 11:30 AM',
    );
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
      fixture.nativeElement.querySelector(
        'input[aria-label="Search within log content"]',
      ),
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
      'Tail: Off',
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

  it('uses the compact 18px line height and disables wrapping in tail mode', () => {
    settings.updateLogsPreferences({ wordWrapEnabled: true });

    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('tailEnabled', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'tail line 1\ntail line 2');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Word wrap is disabled while tail mode is active.',
    );

    const content = fixture.nativeElement.querySelector('pre') as HTMLPreElement;
    expect(content.className).toContain('whitespace-pre');
    expect(content.className).toContain('leading-[18px]');
    expect(content.className).not.toContain('whitespace-pre-wrap');
    expect(content.className).not.toContain('break-all');
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
    fixture.componentRef.setInput(
      'contentErrorMessage',
      'Error loading content: network failed',
    );
    fixture.componentRef.setInput('footer', footer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Error loading content: network failed',
    );
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
      mode: 'snapshot',
      progressLabel: '4.0 MB / 100.0 MB loaded',
      statusLabel: 'File is loading in the background',
      searchStatusLabel: '1 / 2',
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
    const largeViewportChanged =
      vi.fn<(value: { startLine: number; lineCount: number }) => void>();
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

    const scrollContainer = fixture.nativeElement.querySelector(
      '.overflow-auto',
    ) as HTMLDivElement;
    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 160,
    });
    scrollContainer.scrollTop = 0;
    component.onLargeViewerScroll();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'File is loading in the background',
    );
    expect(fixture.nativeElement.textContent).toContain('4.0 MB / 100.0 MB loaded');
    expect(fixture.nativeElement.textContent).toContain(
      'Word wrap is unavailable for large files to keep the viewer responsive.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Earlier lines are still loading',
    );
    expect(fixture.nativeElement.textContent).toContain('Later lines are still loading');
    expect(fixture.nativeElement.textContent).toContain('error on current line');
    const highlights = fixture.nativeElement.querySelectorAll('mark.log-search-match');
    const renderedLine = highlights[0]?.closest('span') as HTMLSpanElement | null;
    expect(renderedLine).not.toBeNull();
    expect(renderedLine.className).toContain('inline-block');
    expect(renderedLine.className).toContain('min-w-full');
    expect(renderedLine.className).toContain('whitespace-pre');
    expect(renderedLine.className).toContain('leading-[18px]');
    expect(renderedLine.className).not.toContain('whitespace-pre-wrap');
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
    expect(largeViewportChanged).toHaveBeenCalledWith({
      startLine: 0,
      lineCount: Math.ceil(160 / LOG_VIRTUAL_LINE_HEIGHT_PX) + 32,
    });
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
      mode: 'snapshot',
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
    expect(fixture.nativeElement.textContent).toContain(
      'Word wrap is unavailable for large files to keep the viewer responsive.',
    );
    expect(fixture.nativeElement.querySelectorAll('mark.log-search-match')).toHaveLength(
      0,
    );
    expect(component.canToggleWordWrap()).toBe(false);
  });

  it('marks bracketed log levels in the normal content view', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', '[INFO] ok\n[error] bad\n[Warn] caution');
    fixture.detectChanges();

    const tokens = getLogLevelTokens(fixture);
    expect(tokens).toHaveLength(3);
    expect(tokens[0]?.textContent).toBe('[INFO]');
    expect(tokens[0]?.className).toContain('log-level-token--info');
    expect(tokens[0]?.className).toContain('text-primary');
    expect(tokens[1]?.className).toContain('log-level-token--error');
    expect(tokens[1]?.className).toContain('text-error');
    expect(tokens[1]?.className).toContain('rounded-sm');
    expect(tokens[1]?.className).toContain('px-1');
    expect(tokens[1]?.className).toContain('font-semibold');
    expect(tokens[1]?.className).toContain('bg-error/12');
    expect(tokens[1]?.className).toContain('ring-1');
    expect(tokens[1]?.className).toContain('ring-inset');
    expect(tokens[1]?.className).toContain('ring-error/20');
    expect(tokens[2]?.className).toContain('log-level-token--warn');
    expect(tokens[2]?.className).toContain('text-tertiary');
    expect(tokens[2]?.className).toContain('rounded-sm');
    expect(tokens[2]?.className).toContain('px-1');
    expect(tokens[2]?.className).toContain('font-medium');
    expect(tokens[2]?.className).toContain('bg-tertiary/10');
    expect(tokens[2]?.className).toContain('ring-1');
    expect(tokens[2]?.className).toContain('ring-inset');
    expect(tokens[2]?.className).toContain('ring-tertiary/15');
  });

  it('does not mark unbracketed log levels', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'INFO ERROR WARN');
    fixture.detectChanges();

    expect(getLogLevelTokens(fixture)).toHaveLength(0);
  });

  it('maps the [EROR] alias to the error token styling', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', '[EROR] broken');
    fixture.detectChanges();

    const tokens = getLogLevelTokens(fixture);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.textContent).toBe('[EROR]');
    expect(tokens[0]?.className).toContain('log-level-token--error');
    expect(tokens[0]?.className).toContain('text-error');
    expect(tokens[0]?.className).toContain('font-semibold');
    expect(tokens[0]?.className).toContain('bg-error/12');
    expect(tokens[0]?.className).toContain('ring-error/20');
  });

  it('marks bracketed log levels in large viewer lines', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      mode: 'snapshot',
      progressLabel: '100.0 MB / 100.0 MB loaded',
      statusLabel: 'File fully loaded',
      searchStatusLabel: '',
      searchQuery: '',
      matchCount: 0,
      activeMatchLineNumber: null,
      requestedScrollLine: null,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      lines: [{ lineNumber: 7, content: '[ERROR] failure' }],
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

    const tokens = getLogLevelTokens(fixture);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.className).toContain('log-level-token--error');
    expect(tokens[0]?.className).toContain('font-semibold');
    expect(tokens[0]?.className).toContain('bg-error/12');
    expect(tokens[0]?.className).toContain('ring-error/20');
  });

  it('renders tail preview lines with precomputed html', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const footer: LogFooterVm = {
      lineCountLabel: 'Lines in excerpt: 200',
    };
    const largeViewer: LogLargeViewerVm = {
      mode: 'tail',
      progressLabel: '4.0 MB / 100.0 MB loaded',
      statusLabel: 'File is loading in the background',
      searchStatusLabel: '1 / 1',
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
    fixture.componentRef.setInput('footer', footer);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Tail shows the newest lines immediately. Older parts of the file continue loading in the background.',
    );
    expect(fixture.nativeElement.textContent).toContain('tail error line');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Earlier lines are still loading',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Searching');
    const highlights = fixture.nativeElement.querySelectorAll('mark.log-search-match');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.className).toContain('active-search-match');
  });

  it('marks bracketed log levels in tail preview lines', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      mode: 'tail',
      progressLabel: '4.0 MB / 100.0 MB loaded',
      statusLabel: 'Tail mode active',
      searchStatusLabel: '',
      searchQuery: '',
      matchCount: 0,
      activeMatchLineNumber: null,
      requestedScrollLine: null,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      lines: [],
      totalLines: 0,
      tailPreviewLines: ['[WARN] tail line', '[info] another line'],
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

    const tokens = getLogLevelTokens(fixture);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.className).toContain('log-level-token--warn');
    expect(tokens[0]?.className).toContain('font-medium');
    expect(tokens[0]?.className).toContain('bg-tertiary/10');
    expect(tokens[0]?.className).toContain('ring-tertiary/15');
    expect(tokens[1]?.className).toContain('log-level-token--info');
  });

  it('scrolls to the bottom when tail mode becomes active', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('selectionKey', 'alpha');
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', createTailLargeViewer());
    fixture.detectChanges();

    const scrollContainer = getScrollContainer(fixture);
    setScrollMetrics(scrollContainer, {
      clientHeight: 120,
      scrollHeight: 480,
      scrollTop: 0,
    });

    scrollToSpy.mockClear();
    await settleComponent(fixture);

    expect(scrollToSpy).toHaveBeenLastCalledWith({
      top: 480,
      behavior: 'auto',
    });
  });

  it('keeps scrolling to the bottom during tail refresh while the user stays at the bottom', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('selectionKey', 'alpha');
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', createTailLargeViewer());
    fixture.detectChanges();

    const scrollContainer = getScrollContainer(fixture);
    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 200,
    });
    await settleComponent(fixture);
    component.onLargeViewerScroll();

    scrollToSpy.mockClear();

    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 360,
      scrollTop: 200,
    });
    fixture.componentRef.setInput(
      'largeViewer',
      createTailLargeViewer({
        tailPreviewLines: ['line 1', 'line 2', 'line 3'],
      }),
    );
    fixture.detectChanges();
    await settleComponent(fixture);

    expect(scrollToSpy).toHaveBeenLastCalledWith({
      top: 360,
      behavior: 'auto',
    });
  });

  it('does not auto-scroll tail refreshes while the user is away from the bottom', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('selectionKey', 'alpha');
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', createTailLargeViewer());
    fixture.detectChanges();

    const scrollContainer = getScrollContainer(fixture);
    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 150,
    });
    await settleComponent(fixture);
    component.onLargeViewerScroll();

    scrollToSpy.mockClear();

    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 360,
      scrollTop: 150,
    });
    fixture.componentRef.setInput(
      'largeViewer',
      createTailLargeViewer({
        tailPreviewLines: ['line 1', 'line 2', 'line 3'],
      }),
    );
    fixture.detectChanges();
    await settleComponent(fixture);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('re-enables tail auto-scroll after the user manually returns to the bottom', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('selectionKey', 'alpha');
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', createTailLargeViewer());
    fixture.detectChanges();

    const scrollContainer = getScrollContainer(fixture);
    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 150,
    });
    await settleComponent(fixture);
    component.onLargeViewerScroll();

    scrollToSpy.mockClear();

    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 360,
      scrollTop: 256,
    });
    component.onLargeViewerScroll();

    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 420,
      scrollTop: 256,
    });
    fixture.componentRef.setInput(
      'largeViewer',
      createTailLargeViewer({
        tailPreviewLines: ['line 1', 'line 2', 'line 3', 'line 4'],
      }),
    );
    fixture.detectChanges();
    await settleComponent(fixture);

    expect(scrollToSpy).toHaveBeenLastCalledWith({
      top: 420,
      behavior: 'auto',
    });
  });

  it('uses explicit tail line navigation without sticky-bottom until the user returns to the bottom', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeScrollHandled = vi.fn<() => void>();
    component.largeScrollHandled.subscribe(largeScrollHandled);

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('selectionKey', 'alpha');
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('largeViewer', createTailLargeViewer());
    fixture.detectChanges();

    const scrollContainer = getScrollContainer(fixture);
    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 200,
    });
    await settleComponent(fixture);
    component.onLargeViewerScroll();

    scrollToSpy.mockClear();

    fixture.componentRef.setInput(
      'largeViewer',
      createTailLargeViewer({
        requestedScrollLine: 5,
      }),
    );
    fixture.detectChanges();
    await settleComponent(fixture);

    expect(scrollToSpy).toHaveBeenLastCalledWith({
      top: 5 * LOG_VIRTUAL_LINE_HEIGHT_PX,
      behavior: 'auto',
    });
    expect(largeScrollHandled).toHaveBeenCalledOnce();

    scrollToSpy.mockClear();
    fixture.componentRef.setInput(
      'largeViewer',
      createTailLargeViewer({
        requestedScrollLine: null,
        tailPreviewLines: ['line 1', 'line 2', 'line 3'],
      }),
    );
    fixture.detectChanges();
    await settleComponent(fixture);

    expect(scrollToSpy).not.toHaveBeenCalled();

    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 360,
      scrollTop: 260,
    });
    component.onLargeViewerScroll();

    fixture.componentRef.setInput(
      'largeViewer',
      createTailLargeViewer({
        requestedScrollLine: null,
        tailPreviewLines: ['line 1', 'line 2', 'line 3', 'line 4'],
      }),
    );
    setScrollMetrics(scrollContainer, {
      clientHeight: 100,
      scrollHeight: 420,
      scrollTop: 260,
    });
    fixture.detectChanges();
    await settleComponent(fixture);

    expect(scrollToSpy).toHaveBeenLastCalledWith({
      top: 420,
      behavior: 'auto',
    });
  });

  it('shows a placeholder while visible large-file lines are still being prepared', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      mode: 'snapshot',
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
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain(
      '"wordWrapEnabled":true',
    );
  });

  it('does not toggle word wrap for fully loaded large files', () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '100.0 MB',
      created: '1 hr ago',
    };
    const largeViewer: LogLargeViewerVm = {
      mode: 'snapshot',
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

    component.onWordWrapChange(true);

    expect(component.canToggleWordWrap()).toBe(false);
    expect(settings.logs().wordWrapEnabled).toBe(false);
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
          appearance: 'system',
        },
        logs: {
          wordWrapEnabled: true,
          logLevelHighlightingEnabled: true,
          tailRefreshIntervalSeconds: 10,
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

  it('lets search highlighting take precedence over log level coloring', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'prefix [ERROR] suffix');
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, '[error]');

    const highlights = fixture.nativeElement.querySelectorAll('mark.log-search-match');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.textContent).toBe('[ERROR]');
    expect(getLogLevelTokens(fixture)).toHaveLength(0);
  });

  it('disables log level coloring when the setting is off', () => {
    settings.updateLogsPreferences({ logLevelHighlightingEnabled: false });

    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', '[ERROR] failure');
    fixture.detectChanges();

    expect(getLogLevelTokens(fixture)).toHaveLength(0);
  });

  it('does not start inline content search before three characters', async () => {
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
    await runContentSearch(fixture, searchInput, 'er');

    expect(fixture.nativeElement.querySelectorAll('mark')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).not.toContain('0 matches');
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Previous match"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Next match"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Clear content search"]'),
    ).not.toBeNull();
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

  it('resets the content search when the selected blob changes', async () => {
    const toolbar: LogToolbarVm = {
      blobName: 'alpha.log',
      path: 'storage-a/logs/alpha.log',
      sizeLabel: '1.5 KB',
      created: '1 hr ago',
    };

    fixture.componentRef.setInput('status', 'success');
    fixture.componentRef.setInput('hasSelection', true);
    fixture.componentRef.setInput('selectionKey', 'alpha');
    fixture.componentRef.setInput('toolbar', toolbar);
    fixture.componentRef.setInput('content', 'Error line\nSecond ERROR line');
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    await runContentSearch(fixture, searchInput, 'error');

    expect(fixture.nativeElement.querySelectorAll('mark')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('1 / 2');

    fixture.componentRef.setInput('selectionKey', 'beta');
    fixture.componentRef.setInput('toolbar', {
      ...toolbar,
      blobName: 'beta.log',
      path: 'storage-a/logs/beta.log',
    });
    fixture.componentRef.setInput('content', 'beta content without matches');
    fixture.detectChanges();
    await settleComponent(fixture);

    const updatedSearchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search within log content"]',
    ) as HTMLInputElement;
    expect(updatedSearchInput.value).toBe('');
    expect(fixture.nativeElement.querySelectorAll('mark')).toHaveLength(0);
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

    const scrollContainer = fixture.nativeElement.querySelector(
      '.overflow-auto',
    ) as HTMLDivElement;
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

function createTailLargeViewer(
  overrides: Partial<LogLargeViewerVm> = {},
): LogLargeViewerVm {
  return {
    mode: 'tail',
    progressLabel: '4.0 MB / 100.0 MB loaded',
    statusLabel: 'Tail mode active',
    searchStatusLabel: '',
    searchQuery: '',
    matchCount: 0,
    activeMatchLineNumber: null,
    requestedScrollLine: null,
    topSpacerPx: 0,
    bottomSpacerPx: 0,
    lines: [],
    totalLines: 0,
    tailPreviewLines: ['line 1', 'line 2'],
    pendingBeforeLabel: null,
    pendingAfterLabel: null,
    canEnableWordWrap: false,
    downloadDisabled: true,
    ...overrides,
  };
}

function getLogLevelTokens(
  fixture: ComponentFixture<LogsDetailPanelComponent>,
): HTMLSpanElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('span.log-level-token'),
  ) as HTMLSpanElement[];
}

function getScrollContainer(
  fixture: ComponentFixture<LogsDetailPanelComponent>,
): HTMLDivElement {
  return fixture.nativeElement.querySelector('.overflow-auto') as HTMLDivElement;
}

function setScrollMetrics(
  element: HTMLDivElement,
  options: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  },
): void {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: options.clientHeight,
  });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: options.scrollHeight,
  });
  element.scrollTop = options.scrollTop;
}
