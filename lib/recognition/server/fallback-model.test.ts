import { describe, expect, it } from 'vitest';
import { DEFAULT_FALLBACK_MODEL, resolveFallbackModel } from './fallback-model';

describe('resolveFallbackModel', () => {
  it.each([undefined, '', '   '])('uses the default when the value is %j', (raw) => {
    expect(resolveFallbackModel(raw)).toBe(DEFAULT_FALLBACK_MODEL);
  });

  it('uses a configured model, trimmed', () => {
    expect(resolveFallbackModel('  gemini-custom ')).toBe('gemini-custom');
  });

  it.each(['none', 'NONE', ' None '])('disables the fallback for %j', (raw) => {
    expect(resolveFallbackModel(raw)).toBeUndefined();
  });
});
