export interface LogEntry {
  id: string;
  container: string;
  blobName: string;
  createdAt: string;
  lastModified: string;
  createdLabel: string;
  lastModifiedLabel: string;
  size: number;
  contentType?: string;
  isLive?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  remainingRetentionDays?: number;
  versionId?: string;
  hasVersionsOnly?: boolean;
  path?: string;
  createdRelative?: string;
  storageAccountName?: string;
  containerName?: string;
}
