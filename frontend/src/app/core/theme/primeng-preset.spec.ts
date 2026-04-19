import { describe, expect, it } from 'vitest';

import { ObsidianConsolePreset } from './primeng-preset';

describe('ObsidianConsolePreset', () => {
  it('uses the stronger dark-mode error tone for invalid form states', () => {
    const darkFormField = ObsidianConsolePreset.semantic.colorScheme.dark.formField;

    expect(darkFormField.invalidBorderColor).toBe('#ff8a80');
    expect(darkFormField.invalidPlaceholderColor).toBe('#ff8a80');
    expect(darkFormField.floatLabelInvalidColor).toBe('#ff8a80');
  });
});
