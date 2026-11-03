# 0001. The phone is the application; the server is a stateless proxy

Status: Accepted

## Context

Players want a scorekeeper that works at a table with unreliable signal and no sign-up. The only feature that needs a network is photo recognition, and the model API key must never reach the browser.

## Decision

All game logic, scoring, storage and UI run on the phone. The server consists of one recognition route and a health check. The recognition route holds no database, no sessions and no user data, and keeps nothing it receives.

## Alternatives considered

- **Server-authoritative app with accounts.** More to build, secure and pay for, and it breaks offline play.
- **Fully client-side app calling the model directly.** Exposes the API key to anyone with dev tools.
- **Native app.** Adds install friction and a second codebase.

## Consequences

- Offline is the default rather than a mode, so scoring never waits on or fails because of the network.
- The privacy promise is structural: player names, history and photos have nowhere on the server to live.
- There are no accounts, auth, sync conflicts or database to operate.
- One phone is the scorekeeper. There is no live scoreboard on other players' phones, and a lost or cleared phone loses games unless they were backed up. Multi-device sync is deferred; the event log keeps that door open ([0002](0002-append-only-event-log.md)).
