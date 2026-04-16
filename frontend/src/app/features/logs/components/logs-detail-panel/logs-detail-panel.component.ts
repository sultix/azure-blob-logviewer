import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  type OnDestroy,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { SettingsService } from '@app/features/settings/services/settings.service';
import type {
  LogFooterVm,
  LogLargeViewerVm,
  LogsStatus,
  LogToolbarVm,
} from '../../models/logs-view.model';

interface ContentSearchVm {
  readonly matchCount: number;
  readonly html: string;
}

interface RenderedTailPreviewLineVm {
  readonly lineNumber: number;
  readonly html: string;
}

interface RenderedLargeLineVm {
  readonly lineNumber: number;
  readonly html: string;
}

interface NormalizedToolbarVm {
  readonly title: string;
  readonly subtitle: string;
  readonly metaBadges: string[];
}

const CONTENT_SEARCH_DELAY_MS = 120;
const LARGE_VIEW_LINE_HEIGHT_PX = 20;
const LARGE_VIEW_OVERSCAN_LINES = 16;
const MIN_CONTENT_SEARCH_QUERY_LENGTH = 3;

@Component({
  selector: 'app-logs-detail-panel',
  standalone: true,
  imports: [FormsModule, Menu, ToggleSwitch, Tooltip, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-full min-h-0 overflow-hidden',
  },
  templateUrl: './logs-detail-panel.component.html',
})
export class LogsDetailPanelComponent implements OnDestroy {
  private readonly i18n = inject(AppI18nService);
  private readonly settings = inject(SettingsService);

  readonly status = input.required<LogsStatus>();
  readonly errorMessage = input<string | null>(null);
  readonly hasSelection = input(false);
  readonly tailAvailable = input(false);
  readonly tailEnabled = input(false);
  readonly tailRefreshIntervalSeconds = input(10);
  readonly selectionKey = input('');
  readonly toolbar = input<LogToolbarVm | null>(null);
  readonly largeViewer = input<LogLargeViewerVm | null>(null);
  readonly content = input('');
  readonly contentErrorMessage = input<string | null>(null);
  readonly contentLoading = input(false);
  readonly downloadDisabled = input(false);
  readonly footer = input<LogFooterVm | null>(null);

  readonly downloadRequested = output<void>();
  readonly refreshRequested = output<void>();
  readonly largeSearchChanged = output<string>();
  readonly previousLargeMatchRequested = output<void>();
  readonly nextLargeMatchRequested = output<void>();
  readonly largeViewportChanged = output<{ startLine: number; lineCount: number }>();
  readonly largeScrollHandled = output<void>();
  readonly tailToggled = output<boolean>();

