import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { AzureAuthStep } from '../services/azure.service';

@Component({
  selector: 'app-azure-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (authStep()) {
      @case ('disconnected') {
        <div class="flex flex-col items-center gap-4 py-8">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container">
            <svg class="h-8 w-8 text-on-primary-container" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z"/>
            </svg>
          </div>
          <p class="text-sm text-on-surface-variant">
            Verbinden Sie sich mit Azure ueber Ihre lokale Azure CLI Session.
          </p>
          <p class="text-xs text-on-surface-variant">
            Stellen Sie sicher, dass Sie <code class="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-primary">az login</code> im Terminal ausgefuehrt haben.
          </p>
          <button
            class="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90"
            (click)="loginRequested.emit()"
          >
            Mit Azure verbinden
          </button>
        </div>
      }

      @case ('authenticating') {
        <div class="flex flex-col items-center gap-4 py-8">
          <div class="flex items-center gap-3 text-on-surface-variant">
            <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span class="text-sm">Verbinde mit Azure CLI...</span>
          </div>
          <p class="text-xs text-on-surface-variant">
            Azure CLI Session wird ueberprueft.
          </p>
        </div>
      }

      @case ('authenticated') {
        <div class="flex items-center justify-between rounded-xl border border-primary-container bg-surface-container p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container">
              <svg class="h-5 w-5 text-on-primary-container" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-on-surface">Authentifiziert</p>
              <p class="text-xs text-on-surface-variant">Verbindung zu Azure hergestellt</p>
            </div>
          </div>
          <button
            class="rounded-lg border border-error-container px-4 py-2 text-xs font-medium text-error transition hover:bg-error-container"
            (click)="logoutRequested.emit()"
          >
            Abmelden
          </button>
        </div>
      }

      @case ('error') {
        <div class="flex flex-col items-center gap-4 py-8">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-error-container">
            <svg class="h-6 w-6 text-error" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          @if (authError()) {
            <p class="max-w-md text-center text-sm text-error">{{ authError() }}</p>
          }
          <button
            class="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90"
            (click)="loginRequested.emit()"
          >
            Erneut versuchen
          </button>
        </div>
      }
    }
  `,
})
export class AzureLoginComponent {
  readonly authStep = input.required<AzureAuthStep>();
  readonly authError = input<string | null>(null);

  readonly loginRequested = output<void>();
  readonly logoutRequested = output<void>();
}
