import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: posthog }));

import { AnalyticsPayloadError, analytics, buildPayload } from './analytics';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
  analytics.resetForTests();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('analytics.capture', () => {
  it('is a strict no-op without consent: nothing is loaded, initialised or sent', async () => {
    analytics.capture('game_started');
    analytics.capture('hand_recorded', { method: 'manual', corrections: 0, durationMs: 10 });
    await analytics.flush();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('initialises PostHog and sends the event once consent is granted', async () => {
    analytics.setConsent(true);
    analytics.capture('hand_recorded', { method: 'photo', corrections: 2, durationMs: 4200 });
    await analytics.flush();

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
      }),
    );
    expect(posthog.capture).toHaveBeenCalledWith('hand_recorded', {
      method: 'photo',
      corrections: 2,
      durationMs: 4200,
    });
  });

  it('stops sending after consent is withdrawn', async () => {
    analytics.setConsent(true);
    await analytics.flush();
    analytics.setConsent(false);
    analytics.capture('game_started');
    await analytics.flush();

    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('does nothing when consented but no PostHog key is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    analytics.setConsent(true);
    analytics.capture('game_started');
    await analytics.flush();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('drops an event with a forbidden payload instead of throwing or sending it', async () => {
    analytics.setConsent(true);
    expect(() => analytics.capture('game_started', { playerName: 'Alice' })).not.toThrow();
    await analytics.flush();

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe('buildPayload', () => {
  it('accepts exactly the documented hand_recorded fields', () => {
    expect(
      buildPayload('hand_recorded', { method: 'manual', corrections: 0, durationMs: 0 }),
    ).toEqual({ method: 'manual', corrections: 0, durationMs: 0 });
  });

  it.each([
    ['game_started', { playerNames: ['Alice'] }],
    ['game_started', { name: 'Alice' }],
    ['hand_recorded', { method: 'manual', corrections: 0, durationMs: 1, winnerName: 'Bob' }],
    ['hand_recorded', { method: 'Alice', corrections: 0, durationMs: 1 }],
    ['hand_edited', { player: 'Cara' }],
    ['game_completed', { photo: 'data:image/jpeg;base64,AAAA' }],
  ] as const)('rejects %s carrying personal data %j', (name, props) => {
    expect(() => buildPayload(name, props)).toThrow(AnalyticsPayloadError);
  });

  it('rejects malformed numbers', () => {
    expect(() =>
      buildPayload('hand_recorded', { method: 'photo', corrections: -1, durationMs: 5 }),
    ).toThrow(AnalyticsPayloadError);
    expect(() => buildPayload('hand_recorded', { method: 'photo' })).toThrow(AnalyticsPayloadError);
  });

  it('rejects an unknown event name', () => {
    expect(() => buildPayload('page_view' as never, {})).toThrow(AnalyticsPayloadError);
  });
});
