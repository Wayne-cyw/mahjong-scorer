import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from './scrub';

describe('scrubSentryEvent', () => {
  it('removes request bodies, cookies, headers, user, extras and breadcrumbs', () => {
    const scrubbed = scrubSentryEvent({
      request: {
        url: 'https://app.example/game/1?name=Alice',
        query_string: 'name=Alice',
        data: { playerNames: ['Alice'] },
        cookies: { a: 'b' },
        headers: { cookie: 'a=b', 'user-agent': 'x' },
      },
      user: { id: '1', ip_address: '1.2.3.4' },
      extra: { playerNames: ['Alice'] },
      breadcrumbs: [{ message: 'Alice won', data: { name: 'Alice' } }],
    });

    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.url).toBe('https://app.example/game/1');
    expect(scrubbed.request?.headers).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
  });

  it('keeps the exception and tags so errors stay useful', () => {
    const scrubbed = scrubSentryEvent({
      exception: { values: [{ type: 'Error', value: 'boom' }] },
      tags: { commit: 'abc' },
    });
    expect(scrubbed.exception?.values?.[0]?.value).toBe('boom');
    expect(scrubbed.tags).toEqual({ commit: 'abc' });
  });
});
