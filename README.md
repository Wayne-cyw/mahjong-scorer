<h1 align="center">Mahjong Scorer</h1>
<p align="center"><b>Photograph a winning Hong Kong mahjong hand and get the fan, payments and next dealer instantly, with no account and full offline play.</b></p>

<p align="center">
  <img src="docs/demo.gif" alt="Demo of Mahjong Scorer" width="700">
</p>

<p align="center">
  <a href="https://TODO-live-demo-url">Live Demo</a> ·
  <a href="https://TODO-video-url">2-min Video Walkthrough</a>
</p>

<p align="center">
  <img alt="Build" src="https://img.shields.io/github/actions/workflow/status/Wayne-cyw/mahjong-scorer/ci.yml">
  <img alt="License" src="https://img.shields.io/github/license/Wayne-cyw/mahjong-scorer">
  <img alt="Language" src="https://img.shields.io/github/languages/top/Wayne-cyw/mahjong-scorer">
</p>

---

## Why I Built This

Hong Kong mahjong scoring is hard to do correctly at speed: patterns overlap, some exclude others, and the fan total maps to a payment table. Most tables rely on one expert or argue, and existing calculators make someone tap in 14 tiles by hand. I built this as a personal project to score a hand from a photo, track the whole game, and show the math behind every point.

## Highlights

- **Camera is an accelerator, not a gate**: every step has a manual path, and a person confirms the recognized tiles before any score changes.
- **Local-first**: all game logic runs on the phone; the only server code is one stateless route that sends hand photos to Gemini. Full scoring works offline.
- **Fully explainable and reversible**: every point traces to a named fan line and payment rule, and the game state is rebuilt by replaying an append-only event log.
- **Quality gates**: 50 golden hands pin scoring behavior, property tests (fast-check) cover the engine, and CI runs lint, type-check, tests, build and a Docker build on every push.

## Demo & Screenshots

| Photo to hand                          | Fan breakdown                          |
| -------------------------------------- | -------------------------------------- |
| ![Screenshot 1](docs/screenshot-1.png) | ![Screenshot 2](docs/screenshot-2.png) |

## Features

- Score a Hong Kong (Old Style) hand from a photo, then correct any tile before confirming
- Itemized fan breakdown and payments that always sum to zero
- Full 4-wind game tracking: scores, dealer rotation, prevailing wind and dice
- Edit or undo any past hand; the game is replayed from its history
- Installable PWA that works offline, with JSON backup and restore
- Opt-in analytics only; photos and player names are never logged or stored

## Architecture

The phone owns everything. A user action in a Zustand store appends an event to a Dexie (IndexedDB) log, a pure reducer replays the log into game state, and the UI renders that derived state. For photo scoring, the client compresses the image and posts it to `/api/recognize`, which rate-limits the request (Upstash Redis), asks Gemini for tiles under a Zod-generated JSON schema, validates the response, and returns a draft hand. The pure scoring engine then computes fan and payments on the device.

### Key design decisions

| Decision                                                                           | Alternatives considered                                      | Why I chose this                                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Dexie event log as the single source of truth                                      | localStorage, mutable state in the store                     | Append-only events make every hand editable and every score reproducible by replay                                              |
| Scoring and game rules as pure TypeScript (`lib/tiles`, `lib/scoring`, `lib/game`) | Logic inside React components, a third-party mahjong library | The riskiest logic is testable in isolation; ESLint forbids React, Dexie and network imports there                              |
| Gemini vision via a server route                                                   | On-device YOLO model, other vision APIs                      | No training data and handles varied tile art; the API key stays server-side. Tradeoff: needs network and a per-request cost cap |
| Zod at every boundary                                                              | Hand-written guards                                          | One schema validates model output, stored events and imported backups, and generates the JSON schema sent to the model          |
| Next.js as an SPA shell                                                            | Vite + separate function, SvelteKit                          | One deploy unit with a built-in API route; the server surface is a single route                                                 |

