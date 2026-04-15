import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { initializeI18nForTests, provideTranslateTesting } from '@app/testing/translate-testing';

import { AzureLoginComponent } from './azure-login.component';

describe('AzureLoginComponent', () => {
  let fixture: ComponentFixture<AzureLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AzureLoginComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(AzureLoginComponent);
  });

  it('shows the CLI missing warning in the disconnected state', () => {
    fixture.componentRef.setInput('authStep', 'disconnected');
    fixture.componentRef.setInput('azureCliMissing', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Azure CLI not found');
    expect(fixture.nativeElement.textContent).not.toContain('Make sure you have run az login in your terminal.');
  });

  it('keeps the normal disconnected hint when the CLI is available', () => {
    fixture.componentRef.setInput('authStep', 'disconnected');
    fixture.componentRef.setInput('azureCliMissing', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Make sure you have run az login in your terminal.');
    expect(fixture.nativeElement.textContent).not.toContain('Azure CLI not found');
  });
});
