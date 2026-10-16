import { ApiError, FinishReason, ThinkingLevel, type GoogleGenAI } from '@google/genai';
import { RecognizeError } from '../errors';
import { buildPrompt } from '../prompt';
import { recognitionJsonSchema } from '../schema';
import { RecognitionInvalidError, validateRecognition, type RecognitionResult } from '../validate';
import type { UploadedImage } from './request';

/** The slice of the Gemini client this route uses, so tests can pass a fake. */
export type GeminiClient = Pick<GoogleGenAI, 'models'>;

/** Overall budget for the model call, retries included (ADR-43). */
export const MODEL_TIMEOUT_MS = 20_000;
/** Hard cap on billed output. A hand is well under 200 tokens of JSON; this leaves headroom. */
export const MAX_OUTPUT_TOKENS = 1024;

export interface RecognizeOutcome {
  result: RecognitionResult;
  usage: { inputTokens: number; outputTokens: number };
}

const isRetryable = (err: unknown): boolean =>
  err instanceof ApiError && (err.status === 429 || err.status >= 500);

const isTimeout = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');

/** One model call with a single retry on overload or server error (ADR-49). Never logs the image. */
export const recognizeImage = async (opts: {
  client: GeminiClient;
  model: string;
  image: UploadedImage;
  timeoutMs?: number;
}): Promise<RecognizeOutcome> => {
  const { client, model, image, timeoutMs = MODEL_TIMEOUT_MS } = opts;
  const deadline = Date.now() + timeoutMs;
  const data = Buffer.from(image.bytes).toString('base64');

  let response: Awaited<ReturnType<GeminiClient['models']['generateContent']>> | undefined;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      response = await client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: image.mediaType, data } }, { text: buildPrompt() }],
          },
        ],
        config: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
          responseJsonSchema: recognitionJsonSchema(),
          // Reading tiles is perception, not reasoning. Thinking tokens are billed as output
          // and count against maxOutputTokens, so keep them to a minimum.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          httpOptions: {
            timeout: Math.max(1, deadline - Date.now()),
            // Pin the SDK to one attempt so our own loop is the only retry (worst case: 2 calls).
            retryOptions: { attempts: 1 },
          },
        },
      });
    } catch (err) {
      if (isTimeout(err)) throw new RecognizeError('timeout');
      if (attempt === 0 && isRetryable(err) && Date.now() < deadline) continue;
      throw new RecognizeError('upstream');
    }
  }
  if (!response) throw new RecognizeError('upstream');

  // A block, safety stop or max-token cut-off can break the schema, so require a clean stop (ADR-43).
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason !== FinishReason.STOP)
    throw new RecognizeError('invalid-model-output');
  const text = response.text;
  if (!text) throw new RecognizeError('invalid-model-output');

  try {
    const result = validateRecognition(JSON.parse(text));
    const usage = response.usageMetadata;
    return {
      result,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        // Thinking tokens are billed as output, so count them for spend tracking.
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      },
    };
  } catch (err) {
    if (err instanceof RecognitionInvalidError || err instanceof SyntaxError) {
      throw new RecognizeError('invalid-model-output');
    }
    throw err;
  }
};
