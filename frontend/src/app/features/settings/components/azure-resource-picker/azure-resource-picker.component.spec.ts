import { FormControl } from "@angular/forms";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Select } from "primeng/select";
import { beforeEach, describe, expect, it } from "vitest";

import type {
  AzureContainer,
  AzureStorageAccount,
  AzureSubscription,
} from "@app/features/settings/models/azure.model";
import {
  initializeI18nForTests,
  provideTranslateTesting,
} from "@app/testing/translate-testing";

import { AzureResourcePickerComponent } from "./azure-resource-picker.component";

describe("AzureResourcePickerComponent", () => {
  let fixture: ComponentFixture<AzureResourcePickerComponent>;
  let component: AzureResourcePickerComponent;
  let subscriptionControl: FormControl<AzureSubscription | null>;
  let storageAccountControl: FormControl<AzureStorageAccount | null>;
  let containerControl: FormControl<AzureContainer | null>;

  beforeEach(async () => {
    subscriptionControl = new FormControl<AzureSubscription | null>(null);
    storageAccountControl = new FormControl<AzureStorageAccount | null>(null);
    containerControl = new FormControl<AzureContainer | null>(null);

    await TestBed.configureTestingModule({
      imports: [AzureResourcePickerComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    await initializeI18nForTests();
    fixture = TestBed.createComponent(AzureResourcePickerComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("subscriptionControl", subscriptionControl);
    fixture.componentRef.setInput(
      "storageAccountControl",
      storageAccountControl,
    );
    fixture.componentRef.setInput("containerControl", containerControl);
    fixture.componentRef.setInput("subscriptions", [createSubscription()]);
    fixture.componentRef.setInput("storageAccounts", [createStorageAccount()]);
    fixture.componentRef.setInput("containers", [createContainer()]);
  });

  it("binds the passed form controls to the PrimeNG selects", () => {
    const subscription = createSubscription();
    const storageAccount = createStorageAccount();
    const container = createContainer();

    subscriptionControl.setValue(subscription);
    storageAccountControl.setValue(storageAccount);
    containerControl.setValue(container);
    fixture.detectChanges();

    const selects = fixture.debugElement
      .queryAll(By.directive(Select))
      .map((debugElement) => {
        return debugElement.componentInstance as Select;
      });

    expect(selects).toHaveLength(3);
    expect(component.subscriptionControl().value).toBe(subscription);
    expect(component.storageAccountControl().value).toBe(storageAccount);
    expect(component.containerControl().value).toBe(container);
  });

  it("disables dependent selects until their parent selection exists", () => {
    storageAccountControl.disable();
    containerControl.disable();
    fixture.detectChanges();

    expect(component.storageAccountControl().disabled).toBe(true);
    expect(component.containerControl().disabled).toBe(true);

    subscriptionControl.setValue(createSubscription());
    storageAccountControl.enable();
    fixture.detectChanges();

    expect(component.storageAccountControl().disabled).toBe(false);
    expect(component.containerControl().disabled).toBe(true);

    storageAccountControl.setValue(createStorageAccount());
    containerControl.enable();
    fixture.detectChanges();

    expect(component.containerControl().disabled).toBe(false);
  });
});

function createSubscription(): AzureSubscription {
  return {
    id: "sub-1",
    displayName: "Production",
    tenantId: "tenant-1",
    state: "Enabled",
  };
}

function createStorageAccount(): AzureStorageAccount {
  return {
    id: "acc-1",
    name: "storage-a",
    location: "westeurope",
    kind: "StorageV2",
    resourceGroup: "rg-1",
    subscriptionId: "sub-1",
  };
}

function createContainer(): AzureContainer {
  return {
    name: "logs",
    lastModified: "2026-04-13T10:30:00Z",
    leaseState: "available",
  };
}
