import type { BlobFailureReason } from '@app/features/settings/models/azure.model';

export type BlobViewFocus = 'start' | 'end';
export type BlobViewMode = 'snapshot' | 'live';

export interface OpenBlobViewSessionRequest {
  accountName: string;
  containerName: string;
  blobName: string;
  versionId?: string;
  mode: BlobViewMode;
}

export interface BlobViewSessionStatus {
  sessionId: string;
  blobName: string;
  blobSize: number;
  contentType: string;
  bytesDownloaded: number;
  indexedLineCount: number;
  indexedThrough: number;
  isComplete: boolean;
  hasPendingBefore: boolean;
  hasPendingAfter: boolean;
  errorMessage?: string;
  failureReason?: BlobFailureReason;
  mode: BlobViewMode;
  focus: BlobViewFocus;
  livePreviewLines: string[];
}

export interface BlobViewLine {
  lineNumber: number;
  content: string;
}

export interface BlobViewLinesResponse {
  startLine: number;
  totalLines: number;
  isComplete: boolean;
  lines: BlobViewLine[];
}

export interface BlobViewSearchRequest {
  sessionId: string;
  query: string;
  cursor: number;
}

export interface BlobViewSearchMatch {
  lineNumber: number;
  preview: string;
}

export interface BlobViewSearchResponse {
  query: string;
  matches: BlobViewSearchMatch[];
  nextCursor: number;
  isComplete: boolean;
}

export interface BlobViewExportResult {
  cancelled: boolean;
}
