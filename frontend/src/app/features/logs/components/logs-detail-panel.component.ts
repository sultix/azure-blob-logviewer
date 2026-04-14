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
  template: `
    <div class="flex h-full flex-col overflow-hidden bg-surface">
      @if (statusValue === "loading") {
        <div
          class="flex flex-1 items-center justify-center text-sm text-on-surface-variant"
        >
          {{ 'logs.detail.loading' | translate }}
        </div>
      } @else if (statusValue === "error") {
        <div class="flex flex-1 items-center justify-center text-sm text-error">
          {{ errorText }}
        </div>
      } @else if (!hasSelectionValue) {
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 text-on-surface-variant"
        >
          <i class="pi pi-file text-3xl"></i>
          <p class="text-sm">{{ 'logs.detail.empty' | translate }}</p>
        </div>
      } @else if (toolbarValue; as tb) {
        <header
          class="flex flex-wrap items-start justify-between gap-4 bg-surface-container-high px-6 py-4"
        >
          <div class="flex min-w-0 flex-col gap-1">
            <h2
              class="truncate font-display text-base font-semibold text-on-surface"
            >
              {{ tb.blobName }}
            </h2>
            <p class="truncate font-mono text-[11px] text-on-surface-variant">
              {{ tb.path }}
            </p>
            <div
              class="flex items-center gap-3 text-[10px] text-on-surface-variant"
            >
              <span
                class="rounded-full bg-surface-container-highest px-2 py-0.5"
              >
                {{ 'logs.detail.size' | translate: { value: tb.sizeLabel } }}
              </span>
              <span
                class="rounded-full bg-surface-container-highest px-2 py-0.5"
              >
                {{ 'logs.detail.modified' | translate: { value: tb.modified } }}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-start justify-end gap-4">
            <div class="flex flex-wrap items-center justify-end gap-4">
              <label
                for="logs-word-wrap"
                class="hidden items-center self-center gap-2 text-xs font-semibold text-on-surface 2xl:flex"
              >
                <span>{{ 'logs.detail.wordWrap' | translate }}</span>
                <p-toggleswitch
                  inputId="logs-word-wrap"
                  [ngModel]="wordWrapEnabledValue"
                  (ngModelChange)="onWordWrapChange($event)"
                  [ariaLabel]="'logs.detail.wordWrapToggleAriaLabel' | translate"
                />
              </label>
              <div
                class="flex min-w-[15rem] items-center gap-2 rounded-lg bg-surface-container-highest px-3 py-2"
              >
                <i class="pi pi-search text-[11px] text-on-surface-variant"></i>
                <input
                  type="text"
                  [placeholder]="'logs.detail.searchContentPlaceholder' | translate"
                  [ngModel]="contentSearchQueryValue"
                  (ngModelChange)="onContentSearchChange($event)"
                  class="min-w-0 flex-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                  [attr.aria-label]="'logs.detail.searchContentAriaLabel' | translate"
                />
                @if (hasActiveContentSearchValue) {
                  <button
                    type="button"
                    (click)="clearContentSearch()"
                    [pTooltip]="'logs.detail.clearSearch' | translate"
                    tooltipPosition="top"
                    [attr.aria-label]="'logs.detail.clearSearchAriaLabel' | translate"
                    class="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface hover:text-on-surface"
                  >
                    <i class="pi pi-times text-[10px]"></i>
                  </button>
                  <span
                    class="shrink-0 rounded-full bg-primary-container/20 px-2 py-0.5 text-[10px] font-semibold text-on-surface"
                  >
                    {{ contentSearchMatchLabel }}
                  </span>
                  <button
                    type="button"
                    (click)="scrollToPreviousMatch()"
                    [disabled]="!hasContentSearchMatchesValue"
                    [pTooltip]="'logs.detail.previousMatch' | translate"
                    tooltipPosition="top"
                    [attr.aria-label]="'logs.detail.previousMatchAriaLabel' | translate"
                    class="flex h-7 w-7 items-center justify-center rounded-md bg-surface text-on-surface transition-colors hover:bg-surface-bright disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i class="pi pi-chevron-up text-[10px]"></i>
                  </button>
                  <button
                    type="button"
                    (click)="scrollToNextMatch()"
                    [disabled]="!hasContentSearchMatchesValue"
                    [pTooltip]="'logs.detail.nextMatch' | translate"
                    tooltipPosition="top"
                    [attr.aria-label]="'logs.detail.nextMatchAriaLabel' | translate"
                    class="flex h-7 w-7 items-center justify-center rounded-md bg-surface text-on-surface transition-colors hover:bg-surface-bright disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i class="pi pi-chevron-down text-[10px]"></i>
                  </button>
                }
              </div>
              <div class="hidden 2xl:flex 2xl:items-center 2xl:gap-4">
                <button
                  type="button"
                  (click)="refreshRequested.emit()"
                  [pTooltip]="'logs.detail.mobileActions.refresh' | translate"
                  tooltipPosition="top"
                  [attr.aria-label]="'logs.detail.refreshAriaLabel' | translate"
                  class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface transition-colors hover:bg-surface-bright"
                >
                  <i class="pi pi-refresh text-xs"></i>
                </button>
                <button
                  type="button"
                  (click)="downloadRequested.emit()"
                  [pTooltip]="'logs.detail.mobileActions.download' | translate"
                  tooltipPosition="top"
                  [attr.aria-label]="'logs.detail.downloadAriaLabel' | translate"
                  class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface transition-colors hover:bg-surface-bright"
                >
                  <i class="pi pi-download text-xs"></i>
                </button>
              </div>
              <div class="2xl:hidden">
                <button
                  type="button"
                  (click)="moreActionsMenu.toggle($event)"
                  [attr.aria-label]="'logs.detail.moreActionsAriaLabel' | translate"
                  class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface transition-colors hover:bg-surface-bright"
                >
                  <i class="pi pi-ellipsis-v text-xs"></i>
                </button>
                <p-menu
                  #moreActionsMenu
                  [model]="mobileActionItemsValue"
                  [popup]="true"
                  appendTo="body"
                />
              </div>
            </div>
          </div>
        </header>

        <div
          #contentScrollContainer
          class="min-h-0 flex-1 overflow-auto bg-surface-container-lowest p-6 font-mono text-[12px] leading-relaxed text-on-surface"
        >
          @if (contentLoadingValue) {
            <div
              class="flex h-full items-center justify-center text-on-surface-variant"
            >
              {{ 'logs.detail.loadingContent' | translate }}
            </div>
          } @else if (contentErrorText) {
            <div class="flex h-full items-center justify-center text-sm text-error">
              {{ contentErrorText }}
            </div>
          } @else {
            <pre
              #contentElement
              [class]="contentClassName"
              [innerHTML]="contentHtmlValue"
            ></pre>
          }
        </div>

        @if (footerValue; as footerVm) {
          <footer
            class="flex items-center justify-between gap-4 bg-surface-container-high px-6 py-2 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
          >
            <div class="min-w-0">
              @if (footerVm.lineCountLabel; as lineCountLabel) {
                <span>{{ lineCountLabel }}</span>
              }
            </div>
            <div class="flex flex-wrap items-center justify-end gap-4">
              @if (footerVm.typeLabel; as typeLabel) {
                <span>{{ typeLabel }}</span>
              }
              @if (footerVm.lineEndingsLabel; as lineEndingsLabel) {
                <span>{{ lineEndingsLabel }}</span>
              }
            </div>
          </footer>
        }
      }
    </div>
  `,
})
export class LogsDetailPanelComponent implements OnDestroy {
  private readonly i18n = inject(AppI18nService);

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
  private readonly wordWrapEnabled = signal(false);
  private readonly contentSearchInput = signal("");
  private readonly contentSearchQuery = signal("");
  private readonly requestedMatchIndex = signal(0);
  private readonly contentClass = computed(() =>
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
  private readonly contentSearch = computed<ContentSearchVm>(() =>
    buildContentSearch(this.contentSearchBase(), 0),
  );
  private readonly hasContentSearchMatches = computed(
    () => !this.isContentSearchPending() && this.contentSearch().matchCount > 0,
  );
  private readonly hasActiveContentSearch = computed(
    () => this.contentSearchInput().trim().length > 0,
  );
  private readonly isContentSearchPending = computed(
    () => this.contentSearchInput().trim() !== this.contentSearchQuery().trim(),
  );
  private readonly mobileActionItems = computed<MenuItem[]>(() => [
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
  private readonly contentSearchMatchText = computed(() => {
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

  get statusValue(): LogsStatus {
    return this.status();
  }

  get errorText(): string | null {
    return this.errorMessage();
  }

  get hasSelectionValue(): boolean {
    return this.hasSelection();
  }

  get toolbarValue(): LogToolbarVm | null {
    return this.toolbar();
  }

  get contentText(): string {
    return this.content();
  }

  get contentLoadingValue(): boolean {
    return this.contentLoading();
  }

  get contentErrorText(): string | null {
    return this.contentErrorMessage();
  }

  get contentSearchQueryValue(): string {
    return this.contentSearchInput();
  }

  get hasActiveContentSearchValue(): boolean {
    return this.hasActiveContentSearch();
  }

  get hasContentSearchMatchesValue(): boolean {
    return this.hasContentSearchMatches();
  }

  get contentSearchMatchLabel(): string {
    return this.contentSearchMatchText();
  }

  get mobileActionItemsValue(): MenuItem[] {
    return this.mobileActionItems();
  }

  get contentHtmlValue(): string {
    return this.contentSearch().html;
  }

  get wordWrapEnabledValue(): boolean {
    return this.wordWrapEnabled();
  }

  get contentClassName(): string {
    return this.contentClass();
  }

  get footerValue(): LogFooterVm | null {
    return this.footer();
  }

  onWordWrapChange(value: boolean): void {
    this.wordWrapEnabled.set(value);
  }

  toggleWordWrap(): void {
    this.wordWrapEnabled.set(!this.wordWrapEnabled());
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
