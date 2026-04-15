export interface LogEntry {
  id: string;
  container: string;
  blobName: string;
  createdAt: string;
  createdLabel: string;
  size: number;
  contentType?: string;
  isLive?: boolean;
  path?: string;
  createdRelative?: string;
  storageAccountName?: string;
  containerName?: string;
}
