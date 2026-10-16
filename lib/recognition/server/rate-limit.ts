import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RecognizeError } from '../errors';

export type LimitScope = 'device' | 'ip' | 'global';

export interface Limiter {
  /** True when the request is within the limit. Counts the attempt. */
  allow(scope: LimitScope, key: string): Promise<boolean>;
}

/** The `global` scope is the daily circuit breaker; its key is always the same. */
export const GLOBAL_KEY = 'all';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Starting value for the all-callers daily cap; override with `RECOGNITION_DAILY_CAP`. */
export const DEFAULT_DAILY_CAP = 1000;

interface Limits {
  max: Record<LimitScope, number>;
  windowMs: Record<LimitScope, number>;
}

/** Per-device and per-IP values are the design spec's starting values (ADR-58). */
const limitsFrom = (env: Record<string, string | undefined> = {}): Limits => {
  const raw = env.RECOGNITION_DAILY_CAP;
  const cap = raw === undefined || raw === '' ? DEFAULT_DAILY_CAP : Number(raw);
  // A typo must not silently raise the cap: refuse to run rather than guess.
  if (!Number.isInteger(cap) || cap <= 0) throw new RecognizeError('unavailable');
  return {
    max: {
      device: 30,
      ip: 60,
      global: cap,
    },
    windowMs: { device: HOUR_MS, ip: HOUR_MS, global: DAY_MS },
  };
};

/** In-process sliding window. Development and tests only; it is per-instance in production. */
export const createMemoryLimiter = (
  now: () => number = Date.now,
  env: Record<string, string | undefined> = {},
): Limiter => {
  const { max, windowMs } = limitsFrom(env);
  const hits = new Map<string, number[]>();
  return {
    async allow(scope, key) {
      const id = `${scope}:${key}`;
      const t = now();
      const recent = (hits.get(id) ?? []).filter((at) => at > t - windowMs[scope]);
      if (recent.length >= max[scope]) {
        hits.set(id, recent);
        return false;
      }
      recent.push(t);
      hits.set(id, recent);
      return true;
    },
  };
};

const createUpstashLimiter = (
  url: string,
  token: string,
  env: Record<string, string | undefined>,
): Limiter => {
  const { max } = limitsFrom(env);
  const redis = new Redis({ url, token });
  const make = (scope: LimitScope) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max[scope], scope === 'global' ? '1 d' : '1 h'),
      prefix: `recognize:${scope}`,
    });
  const limiters = { device: make('device'), ip: make('ip'), global: make('global') };
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
  if (url && token) return createUpstashLimiter(url, token, env);
  if (env.NODE_ENV !== 'production') return createMemoryLimiter(Date.now, env);
  throw new RecognizeError('unavailable');
};
