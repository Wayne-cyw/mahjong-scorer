import Anthropic from '@anthropic-ai/sdk';
import { RecognizeError } from '@/lib/recognition/errors';
import { handleRecognize, type RecognizeDeps } from '@/lib/recognition/server/handler';
import { createLimiter, type Limiter } from '@/lib/recognition/server/rate-limit';

export const dynamic = 'force-dynamic';
// Above the 20 s model budget so a slow call fails as `timeout`, not as a platform kill.
export const maxDuration = 30;

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

let limiter: Limiter | undefined;
let client: Anthropic | undefined;

const getDeps = (): RecognizeDeps => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new RecognizeError('unavailable');
  limiter ??= createLimiter(process.env);
  client ??= new Anthropic({ apiKey });
  return {
    client,
    limiter,
    model: process.env.RECOGNITION_MODEL || DEFAULT_MODEL,
    log: (line) => console.info(JSON.stringify({ event: 'recognize', ...line })),
  };
};

export const POST = (req: Request) => handleRecognize(req, getDeps);
