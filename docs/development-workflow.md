# Development workflow

The repository is set up so that several people or AI agents can work at once without overwriting each other, and so that `main` is always green and deployable. The full rule set is in `CLAUDE.md`; this page explains the reasoning.

## Principles

- **`main` is only reached through a pull request.** Nobody commits or pushes to it directly, and nobody force-pushes it.
- **One task, one branch, one pull request.** A PR that mixes scoring, UI and dependency changes gets split.
- **Branches are short-lived** and rebased on `origin/main` before each push.
- **Merging is a human decision.** Opening the PR and passing review is the default stopping point, and merges are squash merges so each PR becomes one Conventional Commit.

## Branch names and commits

Branches are `<type>/<short-kebab-slug>`, where the type is one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore` or `ci`. Commits follow Conventional Commits, `type(scope): imperative summary`, at most 72 characters, with a body when the reason is not obvious. Scoring commits name the golden hand they add.

Files are staged by explicit path, never with `git add -A`, so nothing unexpected such as an environment file or build output is committed.

## Parallel work

Two agents sharing one checkout would stage each other's files and switch each other's branches, so:

- Every agent works in its own **git worktree** (`.claude/worktrees/<slug>`), which shares the object store and is cheap to create.
- Each task owns a **disjoint set of paths**. If a task needs a change outside them, it notes it in its report rather than making it.
- **Shared files are serialised**: `package.json`, the lockfile, TypeScript and ESLint config, `next.config.ts`, CI and `CLAUDE.md` conflict easily, so only one task touches them at a time. Dependency additions go in their own small `chore/` PR that merges first.
- Lockfile conflicts are never hand-merged. Take `origin/main`'s version and run `pnpm install`.

## Review

Every change is reviewed by a **separate reviewer with fresh context**; an author never reviews their own work. The reviewer reports findings as `blocker`, `should-fix` or `nit`, each with a file and line, and ends with `approve` or `changes requested`. The author fixes blockers and should-fix items, re-runs the verify gate, and requests a new review, for at most three rounds. After that the open findings go to a human.

The checklist covers correctness, scoring (a golden hand exists, payments sum to zero, the engine version is stamped), architecture (the core stays pure, events are append-only, only store actions write events), boundaries and security (Zod at every boundary, no public secrets, no logged photos or names), scope and hygiene, and tests.

## Pull requests

A PR is opened only after the verify gate is green, the branch is rebased, and the review verdict is `approve`. The body follows `.github/pull_request_template.md` and records what changed and why, how it was tested, the review outcome, and which golden hand covers any scoring change.

## Why this much process

The process is cheap insurance against the failures that parallel work actually causes: crossed staging areas, conflicting config edits, and authors who cannot see their own mistakes. The cost is overhead per change, in exchange for a `main` that stays green.
