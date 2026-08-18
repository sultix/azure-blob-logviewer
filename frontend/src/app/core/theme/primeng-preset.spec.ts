import { describe, expect, it } from 'vitest';

import { ObsidianConsolePreset } from './primeng-preset';

describe('ObsidianConsolePreset', () => {
  it('uses the stronger dark-mode error tone for invalid form states', () => {
    const darkFormField = ObsidianConsolePreset.semantic.colorScheme.dark.formField;

    expect(darkFormField.invalidBorderColor).toBe('#ff8a80');
    expect(darkFormField.invalidPlaceholderColor).toBe('#ff8a80');
    expect(darkFormField.floatLabelInvalidColor).toBe('#ff8a80');
  });

  it('gives light-mode success and warn toasts readable text colors', () => {
    const lightToast = ObsidianConsolePreset.components.toast.colorScheme.light;

    expect(lightToast.success.color).toBe('#166534');
    expect(lightToast.success.detailColor).toBe('#334155');
    expect(lightToast.warn.color).toBe('#92400e');
    expect(lightToast.warn.detailColor).toBe('#334155');
  });
});
