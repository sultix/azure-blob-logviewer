export interface LogEntry {
  id: string;
  container: string;
  blobName: string;
  timestamp: string;
  lastModified: string;
  size: number;
  isLive?: boolean;
  path?: string;
  modifiedRelative?: string;
  storageAccountName?: string;
  containerName?: string;
}
