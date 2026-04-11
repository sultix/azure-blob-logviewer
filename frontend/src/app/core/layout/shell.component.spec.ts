import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WindowControlsService } from '@app/core/services/window-controls.service';

import { ShellComponent } from './shell.component';

class WindowControlsServiceStub implements Partial<WindowControlsService> {
  readonly isMaximized = signal(false);
  minimize = vi.fn();
  toggleMaximize = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  close = vi.fn();
}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let controls: WindowControlsServiceStub;

  beforeEach(async () => {
    controls = new WindowControlsServiceStub();

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        { provide: WindowControlsService, useValue: controls },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  it('renders the maximize icon and label in the normal window state', () => {
    const maximizeButton = getMaximizeButton(fixture);
    const maximizeIcon = maximizeButton.querySelector('i');

    expect(maximizeButton.getAttribute('aria-label')).toBe('Maximize window');
    expect(maximizeIcon?.className).toContain('pi-window-maximize');
  });

  it('renders the restore icon and label in the maximized window state', () => {
    controls.isMaximized.set(true);
    fixture.detectChanges();

    const maximizeButton = getMaximizeButton(fixture);
    const maximizeIcon = maximizeButton.querySelector('i');

    expect(maximizeButton.getAttribute('aria-label')).toBe('Restore window');
    expect(maximizeIcon?.className).toContain('pi-clone');
  });
});

function getMaximizeButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
  const buttons = fixture.nativeElement.querySelectorAll('button');
  return buttons[1] as HTMLButtonElement;
}
