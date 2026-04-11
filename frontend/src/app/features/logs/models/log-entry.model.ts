export interface LogEntry {
  id: string;
  container: string;
  blobName: string;
  timestamp: string;
  size: number;
  isLive?: boolean;
  path?: string;
  modifiedRelative?: string;
}
