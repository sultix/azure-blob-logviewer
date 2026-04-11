import type { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'logs',
  },
  {
    path: 'logs',
    loadComponent: () =>
      import('./features/logs/pages/logs.page').then((m) => m.LogsPage),
  },
];
