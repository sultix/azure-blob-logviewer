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
  path?: string;
  createdRelative?: string;
  storageAccountName?: string;
  containerName?: string;
}