  private contentSearchApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScrolledMatchKey: string | null = null;
  private lastActiveMatch: HTMLElement | null = null;
  private lastLargeViewportKey: string | null = null;
  private lastRequestedLargeScrollLine: number | null = null;
  private lastAppliedSelectionKey: string | null = null;
  private readonly contentElement = viewChild('contentElement', {
    read: ElementRef<HTMLPreElement>,
  });
  private readonly contentScrollContainer = viewChild('contentScrollContainer', {
    read: ElementRef<HTMLDivElement>,
  });
  readonly contentSearchInput = signal('');
  private readonly contentSearchQuery = signal('');
  private readonly requestedMatchIndex = signal(0);
  readonly wordWrapEnabled = computed(() => this.settings.logs().wordWrapEnabled);
  readonly contentClass = computed(() =>
    this.wordWrapEnabled() ? 'whitespace-pre-wrap break-all' : 'whitespace-pre',
  );
  readonly largeLineContentClass = computed(
    () => 'inline-block min-w-full whitespace-pre leading-5',
  );
  readonly canToggleWordWrap = computed(
    () => this.largeViewer() === null && !this.tailEnabled(),
  );
  readonly isLargeViewer = computed(() => this.largeViewer() !== null);
  readonly largeViewerInfoLabel = computed(() => {
    const viewer = this.largeViewer();
    if (!viewer) {
      return '';
    }

    return viewer.mode === 'tail'
      ? this.i18n.translate('logs.detail.viewer.tailRefresh', {
          seconds: this.tailRefreshIntervalSeconds(),
        })
      : this.i18n.translate('logs.detail.viewer.wordWrapUnavailable');
  });
  readonly normalizedToolbar = computed<NormalizedToolbarVm | null>(() => {
    const toolbar = this.toolbar();
    if (!toolbar) {
      return null;
    }

    if (toolbar.title && toolbar.subtitle && toolbar.metaBadges) {
      return {
        title: toolbar.title,
        subtitle: toolbar.subtitle,
        metaBadges: [...toolbar.metaBadges].filter(
          (badge): badge is string => badge !== null,
        ),
      };
    }

    return {
      title: toolbar.blobName ?? '',
      subtitle: toolbar.path ?? '',
      metaBadges: [
        toolbar.sizeLabel
          ? this.i18n.translate('logs.detail.size', { value: toolbar.sizeLabel })
          : null,
        toolbar.created
          ? this.i18n.translate('logs.detail.created', { value: toolbar.created })
          : null,
        toolbar.lastModified
          ? this.i18n.translate('logs.detail.modified', { value: toolbar.lastModified })
          : null,
      ].filter((badge): badge is string => badge !== null),
    };
  });
  readonly renderedTailPreviewLines = computed<RenderedTailPreviewLineVm[]>(() => {
    const largeViewer = this.largeViewer();
    if (!largeViewer) {
      return [];
    }

    const query = largeViewer.searchQuery.trim();
    return largeViewer.tailPreviewLines.map((content, index) => ({
      lineNumber: index,
      html: renderLargeLineHtml(
        content,
        query,
        largeViewer.activeMatchLineNumber === index,
      ),
    }));
  });
  readonly renderedLargeLines = computed<RenderedLargeLineVm[]>(() => {
    const largeViewer = this.largeViewer();
    if (!largeViewer) {
      return [];
    }

    const query = largeViewer.searchQuery.trim();
    return largeViewer.lines.map((line) => ({
      lineNumber: line.lineNumber,
      html: renderLargeLineHtml(
        line.content,
        query,
        largeViewer.activeMatchLineNumber === line.lineNumber,
      ),
    }));
  });
  private readonly contentSearchBase = computed(() =>
    buildContentSearchBase(this.content(), this.contentSearchQuery().trim()),
  );
  private readonly activeContentSearchMatchIndex = computed(() => {
    const matchCount = this.contentSearchBase().matchCount;
    return matchCount === 0 ? -1 : Math.min(this.requestedMatchIndex(), matchCount - 1);
  });
  readonly contentSearch = computed<ContentSearchVm>(() =>
    buildContentSearch(this.contentSearchBase(), 0),
  );
  readonly hasContentSearchMatches = computed(() => {
    const largeViewer = this.largeViewer();
    if (largeViewer) {
      return largeViewer.matchCount > 0;
    }
    return (
      this.isContentSearchReady() &&
      !this.isContentSearchPending() &&
      this.contentSearch().matchCount > 0
    );
  });
  readonly hasActiveContentSearch = computed(
    () => this.contentSearchInput().trim().length > 0,
  );
  readonly isContentSearchReady = computed(
    () => this.contentSearchInput().trim().length >= MIN_CONTENT_SEARCH_QUERY_LENGTH,
  );
  private readonly isContentSearchPending = computed(
    () =>
      this.isContentSearchReady() &&
      this.contentSearchInput().trim() !== this.contentSearchQuery().trim(),
  );
  readonly mobileActionItems = computed<MenuItem[]>(() => [
    {
      label: this.i18n.translate('logs.detail.mobileActions.refresh'),
      icon: 'pi pi-refresh',
      command: () => this.refreshRequested.emit(),
    },
    {
      label: this.i18n.translate('logs.detail.mobileActions.download'),
      icon: 'pi pi-download',
      disabled: this.downloadDisabled(),
      command: () => this.downloadRequested.emit(),
    },
    ...(this.tailAvailable()
      ? [
          {
            label: this.tailEnabled()
              ? this.i18n.translate('logs.detail.mobileActions.tailOn')
              : this.i18n.translate('logs.detail.mobileActions.tailOff'),
            icon: 'pi pi-sync',
            command: () => this.toggleTail(),
          },
        ]
      : []),
    {
      label: this.wordWrapEnabled()
        ? this.i18n.translate('logs.detail.mobileActions.wordWrapOn')
        : this.i18n.translate('logs.detail.mobileActions.wordWrapOff'),
      icon: 'pi pi-align-left',
      disabled: !this.canToggleWordWrap(),
      command: () => this.toggleWordWrap(),
    },
  ]);
  readonly contentSearchMatchText = computed(() => {
    const largeViewer = this.largeViewer();
    if (largeViewer) {
      return largeViewer.searchStatusLabel;
    }

    if (!this.isContentSearchReady()) {
      return '';
    }

    if (this.isContentSearchPending()) {
      return this.i18n.translate('logs.detail.searching');
    }

    const matchCount = this.contentSearch().matchCount;
    const activeMatchIndex = this.activeContentSearchMatchIndex();

    if (matchCount === 0) {
      return this.i18n.translate('logs.detail.zeroMatches');
    }

    return `${activeMatchIndex + 1} / ${matchCount}`;
  });

