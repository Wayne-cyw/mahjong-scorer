import { z } from 'zod';

/**
 * Opt-in product analytics (ADR-20, PD-27). Exactly four events exist and each
 * has a strict schema, so a player name or a photo cannot reach PostHog even by
 * mistake: an unknown key or a free-text value fails the parse and the event is
 * dropped. Nothing is loaded or sent until `setConsent(true)`.
 */
const PAYLOADS = {
  game_started: z.strictObject({}),
  hand_recorded: z.strictObject({
    method: z.enum(['photo', 'manual']),
    corrections: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  }),
  hand_edited: z.strictObject({}),
  game_completed: z.strictObject({}),
} as const;

export type AnalyticsEventName = keyof typeof PAYLOADS;
export type AnalyticsPayload<E extends AnalyticsEventName> = z.infer<(typeof PAYLOADS)[E]>;

export class AnalyticsPayloadError extends Error {
  constructor(name: string, detail: string) {
    super(`Invalid analytics payload for ${name}: ${detail}`);
    this.name = 'AnalyticsPayloadError';
  }
}

/** Validates a payload against its event's schema; throws on any unexpected key or value. */
export function buildPayload<E extends AnalyticsEventName>(
  name: E,
  props?: unknown,
): AnalyticsPayload<E> {
  const schema = (PAYLOADS as Record<string, z.ZodType | undefined>)[name];
  if (!schema) throw new AnalyticsPayloadError(String(name), 'unknown event');
  const result = schema.safeParse(props ?? {});
  if (!result.success) {
    // Report which fields failed, never their values (they might be names).
    const fields = result.error.issues.map((issue) => issue.path.join('.') || issue.code);
    throw new AnalyticsPayloadError(name, fields.join(', '));
  }
  return result.data as AnalyticsPayload<E>;
}

interface PostHogLike {
  init: (key: string, config: Record<string, unknown>) => unknown;
  capture: (event: string, properties?: Record<string, unknown>) => unknown;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
  reset: () => void;
}

let consent = false;
let client: Promise<PostHogLike | null> | null = null;
let pending: Promise<unknown> = Promise.resolve();

async function loadClient(): Promise<PostHogLike | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      person_profiles: 'never',
      persistence: 'localStorage',
      ip: false,
    });
    return posthog as unknown as PostHogLike;
  } catch {
    return null;
  }
}

function track(task: Promise<unknown>): void {
  pending = pending.then(() => task).catch(() => undefined);
}

export const analytics = {
  /** Turns analytics on or off. The caller persists the choice; this only applies it. */
  setConsent(granted: boolean): void {
    if (granted === consent) return;
    consent = granted;
    if (granted) {
      if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
      client ??= loadClient();
      track(client.then((ph) => ph?.opt_in_capturing()));
    } else if (client) {
      track(
        client.then((ph) => {
          ph?.opt_out_capturing();
          ph?.reset();
        }),
      );
    }
  },

  hasConsent: (): boolean => consent,

  /**
   * Sends one of the four events. A strict no-op without consent; an invalid
   * payload is dropped rather than thrown, so analytics can never break a game.
   */
  capture<E extends AnalyticsEventName>(name: E, props?: unknown): void {
    if (!consent || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    let payload: AnalyticsPayload<E>;
    try {
      payload = buildPayload(name, props);
    } catch {
      return;
    }
    const loading = (client ??= loadClient());
    track(
      loading.then((ph) => {
        if (consent) ph?.capture(name, payload);
      }),
    );
  },

  /** Forgets consent and the loaded client. For tests only. */
  resetForTests(): void {
    consent = false;
    client = null;
    pending = Promise.resolve();
  },

  /** Resolves once queued work has settled. For tests. */
  flush: async (): Promise<void> => {
    await pending;
  },
};
