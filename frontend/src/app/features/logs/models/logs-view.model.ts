export type LogsStatus = 'idle' | 'loading' | 'success' | 'error';
export type LogCreatedRange = [Date] | [Date, Date] | null;
export type LogContentMode = 'none' | 'single' | 'merged';

export enum LogSortBasis {
  Created = 'created',
  LastModified = 'lastModified',
}

export function isLogSortBasis(value: unknown): value is LogSortBasis {
  return value === LogSortBasis.Created || value === LogSortBasis.LastModified;
}

export interface LogFileRowVm {
  id: string;
  blobName: string;
  createdLabel: string;
  lastModifiedLabel: string;
  sizeLabel: string;
  isLive: boolean;
  isDeleted: boolean;
  deletedLabel?: string;
}

export interface LogFileSelectionEvent {
  id: string;
  additive: boolean;
}

export interface LogToolbarVm {
  connectionName?: string;
  title?: string;
  subtitle?: string;
  metaBadges?: string[];
  blobName?: string;
  path?: string;
  sizeLabel?: string;
  created?: string;
  lastModified?: string;
}

export interface LogContentWindowVm {
  rangeLabel: string;
  hasOlderContent: boolean;
  hasNewerContent: boolean;
}

export interface LogVirtualLineVm {
  lineNumber: number;
  content: string;
}

export type LogLargeViewerScrollCommand =
  | { kind: 'line'; lineNumber: number; requestId: number }
  | { kind: 'bottom'; requestId: number };

export interface LogLargeViewerVm {
  mode: 'snapshot' | 'live';
  progressLabel: string;
  statusLabel: string;
  searchStatusLabel: string;
  searchQuery: string;
  matchCount: number;
  activeMatchLineNumber: number | null;
  scrollCommand: LogLargeViewerScrollCommand | null;
  topSpacerPx: number;
  bottomSpacerPx: number;
  lines: LogVirtualLineVm[];
  totalLines: number;
  livePreviewLines: string[];
  pendingBeforeLabel: string | null;
  pendingAfterLabel: string | null;
  downloadDisabled: boolean;
}

export interface LogFooterVm {
  typeLabel?: string;
  lineCountLabel?: string;
  lineEndingsLabel?: string;
}
