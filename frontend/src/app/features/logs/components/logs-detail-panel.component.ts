import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  type OnDestroy,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TranslatePipe } from "@ngx-translate/core";
import type { MenuItem } from "primeng/api";
import { Menu } from "primeng/menu";
import { ToggleSwitch } from "primeng/toggleswitch";
import { Tooltip } from "primeng/tooltip";

import { AppI18nService } from "@app/core/i18n/app-i18n.service";
import { SettingsService } from "@app/features/settings/services/settings.service";
import type {
  LogFooterVm,
  LogsStatus,
  LogToolbarVm,
} from "../models/logs-view.model";

interface ContentSearchVm {
  readonly matchCount: number;
  readonly html: string;
}

const CONTENT_SEARCH_DELAY_MS = 120;

@Component({
  selector: "app-logs-detail-panel",
  standalone: true,
  imports: [FormsModule, Menu, ToggleSwitch, Tooltip, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "block h-full min-h-0 overflow-hidden",
  },
  templateUrl: "./logs-detail-panel.component.html",
})
export class LogsDetailPanelComponent implements OnDestroy {
  private readonly i18n = inject(AppI18nService);
  private readonly settings = inject(SettingsService);

  readonly status = input.required<LogsStatus>();
  readonly errorMessage = input<string | null>(null);
  readonly hasSelection = input(false);
  readonly toolbar = input<LogToolbarVm | null>(null);
  readonly content = input("");
  readonly contentErrorMessage = input<string | null>(null);
  readonly contentLoading = input(false);
  readonly footer = input<LogFooterVm | null>(null);

  readonly downloadRequested = output<void>();
  readonly refreshRequested = output<void>();