  constructor() {
    effect(() => {
      const nextSelectionKey = this.selectionKey();
      if (this.lastAppliedSelectionKey === nextSelectionKey) {
        return;
      }

      this.lastAppliedSelectionKey = nextSelectionKey;
      this.resetContentSearchState();
    });

    afterRenderEffect(() => {
      const largeViewer = this.largeViewer();
      const scrollContainer = this.contentScrollContainer()?.nativeElement;

      if (largeViewer && scrollContainer) {
        this.emitLargeViewport(scrollContainer, largeViewer);

        if (
          largeViewer.requestedScrollLine !== null &&
          largeViewer.requestedScrollLine !== this.lastRequestedLargeScrollLine
        ) {
          scrollContainer.scrollTo({
            top: largeViewer.requestedScrollLine * LARGE_VIEW_LINE_HEIGHT_PX,
            behavior: 'auto',
          });
          this.lastRequestedLargeScrollLine = largeViewer.requestedScrollLine;
          this.largeScrollHandled.emit();
        }
        return;
      }

      this.lastLargeViewportKey = null;
      this.lastRequestedLargeScrollLine = null;

      if (this.contentLoading()) {
        this.lastActiveMatch = null;
        return;
      }

      const searchQuery = this.contentSearchQuery().trim();
      const activeMatchIndex = this.activeContentSearchMatchIndex();
      if (activeMatchIndex < 0) {
        this.lastScrolledMatchKey = null;
        this.lastActiveMatch?.classList.remove('active-search-match');
        this.lastActiveMatch = null;
        return;
      }

      const scrollKey = `${searchQuery}:${activeMatchIndex}:${this.content().length}`;
      const contentElement = this.contentElement()?.nativeElement;
      if (!scrollContainer || !contentElement) {
        return;
      }

      const matches = contentElement.querySelectorAll('mark.log-search-match');
      const activeMatch = (matches.item(activeMatchIndex) ?? null) as HTMLElement | null;
      this.lastActiveMatch?.classList.remove('active-search-match');
      activeMatch?.classList.add('active-search-match');
      this.lastActiveMatch = activeMatch;

      if (this.lastScrolledMatchKey === scrollKey) {
        return;
      }

      if (activeMatch) {
        scrollMatchIntoView(scrollContainer, activeMatch);
      }

      this.lastScrolledMatchKey = scrollKey;
    });
  }

  onWordWrapChange(value: boolean): void {
    this.updateWordWrap(value);
  }

  onTailChange(value: boolean): void {
    this.updateTail(value);
  }

  toggleWordWrap(): void {
    this.updateWordWrap(!this.wordWrapEnabled());
  }

