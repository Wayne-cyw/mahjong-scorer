'use client';

import { useEffect, useState } from 'react';
import { getSetting, requestPersistence, setSetting } from '@/lib/db';
import { Button } from '@/components/ui/button';

const PERSISTENCE_KEY = 'persistenceRequested';
const DISMISSED_KEY = 'installNudgeDismissed';

function isIosSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && safari;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

/**
 * Mount once a game exists: asks the browser for persistent storage a single
 * time (ADR-52), and on iOS Safari outside an installed app shows a dismissible
 * "Add to Home Screen" hint, since iOS evicts unpinned site data.
 */
export function InstallNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if ((await getSetting<boolean>(PERSISTENCE_KEY)) !== true) {
          await requestPersistence();
          await setSetting(PERSISTENCE_KEY, true);
        }
        const dismissed = (await getSetting<boolean>(DISMISSED_KEY)) === true;
        if (!cancelled && !dismissed && isIosSafariBrowser() && !isStandalone()) setVisible(true);
      } catch {
        // Best-effort: never block the game on storage hints.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const dismiss = (): void => {
    setVisible(false);
    void setSetting(DISMISSED_KEY, true).catch(() => undefined);
  };

  return (
    <aside
      role="note"
      className="bg-green-deep text-ivory m-4 flex items-center justify-between gap-3 rounded-md p-3 text-base font-medium"
    >
      <p>Tap Share, then Add to Home Screen, so your games are kept safe on this phone.</p>
      <Button type="button" variant="secondary" onClick={dismiss} className="h-12 px-4 text-base">
        Got it
      </Button>
    </aside>
  );
}
