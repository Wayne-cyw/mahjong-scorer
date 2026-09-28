import { defaultCache } from '@serwist/next/worker';
import { NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // ADR-51: a new worker waits for the player instead of taking over mid-hand.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // ADR-50: recognition is network-only, so a photo is never answered from cache.
    { matcher: ({ url }) => url.pathname === '/api/recognize', handler: new NetworkOnly() },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