## Tech Stack

| Layer          | Technology                                                                | Why                                                                 |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Frontend       | Next.js (App Router), React, TypeScript (strict), Tailwind CSS, shadcn/ui | One language across UI, engine and server; accessible primitives    |
| State and data | Zustand, Dexie, Zod                                                       | Local-first persistence with typed, validated boundaries            |
| Recognition    | Gemini (`@google/genai`), browser-image-compression, Upstash Ratelimit    | Tile recognition from photos, shrunk before upload and rate-limited |
| PWA            | Serwist                                                                   | Offline caching and install manifest                                |
| Testing        | Vitest, fast-check, Playwright                                            | Unit, property-based and mobile end-to-end tests                    |
| DevOps         | pnpm, GitHub Actions, Docker, Sentry                                      | CI on every push, self-host exit path, error tracking               |

## Challenges & What I Learned

**Challenge 1: Keeping scoring correct as rules interact**

- _Problem:_ Fan patterns overlap and exclude each other, so small changes silently shift totals.
- _Approach:_ Kept the engine pure and required a golden hand for every scoring change, plus property tests for invariants such as payments summing to zero.
- _Result:_ 50 golden hands guard behavior, and CI blocks any regression.

**Challenge 2: Trusting an AI model with game state**

- _Problem:_ Model output is probabilistic and can be wrong or malformed.
- _Approach:_ Treated the model as a suggestion only: Zod-validate its output, return invalid hands as `valid: false` results, and always require human confirmation. Added an eval harness (`pnpm eval`) with a spend cap to compare models.
- _Result:_ Recognition can never change a score without a person confirming it.

**Takeaways:** Making the event log the only source of truth removed whole classes of state bugs. I would add the canned recognition sample and on-device detection earlier, and I now think of pure, dependency-free cores as the cheapest way to make risky logic safe to change.

## Getting Started

### Prerequisites

- Node 22+ and pnpm (`corepack pnpm` works if pnpm is not on your PATH)
- A Gemini API key from Google AI Studio (only needed for photo recognition)

### Run locally

```bash
git clone https://github.com/Wayne-cyw/mahjong-scorer.git
cd mahjong-scorer
cp .env.example .env.local     # add GEMINI_API_KEY (Upstash and Sentry are optional)
pnpm install
pnpm dev
```

App runs at http://localhost:3000.

### Run tests

```bash
pnpm test          # unit and property tests
pnpm test:e2e      # Playwright end-to-end
```

## Project Structure

```
mahjong-scorer/
├── app/            # Next.js routes, including /api/recognize
├── components/     # UI components (never touch Dexie directly)
├── stores/         # Zustand store actions (the only code that writes events)
├── lib/
│   ├── tiles/      # tile model (pure)
│   ├── scoring/    # fan rules and payments (pure)
│   ├── game/       # events, reducer, dice, seats (pure)
│   ├── db/         # Dexie persistence and backup
│   └── recognition/# prompt, schema, validation
├── tests/          # golden hands, e2e, recognition eval
└── docs/
```

## Testing & Quality

- Vitest unit tests, fast-check property tests, 50 golden hands, and Playwright e2e on a mobile viewport
- ESLint, Prettier and strict TypeScript, enforced in CI along with a production build and Docker build
- Bundle-size budgets (size-limit) and Lighthouse CI

## Roadmap

- [x] Photo-to-score loop with manual fallback
- [x] Full-game tracking, history edits and backup
- [ ] Recognition accuracy eval on a real photo set
- [ ] On-device tile detection
- [ ] Other rulesets and multi-device sync

## About Me

I'm Wayne Chiu, a penultimate-year Computer Science student at the University of Toronto seeking software engineering internships.

[Portfolio](https://TODO) · [LinkedIn](https://TODO) · [Email](mailto:wayne.chiu0823@gmail.com)

## License

[MIT](LICENSE)
