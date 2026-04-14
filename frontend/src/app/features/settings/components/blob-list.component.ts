import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { AzureBlobItem } from '../models/azure.model';

interface BlobRowVm {
  name: string;
  formattedSize: string;
  lastModified: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

@Component({
  selector: 'app-blob-list',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="flex items-center gap-2 py-4 text-sm text-on-surface-variant">
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        {{ 'settings.blobList.loadingBlobs' | translate }}
      </div>
    } @else if (error()) {
      <p class="py-4 text-sm text-error">{{ error() }}</p>
    } @else if (rows().length === 0) {
      <p class="py-4 text-sm text-on-surface-variant">{{ 'settings.blobList.empty' | translate }}</p>
    } @else {
      <div class="flex flex-col gap-1">
        <div class="mb-1 grid grid-cols-[1fr_100px_160px_80px] gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          <span>{{ 'settings.blobList.headers.name' | translate }}</span>
          <span class="text-right">{{ 'settings.blobList.headers.size' | translate }}</span>
          <span>{{ 'settings.blobList.headers.modified' | translate }}</span>
          <span></span>
        </div>
        <div class="max-h-80 overflow-y-auto">
          @for (row of rows(); track row.name) {
            <div
              class="grid grid-cols-[1fr_100px_160px_80px] items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
              [class]="row.name === selectedBlobName() ? 'bg-primary-container/20' : 'hover:bg-surface-container-high'"
            >
              <span class="truncate font-mono text-xs text-on-surface" [title]="row.name">
                {{ row.name }}
              </span>
              <span class="text-right text-xs text-on-surface-variant">
                {{ row.formattedSize }}
              </span>
              <span class="text-xs text-on-surface-variant">
                {{ row.lastModified }}
              </span>
              <button
                class="rounded-md bg-surface-container-high px-2 py-1 text-xs font-medium text-primary transition hover:bg-surface-container-highest"
                (click)="viewRequested.emit(row.name)"
              >
                {{ 'common.actions.view' | translate }}
              </button>
            </div>
          }
        </div>
      </div>

      @if (blobContentLoading()) {
        <div class="mt-4 flex items-center gap-2 text-sm text-on-surface-variant">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          {{ 'settings.blobList.loadingContent' | translate }}
        </div>
      }
      @if (blobContent() !== null && !blobContentLoading()) {
        <div class="mt-4 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {{ 'settings.blobList.content' | translate: { name: selectedBlobName() } }}
            </p>
            <button
              class="rounded-md bg-surface-container-high px-2 py-1 text-xs font-medium text-secondary transition hover:bg-surface-container-highest"
              (click)="copyContent()"
            >
              {{ 'common.actions.copy' | translate }}
            </button>
          </div>
          <pre class="max-h-96 overflow-auto rounded-lg border border-surface-container-highest bg-surface-container p-4 font-mono text-xs text-on-surface">{{ blobContent() }}</pre>
        </div>
      }
    }
  `,
})
export class BlobListComponent {
  readonly blobs = input.required<AzureBlobItem[]>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly blobContent = input<string | null>(null);
  readonly blobContentLoading = input(false);
  readonly selectedBlobName = input<string | null>(null);

  readonly viewRequested = output<string>();

  readonly rows = computed<BlobRowVm[]>(() =>
    this.blobs().map((b) => ({
      name: b.name,
      formattedSize: formatBytes(b.size),
      lastModified: b.lastModified,
    }))
  );

  copyContent(): void {
    const content = this.blobContent();
    if (content) {
      void navigator.clipboard.writeText(content);
    }
  }
}
