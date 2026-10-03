import { defaultCache } from '@serwist/next/worker';
import {
  NetworkFirst,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist';

import { rscCacheKey } from '@/lib/pwa/rsc-cache-key';

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
    // Intentionally shadows defaultCache's pages-rsc entry (first matching rule wins).
    // Client navigations (RSC) are keyed without the router-state hash, so a table reloaded
    // while online can still open the hand screen offline.
    {
      matcher: ({ request, sameOrigin }) =>
        sameOrigin &&
        request.headers.get('RSC') === '1' &&
        request.headers.get('Next-Router-Prefetch') === null,
      handler: new NetworkFirst({
        cacheName: 'pages-rsc-offline',
        plugins: [{ cacheKeyWillBeUsed: async ({ request }) => rscCacheKey(request.url) }],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