  toggleTail(): void {
    this.updateTail(!this.tailEnabled());
  }

  onContentSearchChange(value: string): void {
    this.contentSearchInput.set(value);

    if (this.largeViewer()) {
      this.largeSearchChanged.emit(
        value.trim().length >= MIN_CONTENT_SEARCH_QUERY_LENGTH ? value : '',
      );
      return;
    }

    this.queueContentSearch(value);
  }

  clearContentSearch(): void {
    this.resetContentSearchState();

    if (this.largeViewer()) {
      this.largeSearchChanged.emit('');
    }
  }

  scrollToPreviousMatch(): void {
    if (this.largeViewer()) {
      if (this.hasContentSearchMatches()) {
        this.previousLargeMatchRequested.emit();
      }
      return;
    }

    const matchCount = this.contentSearch().matchCount;
    const activeMatchIndex = this.activeContentSearchMatchIndex();
    if (matchCount === 0) {
      return;
    }

    this.requestedMatchIndex.set(
      activeMatchIndex <= 0 ? matchCount - 1 : activeMatchIndex - 1,
    );
  }

  scrollToNextMatch(): void {
    if (this.largeViewer()) {
      if (this.hasContentSearchMatches()) {
        this.nextLargeMatchRequested.emit();
      }
      return;
    }

    const matchCount = this.contentSearch().matchCount;
    const activeMatchIndex = this.activeContentSearchMatchIndex();
    if (matchCount === 0) {
      return;
    }

    this.requestedMatchIndex.set(
      activeMatchIndex >= matchCount - 1 ? 0 : activeMatchIndex + 1,
    );
  }

  onLargeViewerScroll(): void {
    const largeViewer = this.largeViewer();
    const scrollContainer = this.contentScrollContainer()?.nativeElement;
    if (!largeViewer || !scrollContainer) {
      return;
    }

    this.emitLargeViewport(scrollContainer, largeViewer);
  }

  ngOnDestroy(): void {
    this.clearContentSearchApplyTimer();
  }

  private emitLargeViewport(
    scrollContainer: HTMLDivElement,
    largeViewer: LogLargeViewerVm,
  ): void {
    if (largeViewer.tailPreviewLines.length > 0) {
      return;
    }

    const visibleLineCount =
      Math.ceil(scrollContainer.clientHeight / LARGE_VIEW_LINE_HEIGHT_PX) +
      LARGE_VIEW_OVERSCAN_LINES * 2;
    const startLine = Math.max(
      Math.floor(scrollContainer.scrollTop / LARGE_VIEW_LINE_HEIGHT_PX) -
        LARGE_VIEW_OVERSCAN_LINES,
      0,
    );
    const viewportKey = `${startLine}:${visibleLineCount}:${largeViewer.totalLines}`;
    const shouldRetryEmptyViewport =
      largeViewer.tailPreviewLines.length === 0 &&
      largeViewer.lines.length === 0 &&
      largeViewer.totalLines > 0;
    if (!shouldRetryEmptyViewport && this.lastLargeViewportKey === viewportKey) {
      return;
    }

    this.lastLargeViewportKey = viewportKey;
    this.largeViewportChanged.emit({
      startLine,
      lineCount: visibleLineCount,
    });
  }

  private queueContentSearch(value: string): void {
    this.clearContentSearchApplyTimer();

    this.contentSearchApplyTimer = setTimeout(() => {
      this.contentSearchQuery.set(
        value.trim().length >= MIN_CONTENT_SEARCH_QUERY_LENGTH ? value : '',
      );
      this.requestedMatchIndex.set(0);
      this.lastScrolledMatchKey = null;
      this.contentSearchApplyTimer = null;
    }, CONTENT_SEARCH_DELAY_MS);
  }

  private clearContentSearchApplyTimer(): void {
    if (this.contentSearchApplyTimer === null) {
      return;
    }

    clearTimeout(this.contentSearchApplyTimer);
    this.contentSearchApplyTimer = null;
  }

