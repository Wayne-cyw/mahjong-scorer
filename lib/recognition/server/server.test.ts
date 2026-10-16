import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { RecognizeError } from '../errors';
import { recognizeImage, type GeminiClient } from './gemini';
import { handleRecognize, type LogLine } from './handler';
import { createLimiter, createMemoryLimiter } from './rate-limit';
import { MAX_IMAGE_BYTES, checkOrigin, clientIp, readDeviceId, readImage } from './request';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const HAND = {
  isMahjongHand: true,
  concealed: ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z1', 'z1', 'z1', 'z5', 'z5'],
  melds: [],
  bonus: [],
  uncertain: [],
};

const request = (init: { headers?: Record<string, string>; body?: BodyInit | null } = {}) =>
  new Request('http://localhost/api/recognize', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'image/jpeg', ...init.headers },
    body: init.body === undefined ? JPEG : init.body,
  });

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(RecognizeError);
    return (e as RecognizeError).code;
  }
  throw new Error('expected a RecognizeError');
};

const message = (over: Record<string, unknown> = {}) => ({
  candidates: [{ finishReason: 'STOP' }],
  text: JSON.stringify(HAND),
  usageMetadata: { promptTokenCount: 1700, candidatesTokenCount: 90 },
  ...over,
});

const fakeClient = (...responses: unknown[]) => {
  const create = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) create.mockRejectedValueOnce(r);
    else create.mockResolvedValueOnce(r);
  }
  return { client: { models: { generateContent: create } } as unknown as GeminiClient, create };
};

const httpError = (status: number) => new ApiError({ message: `http ${status}`, status });

const timeoutError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

describe('request checks', () => {
  it('accepts a same-origin request and honours x-forwarded-host', () => {
    expect(() => checkOrigin(request())).not.toThrow();
    const proxied = new Request('http://localhost:3000/api/recognize', {
      method: 'POST',
      headers: { origin: 'https://mahjong.example', 'x-forwarded-host': 'mahjong.example' },
    });
    expect(() => checkOrigin(proxied)).not.toThrow();
  });

  it.each([
    ['a foreign origin', { origin: 'https://evil.example' }],
    ['a malformed origin', { origin: 'not a url' }],
  ])('rejects %s', (_l, headers) => {
    expect(() => checkOrigin(request({ headers }))).toThrow(RecognizeError);
  });

  it('rejects a request with no Origin header', () => {
    const bare = new Request('http://localhost/api/recognize', { method: 'POST' });
    expect(() => checkOrigin(bare)).toThrow(RecognizeError);
  });

  it('accepts only well-formed device ids', () => {
    expect(readDeviceId(request({ headers: { 'x-device-id': 'a1b2-c3d4_e5' } }))).toBe(
      'a1b2-c3d4_e5',
    );
    expect(readDeviceId(request({ headers: { 'x-device-id': 'has spaces!' } }))).toBeNull();
    expect(readDeviceId(request({ headers: { 'x-device-id': 'x'.repeat(100) } }))).toBeNull();
    expect(readDeviceId(request())).toBeNull();
  });

  it('takes the first forwarded address as the client ip', () => {
    expect(clientIp(request({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }))).toBe(
      '203.0.113.9',
    );
    expect(
      clientIp(
        request({
          headers: { 'x-vercel-forwarded-for': '198.51.100.1', 'x-forwarded-for': '6.6.6.6' },
        }),
      ),
    ).toBe('198.51.100.1');
    expect(clientIp(request())).toBe('unknown');
  });
});

describe('readImage', () => {
  it.each([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/webp', WEBP],
  ])('reads %s', async (type, bytes) => {
    const image = await readImage(request({ headers: { 'content-type': type }, body: bytes }));
    expect(image.mediaType).toBe(type);
    expect(image.bytes.length).toBe(bytes.length);
  });

  it('rejects unsupported content types', async () => {
    const req = request({ headers: { 'content-type': 'application/pdf' } });
    expect(await code(readImage(req))).toBe('unsupported-type');
  });

  it('rejects an oversize declared length before reading', async () => {
    const req = request({ headers: { 'content-length': String(MAX_IMAGE_BYTES + 1) } });
    expect(await code(readImage(req))).toBe('too-large');
  });

  it('rejects an oversize body that under-declares its length', async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 10);
    big.set(JPEG);
    expect(await code(readImage(request({ body: big })))).toBe('too-large');
  });

  it('rejects an empty body and a body that does not match its type', async () => {
    expect(await code(readImage(request({ body: new Uint8Array() })))).toBe('not-a-photo');
    expect(await code(readImage(request({ body: PNG })))).toBe('not-a-photo');
  });
});

