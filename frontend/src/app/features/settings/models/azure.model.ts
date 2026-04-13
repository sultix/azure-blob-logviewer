export interface DeviceCodeInfo {
  userCode: string;
  verificationUrl: string;
  message: string;
}

export interface AzureAuthState {
  authenticated: boolean;
  userName?: string;
  errorMessage?: string;
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
