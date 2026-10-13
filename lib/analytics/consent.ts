import { getSetting, setSetting } from '@/lib/db';
import { analytics } from './analytics';

/** Dexie `settings` key holding the explicit opt-in. Absent means "not opted in". */
export const ANALYTICS_CONSENT_KEY = 'analyticsConsent';

export async function getAnalyticsConsent(): Promise<boolean> {
  return (await getSetting<boolean>(ANALYTICS_CONSENT_KEY)) === true;
}

/** Persists the choice, then applies it to the running session. */
export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  await setSetting(ANALYTICS_CONSENT_KEY, granted);
  analytics.setConsent(granted);
}

/** Applies a stored opt-in at app start. Never throws: storage trouble means "no consent". */
export async function applyStoredAnalyticsConsent(): Promise<void> {
  try {
    analytics.setConsent(await getAnalyticsConsent());
  } catch {
    analytics.setConsent(false);
  }
}
