'use client';

import { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics/consent';

/** Opt-in toggle for anonymous usage analytics. Off until the user turns it on. */
export function AnalyticsConsent() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsConsent()
      .then((value) => {
        if (!cancelled) setGranted(value);
      })
      .catch(() => {
        if (!cancelled) setGranted(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (next: boolean) => {
    setFailed(false);
    setAnalyticsConsent(next)
      .then(() => setGranted(next))
      .catch(() => setFailed(true));
  };

  return (
    <section className="flex flex-col gap-2 rounded border border-neutral-300 p-4">
      <label className="flex min-h-12 items-center gap-3 font-medium">
        <input
          type="checkbox"
          className="size-5"
          checked={granted === true}
          disabled={granted === null}
          onChange={(event) => toggle(event.target.checked)}
        />
        Share anonymous usage
      </label>
      <p className="text-sm text-neutral-600">
        Counts of games and hands, and how long a hand took. We never send player names or photos.
        Off by default; change it any time.
      </p>
      {failed ? (
        <p role="alert" className="text-sm text-red-700">
          Could not save your choice. Try again.
        </p>
      ) : null}
    </section>
  );
}