describe('rate limiting', () => {
  it('allows the limit then blocks, per key', async () => {
    const limiter = createMemoryLimiter(() => 0);
    for (let i = 0; i < 30; i++) expect(await limiter.allow('device', 'd1')).toBe(true);
    expect(await limiter.allow('device', 'd1')).toBe(false);
    expect(await limiter.allow('device', 'd2')).toBe(true);
    for (let i = 0; i < 60; i++) expect(await limiter.allow('ip', '1.1.1.1')).toBe(true);
    expect(await limiter.allow('ip', '1.1.1.1')).toBe(false);
  });

  it('frees capacity after the one-hour window', async () => {
    let now = 0;
    const limiter = createMemoryLimiter(() => now);
    for (let i = 0; i < 30; i++) await limiter.allow('device', 'd1');
    expect(await limiter.allow('device', 'd1')).toBe(false);
    now = 60 * 60 * 1000 + 1;
    expect(await limiter.allow('device', 'd1')).toBe(true);
  });

  it('falls back to memory outside production when Upstash is not configured', () => {
    expect(() => createLimiter({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('refuses to run unlimited in production without Upstash config', () => {
    try {
      createLimiter({ NODE_ENV: 'production' });
      throw new Error('expected a RecognizeError');
    } catch (e) {
      expect((e as RecognizeError).code).toBe('unavailable');
    }
  });
});

describe('recognizeImage', () => {
  const image = { bytes: JPEG, mediaType: 'image/jpeg' as const };

  it('sends the image first, then the instructions, with the JSON schema', async () => {
    const { client, create } = fakeClient(message());
    const out = await recognizeImage({ client, model: 'test-model', image });
    expect(out.result.concealed).toHaveLength(14);
    expect(out.usage).toEqual({ inputTokens: 1700, outputTokens: 90 });
    const [params] = create.mock.calls[0] as [Record<string, unknown>];
    expect(params.model).toBe('test-model');
    const parts = (params.contents as { parts: Record<string, unknown>[] }[])[0]!.parts;
    expect(parts.map((p) => Object.keys(p)[0])).toEqual(['inlineData', 'text']);
    const config = params.config as Record<string, unknown>;
    expect(config.responseMimeType).toBe('application/json');
    expect(JSON.stringify(config.responseJsonSchema)).toContain('concealed');
  });

  it('bounds spend: capped output, low thinking, and no SDK-level retries', async () => {
    const { client, create } = fakeClient(message());
    await recognizeImage({ client, model: 'm', image });
    const [params] = create.mock.calls[0] as [
      {
        config: {
          maxOutputTokens: number;
          thinkingConfig: { thinkingLevel: string };
          httpOptions: { timeout: number; retryOptions: { attempts: number } };
        };
      },
    ];
    expect(params.config.maxOutputTokens).toBeLessThanOrEqual(1024);
    expect(params.config.thinkingConfig.thinkingLevel).toBe('LOW');
    expect(params.config.httpOptions.retryOptions.attempts).toBe(1);
    expect(params.config.httpOptions.timeout).toBeLessThanOrEqual(20_000);
  });

  it('bills thinking tokens as output', async () => {
    const { client } = fakeClient(
      message({
        usageMetadata: { promptTokenCount: 1700, candidatesTokenCount: 90, thoughtsTokenCount: 40 },
      }),
    );
    const out = await recognizeImage({ client, model: 'm', image });
    expect(out.usage).toEqual({ inputTokens: 1700, outputTokens: 130 });
  });

  it('retries once on rate limiting', async () => {
    const { client, create } = fakeClient(httpError(429), message());
    const out = await recognizeImage({ client, model: 'm', image });
    expect(out.result.isMahjongHand).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries once on an overload and succeeds', async () => {
    const { client, create } = fakeClient(httpError(529), message());
    const out = await recognizeImage({ client, model: 'm', image });
    expect(out.result.isMahjongHand).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('gives up as upstream after a second server error', async () => {
    const { client, create } = fakeClient(httpError(500), httpError(503));
    expect(await code(recognizeImage({ client, model: 'm', image }))).toBe('upstream');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry a client error', async () => {
    const { client, create } = fakeClient(httpError(400));
    expect(await code(recognizeImage({ client, model: 'm', image }))).toBe('upstream');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('maps a request timeout to timeout without retrying', async () => {
    const { client, create } = fakeClient(timeoutError());
    expect(await code(recognizeImage({ client, model: 'm', image }))).toBe('timeout');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a safety stop', message({ candidates: [{ finishReason: 'SAFETY' }] })],
    ['truncated output', message({ candidates: [{ finishReason: 'MAX_TOKENS' }] })],
    ['no candidates', message({ candidates: [] })],
    ['no text', message({ text: undefined })],
    ['non-JSON text', message({ text: 'sorry' })],
    ['schema-invalid JSON', message({ text: JSON.stringify({ ...HAND, concealed: ['x1'] }) })],
  ])('reports %s as invalid-model-output', async (_l, response) => {
    const { client } = fakeClient(response);
    expect(await code(recognizeImage({ client, model: 'm', image }))).toBe('invalid-model-output');
  });
});

describe('handleRecognize', () => {
  const setup = (
    opts: { client?: GeminiClient; limiter?: ReturnType<typeof createMemoryLimiter> } = {},
  ) => {
    const lines: LogLine[] = [];
    const deps = () => ({
      client: opts.client ?? fakeClient(message()).client,
      limiter: opts.limiter ?? createMemoryLimiter(() => 0),
      model: 'test-model',
      log: (l: LogLine) => lines.push(l),
    });
    return { deps, lines };
  };

  it('returns the recognised hand and logs one metadata-only line', async () => {
    const { deps, lines } = setup();
    const res = await handleRecognize(
      request({ headers: { 'x-device-id': 'device-abc-123', 'x-forwarded-for': '203.0.113.9' } }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { ok: boolean; result: { concealed: string[] } };
    expect(body.ok).toBe(true);
    expect(body.result.concealed).toHaveLength(14);

    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0]!).sort()).toEqual(
      ['inputTokens', 'latencyMs', 'model', 'outcome', 'outputTokens', 'tiles'].sort(),
    );
    const serialised = JSON.stringify(lines[0]);
    expect(serialised).not.toContain('device-abc-123');
    expect(serialised).not.toContain('203.0.113.9');
  });

  it.each([
    ['forbidden-origin', 403, { headers: { origin: 'https://evil.example' } }],
    ['unsupported-type', 415, { headers: { 'content-type': 'text/plain' } }],
    ['not-a-photo', 400, { body: new Uint8Array() }],
  ])('maps %s to HTTP %i', async (error, status, init) => {
    const { deps, lines } = setup();
    const res = await handleRecognize(request(init), deps);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, error });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.outcome).toBe(error);
  });

  it('returns 429 once the device limit is spent, without calling the model', async () => {
    const { client, create } = fakeClient(message());
    const { deps } = setup({ client, limiter: createMemoryLimiter(() => 0) });
    const headers = { 'x-device-id': 'device-1' };
    for (let i = 0; i < 30; i++) {
      create.mockResolvedValueOnce(message());
      expect((await handleRecognize(request({ headers }), deps)).status).toBe(200);
    }
    const before = create.mock.calls.length;
    const res = await handleRecognize(request({ headers }), deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: 'rate-limited' });
    expect(create.mock.calls.length).toBe(before);
  });

  it('returns 429 on the ip limit alone when no device id is sent', async () => {
    const limiter = createMemoryLimiter(() => 0);
    const { deps } = setup({ limiter });
    const headers = { 'x-forwarded-for': '198.51.100.7' };
    for (let i = 0; i < 60; i++) await limiter.allow('ip', '198.51.100.7');
    const res = await handleRecognize(request({ headers }), deps);
    expect(res.status).toBe(429);
  });

  it('logs the failure when the server cannot be configured', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await handleRecognize(request(), () => {
      throw new RecognizeError('unavailable');
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain('"outcome":"unavailable"');
    spy.mockRestore();
  });

  it('returns 503 when the server is not configured', async () => {
    const res = await handleRecognize(request(), () => {
      throw new RecognizeError('unavailable');
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'unavailable' });
  });

  it('maps upstream failures to 502 and timeouts to 504', async () => {
    const down = setup({ client: fakeClient(httpError(500), httpError(500)).client });
    expect((await handleRecognize(request(), down.deps)).status).toBe(502);
    const slow = setup({ client: fakeClient(timeoutError()).client });
    expect((await handleRecognize(request(), slow.deps)).status).toBe(504);
  });
});
