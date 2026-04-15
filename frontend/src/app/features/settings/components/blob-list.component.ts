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
  templateUrl: './blob-list.component.html',
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

  get loadingValue(): boolean {
    return this.loading();
  }

  get errorValue(): string | null {
    return this.error();
  }

  get rowsValue(): BlobRowVm[] {
    return this.rows();
  }

  get isEmptyValue(): boolean {
    return this.rowsValue.length === 0;
  }

  get selectedBlobNameValue(): string | null {
    return this.selectedBlobName();
  }

  get blobContentLoadingValue(): boolean {
    return this.blobContentLoading();
  }

  get blobContentValue(): string | null {
    return this.blobContent();
  }

  get hasBlobContentValue(): boolean {
    return this.blobContentValue !== null;
  }

  copyContent(): void {
    const content = this.blobContent();
    if (content) {
      void navigator.clipboard.writeText(content);
    }
  }
}
