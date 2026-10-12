import { describe, expect, it } from 'vitest';
import { rscCacheKey } from './rsc-cache-key';

describe('rscCacheKey', () => {
  it('drops the per-navigation _rsc hash so a route has one stable key', () => {
    expect(rscCacheKey('https://x.test/game/abc/hand?_rsc=aaa')).toBe(
      rscCacheKey('https://x.test/game/abc/hand?_rsc=bbb'),
    );
  });

  it('keeps the path and any other query parameters', () => {
    expect(rscCacheKey('https://x.test/game/abc?_rsc=zzz&tab=1')).toBe(
      'https://x.test/game/abc?tab=1',
    );
  });

  it('keeps different routes distinct', () => {
    expect(rscCacheKey('https://x.test/game/abc?_rsc=a')).not.toBe(
      rscCacheKey('https://x.test/game/abc/hand?_rsc=a'),
    );
  });
});
