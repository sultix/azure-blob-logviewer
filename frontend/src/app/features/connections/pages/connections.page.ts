import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { lastValueFrom } from 'rxjs';

import { AzureService } from '@app/features/settings/services/azure.service';

import { ConnectionsService } from '../services/connections.service';
import type {
  ConnectionStatus,
  StorageConnection,
} from '../models/storage-connection.model';
import {
  AddConnectionDialogComponent,
  type AddConnectionResult,
} from '../components/add-connection-dialog.component';

interface ConnectionCardVm {
  id: string;
  name: string;
  displayName: string;
  environment: string;
  accessTier: string;
  stateText: string;
  statusIcon: string;
  statusColorClass: string;
  lastUsedRelative: string;
  isOffline: boolean;
  raw: StorageConnection;
}

@Component({
  selector: 'app-connections-page',
  imports: [FormsModule, RouterLink, ConfirmDialog],
  providers: [DialogService, ConfirmationService],
  templateUrl: './connections.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsPage implements OnInit {
  private readonly connectionsService = inject(ConnectionsService);
  private readonly router = inject(Router);
  private readonly azure = inject(AzureService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly status = this.connectionsService.status;
  readonly errorMessage = this.connectionsService.errorMessage;
  readonly isEmpty = this.connectionsService.isEmpty;
  readonly isAuthenticated = this.azure.isAuthenticated;

  readonly searchTerm = signal('');

  readonly totalContainers = computed(() => {
    const total = this.connectionsService
      .connections()
      .reduce((sum, connection) => sum + (connection.containerCount ?? 0), 0);
    return total.toString().padStart(2, '0');
  });

  readonly cards = computed<ConnectionCardVm[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.connectionsService.connections();
    const filtered = term
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.displayName.toLowerCase().includes(term) ||
            c.environment.toLowerCase().includes(term)
        )
      : list;
    return filtered.map((c) => this.toCardVm(c));
  });

  ngOnInit(): void {
    void this.connectionsService.load();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openDialog(): void {
    const ref = this.dialogService.open(AddConnectionDialogComponent, {
      header: 'Add Storage Connection',
      closable: true,
      modal: true,
      width: '512px',
      contentStyle: { overflow: 'visible' },
    });
    if (!ref) return;
    void lastValueFrom(ref.onClose).then((result: AddConnectionResult | null | undefined) => {
      if (!result) return;
      const { name, subscription, storageAccount, container } = result;
      const id = `${storageAccount.name}-${container.name}-${Date.now()}`;
      this.connectionsService.add({
        id,
        name,
        displayName: `${storageAccount.name} / ${container.name}`,
        environment: 'production',
        status: 'online',
        lastUsed: new Date().toISOString(),
        accessTier: 'Hot',
        stateText: 'Connected',
        containerCount: 1,
        subscriptionId: subscription.id,
        resourceGroup: storageAccount.resourceGroup,
        storageAccountName: storageAccount.name,
        containerName: container.name,
      });
    });
  }

  openLogs(card: ConnectionCardVm): void {
    this.connectionsService.select(card.id);
    void this.router.navigate(['/logs', card.id]);
  }

  requestRemove(card: ConnectionCardVm): void {
    this.confirmationService.confirm({
      header: 'Remove Connection',
      message: `Remove ${card.name} from saved storage connections?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      closeOnEscape: true,
      dismissableMask: true,
      accept: () => {
        this.connectionsService.remove(card.id);
      },
    });
  }

  private toCardVm(c: StorageConnection): ConnectionCardVm {
    return {
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      environment: c.environment,
      accessTier: c.accessTier,
      stateText: c.stateText,
      statusIcon: this.mapStatusIcon(c.status),
      statusColorClass: this.mapStatusColor(c.status),
      lastUsedRelative: this.formatRelative(c.lastUsed),
      isOffline: c.status === 'offline' || c.status === 'error',
      raw: c,
    };
  }

  private mapStatusIcon(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return 'pi-check-circle';
      case 'syncing':
        return 'pi-sync pi-spin';
      case 'offline':
        return 'pi-power-off';
      case 'error':
        return 'pi-exclamation-triangle';
    }
  }

  private mapStatusColor(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return 'text-primary';
      case 'syncing':
        return 'text-tertiary';
      case 'offline':
        return 'text-on-surface-variant';
      case 'error':
        return 'text-error';
    }
  }

  private formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }
}
