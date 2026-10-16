import { RECOGNIZE_ERRORS, RecognizeError, type RecognizeErrorCode } from '../errors';
import { recognizeImage, type GeminiClient } from './gemini';
import { GLOBAL_KEY, type Limiter } from './rate-limit';
import { checkOrigin, checkUploadHeaders, clientIp, readDeviceId, readImage } from './request';

/** The only thing ever logged for a request: no image, no ids, no addresses (ADR-47, ADR-60). */
export interface LogLine {
  outcome: 'ok' | RecognizeErrorCode;
  latencyMs: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  tiles: number;
}

export interface RecognizeDeps {
  client: GeminiClient;
  limiter: Limiter;
  model: string;
  log: (line: LogLine) => void;
}

/** Default sink: one JSON line on stdout. Also used when the deps themselves cannot be built. */
export const logToConsole = (line: LogLine): void =>
  console.info(JSON.stringify({ event: 'recognize', ...line }));

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/**
 * POST /api/recognize. Body: the raw image bytes with a JPEG, PNG or WebP `content-type`.
 * Optional `x-device-id` header (anonymous, rate limiting only).
 * Returns `{ ok: true, result }` or `{ ok: false, error }` (see `RECOGNIZE_ERRORS` for statuses).
 */
export const handleRecognize = async (
  req: Request,
  getDeps: () => RecognizeDeps,
): Promise<Response> => {
  const started = Date.now();
  let deps: RecognizeDeps;
  try {
    deps = getDeps();
  } catch (err) {
    const code = err instanceof RecognizeError ? err.code : 'unavailable';
    // A missing key or limiter config is the failure operators most need to see.
    logToConsole({
      outcome: code,
      latencyMs: Date.now() - started,
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      tiles: 0,
    });
    return json({ ok: false, error: code }, RECOGNIZE_ERRORS[code]);
  }

  const line = (outcome: LogLine['outcome'], extra: Partial<LogLine> = {}) =>
    deps.log({
      outcome,
      latencyMs: Date.now() - started,
      model: deps.model,
      inputTokens: 0,
      outputTokens: 0,
      tiles: 0,
      ...extra,
    });

  try {
    checkOrigin(req);
    checkUploadHeaders(req);

    const deviceId = readDeviceId(req);
    const allowed = [
      await deps.limiter.allow('ip', clientIp(req)),
      deviceId === null ? true : await deps.limiter.allow('device', deviceId),
    ];
    if (allowed.includes(false)) throw new RecognizeError('rate-limited');
    const image = await readImage(req);
    // Counted last, after the body is known to be a real image, so refused or unreadable requests
    // never spend the shared budget.
    if (!(await deps.limiter.allow('global', GLOBAL_KEY))) {
      throw new RecognizeError('budget-exhausted');
    }
    const { result, usage } = await recognizeImage({
      client: deps.client,
      model: deps.model,
      image,
    });
    line('ok', {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      tiles: result.concealed.length + result.melds.flat().length,
    });
    return json({ ok: true, result }, 200);
  } catch (err) {
    const code = err instanceof RecognizeError ? err.code : 'upstream';
    line(code);
    return json({ ok: false, error: code }, RECOGNIZE_ERRORS[code]);
  }
};