  private resetContentSearchState(): void {
    this.clearContentSearchApplyTimer();
    this.contentSearchInput.set('');
    this.contentSearchQuery.set('');
    this.requestedMatchIndex.set(0);
    this.lastScrolledMatchKey = null;
  }

  private updateWordWrap(value: boolean): void {
    if (!this.canToggleWordWrap()) {
      return;
    }

    this.settings.updateLogsPreferences({ wordWrapEnabled: value });
  }

  private updateTail(value: boolean): void {
    if (!this.tailAvailable()) {
      return;
    }

    this.tailToggled.emit(value);
  }
}

interface ContentSearchBase {
  readonly content: string;
  readonly matchCount: number;
  readonly queryLength: number;
  readonly matchIndices: readonly number[];
}

function buildContentSearchBase(content: string, query: string): ContentSearchBase {
  if (
    query.length < MIN_CONTENT_SEARCH_QUERY_LENGTH ||
    content.length === 0
  ) {
    return {
      content,
      matchCount: 0,
      queryLength: query.length,
      matchIndices: [],
    };
  }

  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matchIndices: number[] = [];
  let searchStart = 0;

  while (searchStart < content.length) {
    const matchIndex = normalizedContent.indexOf(normalizedQuery, searchStart);

    if (matchIndex === -1) {
      break;
    }

    matchIndices.push(matchIndex);
    searchStart = matchIndex + query.length;
  }

  return {
    content,
    matchCount: matchIndices.length,
    queryLength: query.length,
    matchIndices,
  };
}

function buildContentSearch(
  searchBase: ContentSearchBase,
  initialActiveMatchIndex: number,
): ContentSearchVm {
  const { content, matchCount, matchIndices, queryLength } = searchBase;
  if (matchCount === 0 || queryLength === 0) {
    return {
      matchCount,
      html: escapeHtml(content),
    };
  }

  let html = '';
  let searchStart = 0;

  let matchNumber = 0;

  for (const matchIndex of matchIndices) {
    if (matchIndex > searchStart) {
      html += escapeHtml(content.slice(searchStart, matchIndex));
    }

    html += `<mark class="log-search-match ${
      matchNumber === initialActiveMatchIndex ? 'active-search-match ' : ''
    }bg-primary-container/20 text-on-surface">${escapeHtml(
      content.slice(matchIndex, matchIndex + queryLength),
    )}</mark>`;

    searchStart = matchIndex + queryLength;
    matchNumber += 1;
  }

  if (searchStart < content.length) {
    html += escapeHtml(content.slice(searchStart));
  }

  return {
    matchCount,
    html,
  };
}

function highlightContent(content: string, query: string, isActive: boolean): string {
  if (query.length === 0 || content.length === 0) {
    return escapeHtml(content);
  }

  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matchIndex = normalizedContent.indexOf(normalizedQuery);
  if (matchIndex === -1) {
    return escapeHtml(content);
  }

  const before = escapeHtml(content.slice(0, matchIndex));
  const match = escapeHtml(content.slice(matchIndex, matchIndex + query.length));
  const after = escapeHtml(content.slice(matchIndex + query.length));
  const activeClass = isActive ? ' active-search-match' : '';

  return `${before}<mark class="log-search-match${activeClass} bg-primary-container/20 text-on-surface">${match}</mark>${after}`;
}

function renderLargeLineHtml(content: string, query: string, isActive: boolean): string {
  if (query.length === 0) {
    return escapeHtml(content);
  }

  return highlightContent(content, query, isActive);
}

function scrollMatchIntoView(
  scrollContainer: HTMLDivElement,
  activeMatch: HTMLElement,
): void {
  const containerRect = scrollContainer.getBoundingClientRect();
  const matchRect = activeMatch.getBoundingClientRect();

  if (matchRect.top >= containerRect.top && matchRect.bottom <= containerRect.bottom) {
    return;
  }

  const offsetTop = matchRect.top - containerRect.top + scrollContainer.scrollTop - 16;
  scrollContainer.scrollTo({
    top: Math.max(offsetTop, 0),
    behavior: 'auto',
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
