# 0009. The service worker never interrupts a hand

Status: Accepted

## Context

The app must open and score with no signal. A service worker is also the thing most likely to break a live session: an update that takes over mid-hand can reload the page and discard the unsaved tile and flag edits on the review screen.

## Decision

Serwist manages the service worker with deliberate caching rules:

- **Precache the app shell** (JavaScript, CSS, fonts and the tile sprite, all content-hashed) so the app opens and scores offline.
- **`/api/recognize` is `NetworkOnly`**, so a photo is never answered from cache.
- **`skipWaiting` is false.** A new worker waits. The app shows an "Update ready" bar and reloads only when the player taps "Update now". The bar is hidden entirely on the hand-entry route, and it reloads only for an update this tab accepted.
- **Navigation requests are `NetworkFirst`, cached under a key with the `_rsc` query removed.** That parameter is a hash of router state, so the same navigation otherwise has a different key before and after a reload. Normalising it lets a table reloaded online still open the hand screen offline.
- **The service worker is disabled in development.**

## Alternatives considered

- **`next-pwa`.** Unmaintained.
- **A hand-written worker.** Reinvents caching strategies.
- **`skipWaiting: true`.** The new worker takes over mid-hand.

## Consequences

- A half-entered hand is never lost to an update.
- A stale cached answer to an image request would be a wrong score with no network error to explain it, so that route is never cached.
- Players can run a slightly older version until they accept the update. An old but consistent app beats a new one that ate a half-entered hand.
- Client-side navigation is the offline hazard people miss, and it needs the custom cache-key rule.
