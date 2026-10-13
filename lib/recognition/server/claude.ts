import Anthropic from '@anthropic-ai/sdk';
import { RecognizeError } from '../errors';
import { buildPrompt } from '../prompt';
import { recognitionJsonSchema } from '../schema';
import { RecognitionInvalidError, validateRecognition, type RecognitionResult } from '../validate';
import type { UploadedImage } from './request';

/** Overall budget for the model call, retries included (ADR-43). */
export const MODEL_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 1024;

export interface RecognizeOutcome {
  result: RecognitionResult;
  usage: { inputTokens: number; outputTokens: number };
}

const statusOf = (err: unknown): number | undefined => {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
};

const isRetryable = (err: unknown): boolean => {
  const status = statusOf(err);
  return status !== undefined && (status === 529 || status >= 500);
};

/** One model call with a single retry on overload or server error (ADR-49). Never logs the image. */
export const recognizeImage = async (opts: {
  client: Pick<Anthropic, 'messages'>;
  model: string;
  image: UploadedImage;
  timeoutMs?: number;
}): Promise<RecognizeOutcome> => {
  const { client, model, image, timeoutMs = MODEL_TIMEOUT_MS } = opts;
  const deadline = Date.now() + timeoutMs;
  const data = Buffer.from(image.bytes).toString('base64');

  let message: Anthropic.Message | undefined;
  for (let attempt = 0; attempt < 2 && !message; attempt++) {
    try {
      message = await client.messages.create(
        {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: image.mediaType, data } },
                { type: 'text', text: buildPrompt() },
              ],
            },
          ],
          output_config: {
            format: {
              type: 'json_schema',
              schema: recognitionJsonSchema() as Record<string, unknown>,
            },
          },
        },
        { timeout: Math.max(1, deadline - Date.now()), maxRetries: 0 },
      );
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionTimeoutError) throw new RecognizeError('timeout');
      if (attempt === 0 && isRetryable(err) && Date.now() < deadline) continue;
      throw new RecognizeError('upstream');
    }
  }
  if (!message) throw new RecognizeError('upstream');

  // A refusal or a max_tokens cut-off can break the schema, so require a clean stop (ADR-43).
  if (message.stop_reason !== 'end_turn') throw new RecognizeError('invalid-model-output');
  const text = message.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') throw new RecognizeError('invalid-model-output');

  try {
    const result = validateRecognition(JSON.parse(text.text));
    return {
      result,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
  } catch (err) {
    if (err instanceof RecognitionInvalidError || err instanceof SyntaxError) {
      throw new RecognizeError('invalid-model-output');
    }
    throw err;
  }
};
