import type { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'connections',
  },
  {
    path: 'connections',
    loadComponent: () =>
      import('./features/connections/pages/connections.page').then(
        (m) => m.ConnectionsPage
      ),
  },
  {
    path: 'logs',
    loadComponent: () =>
      import('./features/logs/pages/logs.page').then((m) => m.LogsPage),
  },
  {
    path: 'logs/:connectionId',
    loadComponent: () =>
      import('./features/logs/pages/logs.page').then((m) => m.LogsPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/pages/settings.page').then(
        (m) => m.SettingsPage
      ),
  },
];
