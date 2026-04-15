export type AzureAuthFailureReason = '' | 'cli_not_available' | 'not_logged_in';

export interface DeviceCodeInfo {
  userCode: string;
  verificationUrl: string;
  message: string;
}

export interface AzureAuthState {
  authenticated: boolean;
  userName?: string;
  errorMessage?: string;
  failureReason?: AzureAuthFailureReason;
}

export interface AzureSubscription {
  id: string;
  displayName: string;
  tenantId: string;
  state: string;
}

export interface AzureStorageAccount {
  id: string;
  name: string;
  location: string;
  kind: string;
  resourceGroup: string;
  subscriptionId: string;
}

export interface AzureContainer {
  name: string;
  lastModified: string;
  leaseState: string;
}

export interface AzureBlobItem {
  name: string;
  size: number;
  contentType: string;
  lastModified: string;
  blobType: string;
}

export interface AzureBlobTextChunkRequest {
  accountName: string;
  containerName: string;
  blobName: string;
  startOffset?: number | null;
  count?: number | null;
}

export interface AzureBlobTextChunk {
  content: string;
  blobSize: number;
  contentType: string;
  etag: string;
  lastModified: string;
  startOffset: number;
  endOffsetExclusive: number;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  isLargeBlob: boolean;
}
