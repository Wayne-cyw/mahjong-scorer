import { describe, expect, it } from 'vitest';

import packageInfo from '../../package.json';
import { ENGINE_VERSION } from './index';

describe('ENGINE_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof ENGINE_VERSION).toBe('string');
    expect(ENGINE_VERSION.length).toBeGreaterThan(0);
  });

  it('matches the package version so stamped events are unchanged', () => {
    expect(ENGINE_VERSION).toBe(packageInfo.version);
  });
});
