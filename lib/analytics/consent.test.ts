import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ getSetting: vi.fn(), setSetting: vi.fn() }));
vi.mock('@/lib/db', () => db);

const analyticsMock = vi.hoisted(() => ({ setConsent: vi.fn() }));
vi.mock('./analytics', () => ({ analytics: analyticsMock }));

import {
  ANALYTICS_CONSENT_KEY,
  applyStoredAnalyticsConsent,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from './consent';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAnalyticsConsent', () => {
  it.each([
    ['an absent setting', undefined],
    ['false', false],
    ['a non-boolean value', 'yes'],
  ])('is false for %s', async (_label, stored) => {
    db.getSetting.mockResolvedValue(stored);
    expect(await getAnalyticsConsent()).toBe(false);
  });

  it('is true only for an explicit stored true', async () => {
    db.getSetting.mockResolvedValue(true);
    expect(await getAnalyticsConsent()).toBe(true);
    expect(db.getSetting).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY);
  });
});

describe('applyStoredAnalyticsConsent', () => {
  it('applies a stored opt-in at app start', async () => {
    db.getSetting.mockResolvedValue(true);
    await applyStoredAnalyticsConsent();
    expect(analyticsMock.setConsent).toHaveBeenCalledWith(true);
  });

  it('applies no consent when nothing is stored', async () => {
    db.getSetting.mockResolvedValue(undefined);
    await applyStoredAnalyticsConsent();
    expect(analyticsMock.setConsent).toHaveBeenCalledWith(false);
  });

  it('treats a storage failure as no consent and does not throw', async () => {
    db.getSetting.mockRejectedValue(new Error('IndexedDB is broken'));
    await expect(applyStoredAnalyticsConsent()).resolves.toBeUndefined();
    expect(analyticsMock.setConsent).toHaveBeenCalledWith(false);
  });
});

describe('setAnalyticsConsent', () => {
  it('persists the choice, then applies it to the running session', async () => {
    const order: string[] = [];
    db.setSetting.mockImplementation(async () => void order.push('persist'));
    analyticsMock.setConsent.mockImplementation(() => void order.push('apply'));
    await setAnalyticsConsent(true);
    expect(db.setSetting).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY, true);
    expect(order).toEqual(['persist', 'apply']);
  });

  it('does not apply consent when the write fails', async () => {
    db.setSetting.mockRejectedValue(new Error('quota'));
    await expect(setAnalyticsConsent(true)).rejects.toThrow('quota');
    expect(analyticsMock.setConsent).not.toHaveBeenCalled();
  });
});
