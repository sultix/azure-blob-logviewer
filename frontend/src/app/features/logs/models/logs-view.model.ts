export type LogsStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LogFileRowVm {
  id: string;
  blobName: string;
  timestamp: string;
  sizeLabel: string;
  isLive: boolean;
}

export interface LogToolbarVm {
  blobName: string;
  path: string;
  sizeLabel: string;
  modified: string;
}

export interface LogFooterVm {
  typeLabel?: string;
  lineCountLabel?: string;
  lineEndingsLabel?: string;
}
