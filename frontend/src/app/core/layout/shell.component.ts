import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-shell',
  template: `
    <div class="flex h-full flex-col">
      <header
        class="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4"
      >
        <h1 class="text-lg font-semibold">Azure Blob Log Viewer</h1>
      </header>
      <main class="flex-1 overflow-auto p-6">
        <ng-content />
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {}
