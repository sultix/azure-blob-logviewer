import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ConnectionsService } from '../services/connections.service';
import type {
  ConnectionStatus,
  StorageConnection,
} from '../models/storage-connection.model';

interface StatCard {
  label: string;
  value: string;
  icon: string;
  accent: 'primary' | 'secondary' | 'tertiary' | 'error';
}

interface ConnectionCardVm {
  id: string;
  name: string;
  displayName: string;
  environment: string;
  environmentLabel: string;
  accessTier: string;
  stateText: string;
  statusLabel: string;
  statusIcon: string;
  statusColorClass: string;
  lastUsedRelative: string;
  isOffline: boolean;
  raw: StorageConnection;
}

@Component({
  selector: 'app-connections-page',
  imports: [FormsModule],
  templateUrl: './connections.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsPage implements OnInit {
  private readonly connectionsService = inject(ConnectionsService);
  private readonly router = inject(Router);

  readonly status = this.connectionsService.status;
  readonly errorMessage = this.connectionsService.errorMessage;
  readonly isEmpty = this.connectionsService.isEmpty;

  readonly searchTerm = signal('');
  readonly dialogOpen = signal(false);
  readonly draftName = signal('');
  readonly draftAccount = signal('');

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

  readonly stats = computed<StatCard[]>(() => {
    const list = this.connectionsService.connections();
    const total = list.reduce((sum, c) => sum + (c.containerCount ?? 0), 0);
    const active = list.filter(
      (c) => c.status === 'online' || c.status === 'syncing'
    ).length;
    const errors = list.filter(
      (c) => c.status === 'error' || c.status === 'offline'
    ).length;
    return [
      {
        label: 'Total Containers',
        value: total.toString().padStart(2, '0'),
        icon: 'pi-database',
        accent: 'primary',
      },
      {
        label: 'Active Streams',
        value: active.toString().padStart(2, '0'),
        icon: 'pi-wave-pulse',
        accent: 'secondary',
      },
      {
        label: 'Error Events',
        value: errors.toString().padStart(2, '0'),
        icon: 'pi-exclamation-triangle',
        accent: 'error',
      },
      {
        label: 'Uptime',
        value: '99.9%',
        icon: 'pi-clock',
        accent: 'tertiary',
      },
    ];
  });

  ngOnInit(): void {
    void this.connectionsService.load();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openDialog(): void {
    this.draftName.set('');
    this.draftAccount.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  saveDraft(): void {
    const name = this.draftName().trim();
    const account = this.draftAccount().trim();
    if (!name || !account) return;
    const id = `${name}-${Date.now()}`;
    this.connectionsService.add({
      id,
      name,
      displayName: account,
      environment: 'development',
      status: 'offline',
      lastUsed: new Date().toISOString(),
      accessTier: 'Hot',
      stateText: 'Awaiting credentials',
      containerCount: 0,
    });
    this.dialogOpen.set(false);
  }

  openLogs(card: ConnectionCardVm): void {
    this.connectionsService.select(card.id);
    void this.router.navigate(['/logs', card.id]);
  }

  private toCardVm(c: StorageConnection): ConnectionCardVm {
    return {
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      environment: c.environment,
      environmentLabel: c.environment.toUpperCase(),
      accessTier: c.accessTier,
      stateText: c.stateText,
      statusLabel: this.mapStatusLabel(c.status),
      statusIcon: this.mapStatusIcon(c.status),
      statusColorClass: this.mapStatusColor(c.status),
      lastUsedRelative: this.formatRelative(c.lastUsed),
      isOffline: c.status === 'offline' || c.status === 'error',
      raw: c,
    };
  }

  private mapStatusLabel(status: ConnectionStatus): string {
    switch (status) {
      case 'online':
        return 'Online';
      case 'syncing':
        return 'Syncing';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
    }
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
