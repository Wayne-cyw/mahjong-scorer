import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RecognizeError } from '../errors';

export type LimitScope = 'device' | 'ip';

export interface Limiter {
  /** True when the request is within the limit. Counts the attempt. */
  allow(scope: LimitScope, key: string): Promise<boolean>;
}

/** Starting values from the design spec (ADR-58). */
const LIMITS: Record<LimitScope, number> = { device: 30, ip: 60 };
const WINDOW_MS = 60 * 60 * 1000;

/** In-process sliding window. Development and tests only; it is per-instance in production. */
export const createMemoryLimiter = (now: () => number = Date.now): Limiter => {
  const hits = new Map<string, number[]>();
  return {
    async allow(scope, key) {
      const id = `${scope}:${key}`;
      const t = now();
      const recent = (hits.get(id) ?? []).filter((at) => at > t - WINDOW_MS);
      if (recent.length >= LIMITS[scope]) {
        hits.set(id, recent);
        return false;
      }
      recent.push(t);
      hits.set(id, recent);
      return true;
    },
  };
};

const createUpstashLimiter = (url: string, token: string): Limiter => {
  const redis = new Redis({ url, token });
  const make = (scope: LimitScope) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMITS[scope], '1 h'),
      prefix: `recognize:${scope}`,
    });
  const limiters = { device: make('device'), ip: make('ip') };
  return {
    async allow(scope, key) {
      try {
        return (await limiters[scope].limit(key)).success;
      } catch {
        // Fail closed: if the counter store is down, the bill cap is not enforced.
        throw new RecognizeError('unavailable');
      }
    },
  };
};

/** Uses Upstash when configured. Without it, production refuses to run rather than skip limits. */
export const createLimiter = (env: Record<string, string | undefined>): Limiter => {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashLimiter(url, token);
  if (env.NODE_ENV !== 'production') return createMemoryLimiter();
  throw new RecognizeError('unavailable');
};
