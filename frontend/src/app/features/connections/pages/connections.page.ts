import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { lastValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { AppI18nService } from '@app/core/i18n/app-i18n.service';
import { AzureService } from '@app/features/settings/services/azure.service';

import { ConnectionsService } from '../services/connections.service';
import type {
  ConnectionStatus,
  StorageConnection,
} from '../models/storage-connection.model';
import {
  AddConnectionDialogComponent,
  type ConnectionDialogData,
  type ConnectionDialogMode,
  type ConnectionDialogResult,
} from '../components/add-connection-dialog.component';

interface ConnectionCardVm {
  id: string;
  name: string;
  category?: string;
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

interface ConnectionCardGroupVm {
  key: string;
  label: string;
  cards: ConnectionCardVm[];
}

@Component({
  selector: 'app-connections-page',
  imports: [
    FormsModule,
    RouterLink,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    NgTemplateOutlet,
    TranslatePipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './connections.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsPage implements OnInit {
  private readonly connectionsService = inject(ConnectionsService);
  private readonly router = inject(Router);
  private readonly azure = inject(AzureService);
  private readonly i18n = inject(AppI18nService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly status = this.connectionsService.status;
  readonly errorMessage = this.connectionsService.errorMessage;
  readonly isEmpty = this.connectionsService.isEmpty;
  readonly isAuthenticated = this.azure.isAuthenticated;
  readonly azureCliMissing = this.azure.azureCliMissing;

  readonly searchTerm = signal('');
  readonly uncategorizedGroupLabel = computed(() =>
    this.i18n.translate('connections.page.uncategorizedGroup')
  );

  readonly totalContainers = computed(() => {
    const total = this.connectionsService
      .connections()
      .reduce((sum, connection) => sum + (connection.containerCount ?? 0), 0);
    return total.toString().padStart(2, '0');
  });

  readonly azureCliCardStyle = computed(() =>
    this.azureCliMissing()
      ? {
          containerClass: 'border-error/40 bg-error-container/70',
          eyebrowClass: 'text-error',
          descriptionClass: 'text-on-surface',
          iconClass: 'bg-error text-white',
        }
      : {
          containerClass: 'border-primary/15 bg-surface-container',
          eyebrowClass: 'text-on-surface-variant',
          descriptionClass: 'text-on-surface',
          iconClass: 'bg-white/10 text-on-surface-variant',
        },
  );

  readonly cards = computed<ConnectionCardVm[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.connectionsService.connections();
    const filtered = term
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.displayName.toLowerCase().includes(term) ||
            c.environment.toLowerCase().includes(term) ||
            c.category?.toLowerCase().includes(term)
        )
      : list;
    return filtered.map((c) => this.toCardVm(c));
  });

  readonly showCategoryGroups = computed(() => this.cards().some((card) => !!card.category));

  readonly cardGroups = computed<ConnectionCardGroupVm[]>(() => {
    if (!this.showCategoryGroups()) return [];

    const groups: ConnectionCardGroupVm[] = [];
    const groupsByKey = new Map<string, ConnectionCardGroupVm>();
    const uncategorizedCards: ConnectionCardVm[] = [];

    for (const card of this.cards()) {
      if (!card.category) {
        uncategorizedCards.push(card);
        continue;
      }

      const groupKey = card.category.toLowerCase();
      let group = groupsByKey.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          label: card.category,
          cards: [],
        };
        groupsByKey.set(groupKey, group);
        groups.push(group);
      }
      group.cards.push(card);
    }

    if (uncategorizedCards.length > 0) {
      groups.push({
        key: '__uncategorized__',
        label: this.uncategorizedGroupLabel(),
        cards: uncategorizedCards,
      });
    }

    return groups;
  });

  ngOnInit(): void {
    void this.connectionsService.load();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openDialog(): void {
    this.openConnectionDialog('create');
  }

  openEditDialog(card: ConnectionCardVm): void {
    this.openConnectionDialog('edit', card.raw);
  }

  openLogs(card: ConnectionCardVm): void {
    this.connectionsService.select(card.id);
    void this.router.navigate(['/logs', card.id]);
  }

  requestRemove(card: ConnectionCardVm): void {
    this.confirmationService.confirm({
      header: this.i18n.translate('connections.confirm.title'),
      message: this.i18n.translate('connections.confirm.message', { name: card.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.i18n.translate('common.actions.remove'),
      rejectLabel: this.i18n.translate('common.actions.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      closeOnEscape: true,
      dismissableMask: true,
      accept: () => {
        this.connectionsService.remove(card.id);
      },
    });
  }

  private openConnectionDialog(mode: ConnectionDialogMode, initialConnection?: StorageConnection): void {
    const dialogData: ConnectionDialogData =
      mode === 'edit' && initialConnection
        ? { mode, initialConnection }
        : { mode };
    const ref = this.dialogService.open(AddConnectionDialogComponent, {
      header: this.i18n.translate(
        mode === 'edit' ? 'connections.dialog.editTitle' : 'connections.dialog.title'
      ),
      closable: true,
      modal: true,
      width: '512px',
      contentStyle: { overflow: 'visible' },
      data: dialogData,
    });
    if (!ref) return;

    void lastValueFrom(ref.onClose).then(
      (result: ConnectionDialogResult | null | undefined) => {
        if (!result) return;

        if (mode === 'edit' && initialConnection) {
          this.connectionsService.update(this.toUpdatedConnection(initialConnection, result));
          return;
        }

        this.connectionsService.add(this.toNewConnection(result));
      }
    );
  }

  private toCardVm(c: StorageConnection): ConnectionCardVm {
    const category = c.category?.trim();
    return {
      id: c.id,
      name: c.name,
      category: category || undefined,
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
    return this.i18n.formatRelativeFromNow(iso);
  }

  private toNewConnection(result: ConnectionDialogResult): StorageConnection {
    const { name, category, subscription, storageAccount, container } = result;

    return {
      id: uuidv4(),
      name,
      category,
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
    };
  }

  private toUpdatedConnection(
    current: StorageConnection,
    result: ConnectionDialogResult,
  ): StorageConnection {
    const { name, category, subscription, storageAccount, container } = result;

    return {
      ...current,
      name,
      category,
      displayName: `${storageAccount.name} / ${container.name}`,
      subscriptionId: subscription.id,
      resourceGroup: storageAccount.resourceGroup,
      storageAccountName: storageAccount.name,
      containerName: container.name,
    };
  }
}
