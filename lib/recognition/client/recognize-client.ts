import { z } from 'zod';
import { bonusSchema, tileSchema } from '@/lib/tiles';
import {
  RECOGNIZE_ERRORS,
  RecognizeError,
  type RecognitionResult,
  type RecognizeErrorCode,
} from '@/lib/recognition';
import { getDeviceId } from './device-id';

/** The route allows the model about 25 s plus one retry; give up a little after that. */
const REQUEST_TIMEOUT_MS = 45_000;

const resultSchema = z.object({
  isMahjongHand: z.boolean(),
  concealed: z.array(tileSchema),
  melds: z.array(z.array(tileSchema)),
  bonus: z.array(bonusSchema),
  uncertain: z.array(
    z.object({ row: z.enum(['concealed', 'melds', 'bonus']), index: z.number().int() }),
  ),
  warnings: z.array(z.string()),
});

const responseSchema = z.union([
  z.object({ ok: z.literal(true), result: resultSchema }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

const isErrorCode = (value: string): value is RecognizeErrorCode =>
  Object.hasOwn(RECOGNIZE_ERRORS, value);

/**
 * Sends one resized photo to `/api/recognize` (raw JPEG bytes) and returns the validated result.
 * Every failure is a `RecognizeError` with a route code. When the device is offline the network
 * is never touched. The photo is not retained anywhere. Aborting `signal` (the player left the
 * step) cancels the upload so the photo is not sent or billed needlessly.
 */
export async function recognize(blob: Blob, signal?: AbortSignal): Promise<RecognitionResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new RecognizeError('unavailable');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = (): void => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  let response: Response;
  try {
    response = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg', 'x-device-id': getDeviceId() },
      body: blob,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RecognizeError('timeout');
    }
    throw new RecognizeError('upstream');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new RecognizeError('upstream');
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new RecognizeError(response.ok ? 'invalid-model-output' : 'upstream');
  }
  if (!parsed.data.ok) {
    throw new RecognizeError(isErrorCode(parsed.data.error) ? parsed.data.error : 'upstream');
  }
  return parsed.data.result;
}
