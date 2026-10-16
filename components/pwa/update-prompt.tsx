'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Serwist } from '@serwist/window';
import { Button } from '@/components/ui/button';

const HAND_ROUTE = /^\/game\/[^/]+\/hand(\/|$)/;

/**
 * Registers the service worker and, when a new version is waiting (ADR-51),
 * offers an "Update ready" bar. It stays hidden while a hand is being entered so
 * a reload never interrupts scoring; accepting activates the worker and reloads.
 */
export function UpdatePrompt() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState(false);
  const serwist = useRef<Serwist | null>(null);
  const accepted = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const instance = new Serwist('/sw.js', { scope: '/', type: 'classic' });
    serwist.current = instance;
    instance.addEventListener('waiting', () => setWaiting(true));
    // Only reload for an update this tab accepted; first install and other tabs'
    // updates also fire `controlling` (clientsClaim) and must not interrupt a hand.
    instance.addEventListener('controlling', () => {
      if (accepted.current) window.location.reload();
    });
    void instance.register().catch(() => undefined);
  }, []);

  if (!waiting || HAND_ROUTE.test(pathname)) return null;

  return (
    <div
      role="status"
      className="bg-green-deep text-ivory fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-base font-bold"
    >
      <span>Update ready</span>
      <Button
        type="button"
        variant="secondary"
        className="h-12 px-4 text-base"
        onClick={() => {
          accepted.current = true;
          serwist.current?.messageSkipWaiting();
        }}
      >
        Update now
      </Button>
    </div>
  );
}
