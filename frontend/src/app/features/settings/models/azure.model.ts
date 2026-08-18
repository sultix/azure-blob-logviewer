export type AzureAuthFailureReason =
  '' | 'cli_not_available' | 'not_logged_in' | 'token_request_failed';

export type BlobFailureReason =
  '' | 'not_found' | 'access_denied' | 'too_large' | 'limit_exceeded' | 'download_failed';

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
  createdAt: string;
  lastModified: string;
  blobType: string;
  deleted: boolean;
  deletedAt: string;
  remainingRetentionDays: number;
  versionId?: string;
  hasVersionsOnly?: boolean;
}

export interface AzureBlobIdentityRequest {
  accountName: string;
  containerName: string;
  blobName: string;
}

export interface AzureBlobTextChunkRequest {
  accountName: string;
  containerName: string;
  blobName: string;
  versionId?: string;
  startOffset?: number | null;
  count?: number | null;
}

export interface RestoreAzureBlobRequest {
  accountName: string;
  containerName: string;
  blobName: string;
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
  errorMessage?: string;
  failureReason?: BlobFailureReason;
}
