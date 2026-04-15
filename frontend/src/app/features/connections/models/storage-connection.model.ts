export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'error';
export type Environment = 'production' | 'staging' | 'development' | 'test';

export interface StorageConnection {
  id: string;
  name: string;
  category?: string;
  displayName: string;
  environment: Environment;
  status: ConnectionStatus;
  lastUsed: string;
  accessTier: 'Hot' | 'Cool' | 'Archive';
  stateText: string;
  containerCount?: number;
  subscriptionId?: string;
  resourceGroup?: string;
  storageAccountName?: string;
  containerName?: string;
}
