import { GoogleGenAI } from '@google/genai';
import { RecognizeError } from '@/lib/recognition/errors';
import {
  handleRecognize,
  logToConsole,
  type RecognizeDeps,
} from '@/lib/recognition/server/handler';
import { createLimiter, type Limiter } from '@/lib/recognition/server/rate-limit';

export const dynamic = 'force-dynamic';
// Above the 20 s model budget so a slow call fails as `timeout`, not as a platform kill.
export const maxDuration = 30;

const DEFAULT_MODEL = 'gemini-3.8-flash';

let limiter: Limiter | undefined;
let client: GoogleGenAI | undefined;

const getDeps = (): RecognizeDeps => {
  // Kill switch: refuse before any key, limiter or model is touched.
  if (process.env.RECOGNITION_DISABLED === '1') throw new RecognizeError('unavailable');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new RecognizeError('unavailable');
  limiter ??= createLimiter(process.env);
  client ??= new GoogleGenAI({ apiKey });
  return {
    client,
    limiter,
    model: process.env.RECOGNITION_MODEL || DEFAULT_MODEL,
    log: logToConsole,
  };
};

export const POST = (req: Request) => handleRecognize(req, getDeps);
