import { describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from './gemini';
import { handleRecognize } from './handler';
import { DEFAULT_DAILY_CAP, GLOBAL_KEY, createLimiter, createMemoryLimiter } from './rate-limit';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const HAND = {
  isMahjongHand: true,
  concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z1', 'z1', 'z1', 'z5', 'z5'],
  melds: [],
  bonus: [],
  uncertain: [],
};

const setup = (env: Record<string, string | undefined> = {}) => {
  const create = vi.fn().mockResolvedValue({
    candidates: [{ finishReason: 'STOP' }],
    text: JSON.stringify(HAND),
    usageMetadata: { promptTokenCount: 1700, candidatesTokenCount: 90 },
  });
  const limiter = createMemoryLimiter(() => 0, env);
  const deps = () => ({
    client: { models: { generateContent: create } } as unknown as GeminiClient,
    limiter,
    model: 'test-model',
    log: () => {},
  });
  const call = (headers: Record<string, string> = {}) =>
    handleRecognize(
      new Request('http://localhost/api/recognize', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'image/jpeg', ...headers },
        body: JPEG,
      }),
      deps,
    );
  return { create, limiter, call };
};

describe('global daily cap', () => {
  it('stops model calls once the cap is reached, whoever is calling', async () => {
    const { create, call } = setup({ RECOGNITION_DAILY_CAP: '2' });
    expect((await call({ 'x-device-id': 'device-aaaaaa' })).status).toBe(200);
    expect((await call({ 'x-device-id': 'device-bbbbbb' })).status).toBe(200);
    const res = await call({ 'x-device-id': 'device-cccccc' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'budget-exhausted' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not charge the shared budget for requests a device limit already refused', async () => {
    const { create, limiter, call } = setup({ RECOGNITION_DAILY_CAP: '3' });
    for (let i = 0; i < 30; i++) await limiter.allow('device', 'device-aaaaaa');
    for (let i = 0; i < 5; i++) {
      expect((await call({ 'x-device-id': 'device-aaaaaa' })).status).toBe(429);
    }
    expect((await call({ 'x-device-id': 'device-bbbbbb' })).status).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('frees the cap after a day', async () => {
    let now = 0;
    const limiter = createMemoryLimiter(() => now, { RECOGNITION_DAILY_CAP: '1' });
    expect(await limiter.allow('global', GLOBAL_KEY)).toBe(true);
    expect(await limiter.allow('global', GLOBAL_KEY)).toBe(false);
    now = 23 * 60 * 60 * 1000;
    expect(await limiter.allow('global', GLOBAL_KEY)).toBe(false);
    now = 24 * 60 * 60 * 1000 + 1;
    expect(await limiter.allow('global', GLOBAL_KEY)).toBe(true);
  });

  it('uses the default when the cap is unset or empty', async () => {
    for (const unset of [undefined, '']) {
      const limiter = createLimiter({ NODE_ENV: 'development', RECOGNITION_DAILY_CAP: unset });
      for (let i = 0; i < DEFAULT_DAILY_CAP; i++) await limiter.allow('global', GLOBAL_KEY);
      expect(await limiter.allow('global', GLOBAL_KEY)).toBe(false);
    }
  });

  it('refuses to start with a malformed cap instead of guessing', () => {
    for (const bad of ['abc', '-5', '0', '1.5', '1e3x']) {
      expect(() => createLimiter({ NODE_ENV: 'development', RECOGNITION_DAILY_CAP: bad })).toThrow(
        'unavailable',
      );
    }
  });

  it('does not charge the cap for a body that is not an image', async () => {
    const { create, limiter, call } = setup({ RECOGNITION_DAILY_CAP: '1' });
    const res = await handleRecognize(
      new Request('http://localhost/api/recognize', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'image/jpeg' },
        body: new Uint8Array([1, 2, 3, 4]),
      }),
      () => ({
        client: { models: { generateContent: create } } as unknown as GeminiClient,
        limiter,
        model: 'test-model',
        log: () => {},
      }),
    );
    expect(res.status).toBe(400);
    expect((await call()).status).toBe(200);
  });
});