  private contentSearchApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScrolledMatchKey: string | null = null;
  private lastActiveMatch: HTMLElement | null = null;
  private readonly contentElement = viewChild("contentElement", {
    read: ElementRef<HTMLPreElement>,
  });
  private readonly contentScrollContainer = viewChild(
    "contentScrollContainer",
    {
      read: ElementRef<HTMLDivElement>,
    },
  );
  readonly contentSearchInput = signal("");
  private readonly contentSearchQuery = signal("");
  private readonly requestedMatchIndex = signal(0);
  readonly wordWrapEnabled = computed(
    () => this.settings.logs().wordWrapEnabled,
  );
  readonly contentClass = computed(() =>
    this.wordWrapEnabled() ? "whitespace-pre-wrap break-all" : "whitespace-pre",
  );
  private readonly contentSearchBase = computed(() =>
    buildContentSearchBase(this.content(), this.contentSearchQuery().trim()),
  );
  private readonly activeContentSearchMatchIndex = computed(() => {
    const matchCount = this.contentSearchBase().matchCount;
    return matchCount === 0
      ? -1
      : Math.min(this.requestedMatchIndex(), matchCount - 1);
  });
  readonly contentSearch = computed<ContentSearchVm>(() =>
    buildContentSearch(this.contentSearchBase(), 0),
  );
  readonly hasContentSearchMatches = computed(
    () => !this.isContentSearchPending() && this.contentSearch().matchCount > 0,
  );
  readonly hasActiveContentSearch = computed(
    () => this.contentSearchInput().trim().length > 0,
  );
  private readonly isContentSearchPending = computed(
    () => this.contentSearchInput().trim() !== this.contentSearchQuery().trim(),
  );
  readonly mobileActionItems = computed<MenuItem[]>(() => [
    {
      label: this.i18n.translate('logs.detail.mobileActions.refresh'),
      icon: "pi pi-refresh",
      command: () => this.refreshRequested.emit(),
    },
    {
      label: this.i18n.translate('logs.detail.mobileActions.download'),
      icon: "pi pi-download",
      command: () => this.downloadRequested.emit(),
    },
    {
      label: this.wordWrapEnabled()
        ? this.i18n.translate('logs.detail.mobileActions.wordWrapOn')
        : this.i18n.translate('logs.detail.mobileActions.wordWrapOff'),
      icon: "pi pi-align-left",
      command: () => this.toggleWordWrap(),
    },
  ]);
  readonly contentSearchMatchText = computed(() => {
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
    afterRenderEffect(() => {
      if (this.contentLoading()) {
        this.lastActiveMatch = null;
        return;
      }

      const searchQuery = this.contentSearchQuery().trim();
      const activeMatchIndex = this.activeContentSearchMatchIndex();
      if (activeMatchIndex < 0) {
        this.lastScrolledMatchKey = null;
        this.lastActiveMatch?.classList.remove("active-search-match");
        this.lastActiveMatch = null;
        return;
      }

      const scrollKey = `${searchQuery}:${activeMatchIndex}:${this.content().length}`;
      const scrollContainer = this.contentScrollContainer()?.nativeElement;
      const contentElement = this.contentElement()?.nativeElement;
      if (!scrollContainer || !contentElement) {
        return;
      }

      const matches = contentElement.querySelectorAll("mark.log-search-match");
      const activeMatch = (matches.item(activeMatchIndex) ??
        null) as HTMLElement | null;
      this.lastActiveMatch?.classList.remove("active-search-match");
      activeMatch?.classList.add("active-search-match");
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
    this.settings.updateLogsPreferences({ wordWrapEnabled: value });
  }

  toggleWordWrap(): void {
    this.settings.updateLogsPreferences({
      wordWrapEnabled: !this.wordWrapEnabled(),
    });
  }

  onContentSearchChange(value: string): void {
    this.contentSearchInput.set(value);
    this.queueContentSearch(value);
  }

  clearContentSearch(): void {
    this.clearContentSearchApplyTimer();
    this.contentSearchInput.set("");
    this.contentSearchQuery.set("");
    this.requestedMatchIndex.set(0);
    this.lastScrolledMatchKey = null;
  }

  scrollToPreviousMatch(): void {
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
    const matchCount = this.contentSearch().matchCount;
    const activeMatchIndex = this.activeContentSearchMatchIndex();
    if (matchCount === 0) {
      return;
    }

    this.requestedMatchIndex.set(
      activeMatchIndex >= matchCount - 1 ? 0 : activeMatchIndex + 1,
    );
  }

  ngOnDestroy(): void {
    this.clearContentSearchApplyTimer();
  }

  private queueContentSearch(value: string): void {
    this.clearContentSearchApplyTimer();

    this.contentSearchApplyTimer = setTimeout(() => {
      this.contentSearchQuery.set(value);
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
}

interface ContentSearchBase {
  readonly content: string;
  readonly matchCount: number;
  readonly queryLength: number;
  readonly matchIndices: readonly number[];
}

function buildContentSearchBase(
  content: string,
  query: string,
): ContentSearchBase {
  if (query.length === 0 || content.length === 0) {
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

  let html = "";
  let searchStart = 0;

  let matchNumber = 0;

  for (const matchIndex of matchIndices) {
    if (matchIndex > searchStart) {
      html += escapeHtml(content.slice(searchStart, matchIndex));
    }

    html += `<mark class="log-search-match ${
      matchNumber === initialActiveMatchIndex ? "active-search-match " : ""
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

function scrollMatchIntoView(
  scrollContainer: HTMLDivElement,
  activeMatch: HTMLElement,
): void {
  const containerRect = scrollContainer.getBoundingClientRect();
  const matchRect = activeMatch.getBoundingClientRect();
  const isAbove = matchRect.top < containerRect.top;
  const isBelow = matchRect.bottom > containerRect.bottom;

  if (!isAbove && !isBelow) {
    return;
  }

  const targetTop =
    scrollContainer.scrollTop +
    (matchRect.top - containerRect.top) -
    scrollContainer.clientHeight / 2 +
    matchRect.height / 2;

  scrollContainer.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "auto",
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
