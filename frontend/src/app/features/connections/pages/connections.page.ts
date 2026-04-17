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
import type { MenuItem } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
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
} from '../components/add-connection-dialog/add-connection-dialog.component';

interface ConnectionCardVm {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly displayName: string;
  readonly environment: string;
  readonly accessTier: string;
  readonly stateText: string;
  readonly statusIcon: string;
  readonly statusColorClass: string;
  readonly lastUsedRelative: string;
  readonly isOffline: boolean;
  readonly actionMenuItems: MenuItem[];
  readonly raw: StorageConnection;
}

interface PreparedConnectionCardVm extends ConnectionCardVm {
  readonly searchText: string;
}

interface ConnectionCardGroupVm {
  key: string;
  label: string;
  cards: ConnectionCardVm[];
}

interface AzureCliCardStyleVm {
  readonly containerClass: string;
  readonly eyebrowClass: string;
  readonly descriptionClass: string;
  readonly iconClass: string;
}

interface ConnectionsPageVm {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly errorMessage: string | null;
  readonly isEmpty: boolean;
  readonly isAuthenticated: boolean;
  readonly totalContainers: string;
  readonly azureCliCardStyle: AzureCliCardStyleVm;
  readonly cards: ConnectionCardVm[];
  readonly showCategoryGroups: boolean;
  readonly cardGroups: ConnectionCardGroupVm[];
}

const DEFAULT_AZURE_CLI_CARD_STYLE: AzureCliCardStyleVm = {
  containerClass: 'border-primary/15 bg-surface-container',
  eyebrowClass: 'text-on-surface-variant',
  descriptionClass: 'text-on-surface',
  iconClass: 'bg-surface-container-high text-on-surface-variant',
};

const MISSING_AZURE_CLI_CARD_STYLE: AzureCliCardStyleVm = {
  containerClass: 'border-error/40 bg-error-container/70',
  eyebrowClass: 'text-error',
  descriptionClass: 'text-on-surface',
  iconClass: 'bg-error-container text-error',
};

@Component({
  selector: 'app-connections-page',
  imports: [
    FormsModule,
    RouterLink,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    Menu,
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
    this.i18n.translate('connections.page.uncategorizedGroup'),
  );

  readonly preparedCards = computed<PreparedConnectionCardVm[]>(() =>
    this.connectionsService
      .connections()
      .map((connection) => this.toCardVm(connection, this.isAuthenticated())),
  );

  readonly pageVm = computed<ConnectionsPageVm>(() => {
    const preparedCards = this.preparedCards();
    const term = this.searchTerm().trim().toLowerCase();
    const cards = term
      ? preparedCards.filter((card) => card.searchText.includes(term))
      : preparedCards;
    const showCategoryGroups = cards.some((card) => Boolean(card.category));
    const cardGroups = showCategoryGroups
      ? buildCardGroups(cards, this.uncategorizedGroupLabel())
      : [];

    return {
      status: this.status(),
      errorMessage: this.errorMessage(),
      isEmpty: this.isEmpty(),
      isAuthenticated: this.isAuthenticated(),
      totalContainers: preparedCards
        .reduce((sum, connection) => sum + (connection.raw.containerCount ?? 0), 0)
        .toString()
        .padStart(2, '0'),
      azureCliCardStyle: this.azureCliMissing()
        ? MISSING_AZURE_CLI_CARD_STYLE
        : DEFAULT_AZURE_CLI_CARD_STYLE,
      cards,
      showCategoryGroups,
      cardGroups,
    };
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
    this.editConnection(card.raw);
  }

  openLogs(card: ConnectionCardVm): void {
    this.connectionsService.select(card.id);
    void this.router.navigate(['/logs', card.id]);
  }

  toggleCardActionsMenu(menu: Menu, event: Event): void {
    menu.toggle({
      currentTarget: event.currentTarget,
      relativeAlign: true,
    } as Event & { currentTarget: EventTarget | null; relativeAlign: boolean });
  }

  alignCardActionsMenu(menu: Menu): void {
    requestAnimationFrame(() => {
      const container = menu.container;
      if (!container) {
        return;
      }

      container.style.left = 'auto';
      container.style.right = '0';
      container.style.top = container.offsetTop + 5 + 'px';
    });
  }

  requestRemove(card: ConnectionCardVm): void {
    this.requestRemoveConnection(card.id, card.name);
  }

  private editConnection(connection: StorageConnection): void {
    this.openConnectionDialog('edit', connection);
  }

  private requestRemoveConnection(id: string, name: string): void {
    this.confirmationService.confirm({
      header: this.i18n.translate('connections.confirm.title'),
      message: this.i18n.translate('connections.confirm.message', { name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.i18n.translate('common.actions.remove'),
      rejectLabel: this.i18n.translate('common.actions.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      closeOnEscape: true,
      dismissableMask: true,
      accept: () => {
        this.connectionsService.remove(id);
      },
    });
  }

  private openConnectionDialog(
    mode: ConnectionDialogMode,
    initialConnection?: StorageConnection,
  ): void {
    const dialogData: ConnectionDialogData =
      mode === 'edit' && initialConnection ? { mode, initialConnection } : { mode };
    const ref = this.dialogService.open(AddConnectionDialogComponent, {
      header: this.i18n.translate(
        mode === 'edit' ? 'connections.dialog.editTitle' : 'connections.dialog.title',
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
          this.connectionsService.update(
            this.toUpdatedConnection(initialConnection, result),
          );
          return;
        }

        this.connectionsService.add(this.toNewConnection(result));
      },
    );
  }

  private toCardVm(
    c: StorageConnection,
    isAuthenticated: boolean,
  ): PreparedConnectionCardVm {
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
      actionMenuItems: this.buildActionMenuItems(c, isAuthenticated),
      searchText: [c.name, c.displayName, c.environment, category]
        .filter((value): value is string => Boolean(value))
        .join('\n')
        .toLowerCase(),
      raw: c,
    };
  }

  private buildActionMenuItems(
    connection: StorageConnection,
    isAuthenticated: boolean,
  ): MenuItem[] {
    return [
      {
        label: this.i18n.translate('common.actions.edit'),
        icon: 'pi pi-pencil',
        disabled: !isAuthenticated,
        command: () => {
          this.editConnection(connection);
        },
      },
      {
        label: this.i18n.translate('common.actions.remove'),
        icon: 'pi pi-trash',
        command: () => {
          this.requestRemoveConnection(connection.id, connection.name);
        },
      },
    ];
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

function buildCardGroups(
  cards: readonly ConnectionCardVm[],
  uncategorizedGroupLabel: string,
): ConnectionCardGroupVm[] {
  const groups: ConnectionCardGroupVm[] = [];
  const groupsByKey = new Map<string, ConnectionCardGroupVm>();
  const uncategorizedCards: ConnectionCardVm[] = [];

  for (const card of cards) {
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
      label: uncategorizedGroupLabel,
      cards: uncategorizedCards,
    });
  }

  return groups;
}
