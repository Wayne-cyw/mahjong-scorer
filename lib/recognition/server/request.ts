import { RecognizeError } from '../errors';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface UploadedImage {
  bytes: Uint8Array;
  mediaType: ImageMediaType;
}

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

const startsWith = (bytes: Uint8Array, at: number, magic: readonly number[]) =>
  magic.every((b, i) => bytes[at + i] === b);

const MAGIC: Record<ImageMediaType, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (b) => startsWith(b, 0, [0xff, 0xd8, 0xff]),
  'image/png': (b) => startsWith(b, 0, [0x89, 0x50, 0x4e, 0x47]),
  'image/webp': (b) =>
    startsWith(b, 0, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, 8, [0x57, 0x45, 0x42, 0x50]),
};

const isImageType = (type: string): type is ImageMediaType => type in MAGIC;

/** Rejects cross-site and scripted callers: the Origin must match the host serving the route. */
export const checkOrigin = (req: Request): void => {
  const origin = req.headers.get('origin');
  // Behind a proxy `req.url` can carry an internal host, so prefer the forwarded one.
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
  try {
    if (origin && new URL(origin).host === host) return;
  } catch {
    // fall through to the rejection below
  }
  throw new RecognizeError('forbidden-origin');
};

/** The anonymous device id, or null when absent or malformed. Used only for rate limiting. */
export const readDeviceId = (req: Request): string | null => {
  const id = req.headers.get('x-device-id');
  return id !== null && DEVICE_ID.test(id) ? id : null;
};

export const clientIp = (req: Request): string =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

/** Cheap checks on headers alone, so oversized or wrong-typed uploads cost nothing to refuse. */
export const checkUploadHeaders = (req: Request): ImageMediaType => {
  const type = (req.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!isImageType(type)) throw new RecognizeError('unsupported-type');
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES)
    throw new RecognizeError('too-large');
  return type;
};

/** Reads the body with a hard cap, so a missing or false Content-Length cannot buffer more. */
export const readImage = async (req: Request): Promise<UploadedImage> => {
  const mediaType = checkUploadHeaders(req);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new RecognizeError('too-large');
    }
    chunks.push(value);
  }
  if (total === 0) throw new RecognizeError('not-a-photo');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (!MAGIC[mediaType](bytes)) throw new RecognizeError('not-a-photo');
  return { bytes, mediaType };
};
