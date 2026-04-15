export type LogsStatus = 'idle' | 'loading' | 'success' | 'error';
export type LogCreatedRange = [Date] | [Date, Date] | null;

export interface LogFileRowVm {
  id: string;
  blobName: string;
  createdLabel: string;
  sizeLabel: string;
  isLive: boolean;
}

export interface LogToolbarVm {
  blobName: string;
  path: string;
  sizeLabel: string;
  created: string;
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

export interface LogLargeViewerVm {
  progressLabel: string;
  statusLabel: string;
  searchStatusLabel: string;
  searchQuery: string;
  matchCount: number;
  activeMatchLineNumber: number | null;
  requestedScrollLine: number | null;
  topSpacerPx: number;
  bottomSpacerPx: number;
  lines: LogVirtualLineVm[];
  totalLines: number;
  tailPreviewLines: string[];
  pendingBeforeLabel: string | null;
  pendingAfterLabel: string | null;
  canEnableWordWrap: boolean;
  downloadDisabled: boolean;
}

export interface LogFooterVm {
  typeLabel?: string;
  lineCountLabel?: string;
  lineEndingsLabel?: string;
}
