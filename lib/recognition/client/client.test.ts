// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import imageCompression from 'browser-image-compression';
import { RecognizeError } from '@/lib/recognition';
import { getDeviceId, resetDeviceIdForTests } from './device-id';
import { recognize } from './recognize-client';
import { resizeForUpload } from './resize';

vi.mock('browser-image-compression', () => ({ default: vi.fn() }));

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

describe('resizeForUpload', () => {
  it('asks for a 1568 px long edge at JPEG 0.85 and returns a JPEG blob', async () => {
    const out = new File([new Uint8Array([1, 2, 3])], 'x.jpg', { type: 'image/jpeg' });
    vi.mocked(imageCompression).mockResolvedValue(out);
    const input = new File([new Uint8Array(10)], 'photo.heic', { type: 'image/heic' });

    const blob = await resizeForUpload(input);

    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(3);
    const [file, options] = vi.mocked(imageCompression).mock.calls[0] ?? [];
    expect(file).toBe(input);
    expect(options).toMatchObject({
      maxWidthOrHeight: 1568,
      initialQuality: 0.85,
      fileType: 'image/jpeg',
      preserveExif: false,
      useWebWorker: false,
    });
  });
});

describe('getDeviceId', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDeviceIdForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns an id the route accepts and keeps it across calls and reloads', () => {
    const first = getDeviceId();
    expect(first).toMatch(DEVICE_ID);
    expect(getDeviceId()).toBe(first);
    resetDeviceIdForTests();
    expect(getDeviceId()).toBe(first);
  });

  it('survives blocked storage with a stable in-memory id', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const id = getDeviceId();
    expect(id).toMatch(DEVICE_ID);
    expect(getDeviceId()).toBe(id);
  });

  it('ignores a stored value the route would reject', () => {
    window.localStorage.setItem('mahjong.deviceId', 'bad id!');
    expect(getDeviceId()).toMatch(DEVICE_ID);
  });
});

describe('recognize', () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const result = {
    isMahjongHand: true,
    concealed: ['m1', 'm2', 'm3'],
    melds: [['p1', 'p1', 'p1']],
    bonus: ['f1'],
    uncertain: [{ row: 'concealed', index: 1 }],
    warnings: ['check it'],
  };
  const reply = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status });

  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the raw bytes with the device id and returns the result', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true, result }));

    await expect(recognize(blob)).resolves.toEqual(result);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/recognize');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(blob);
    const headers = new Headers(init.headers);
    expect(headers.get('content-type')).toBe('image/jpeg');
    expect(headers.get('x-device-id')).toMatch(DEVICE_ID);
  });

  it('throws the code the route reports', async () => {
    fetchMock.mockResolvedValue(reply({ ok: false, error: 'rate-limited' }, 429));
    await expect(recognize(blob)).rejects.toMatchObject({
      name: 'RecognizeError',
      code: 'rate-limited',
    });
  });

  it('never calls the network while offline', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(recognize(blob)).rejects.toBeInstanceOf(RecognizeError);
    await expect(recognize(blob)).rejects.toMatchObject({ code: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a network failure to upstream', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(recognize(blob)).rejects.toMatchObject({ code: 'upstream' });
  });

  it('treats a malformed or unknown-code response as a failure', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: true, result: { isMahjongHand: 'yes' } }));
    await expect(recognize(blob)).rejects.toMatchObject({ code: 'invalid-model-output' });
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(recognize(blob)).rejects.toMatchObject({ code: 'upstream' });
    fetchMock.mockResolvedValueOnce(reply({ ok: false, error: 'weird' }, 500));
    await expect(recognize(blob)).rejects.toMatchObject({ code: 'upstream' });
  });

  it('reports a client-side timeout when the request hangs', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      );
      const pending = recognize(blob);
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
