# Mahjong Score Tracker

Local-first Hong Kong mahjong scorer: a Next.js PWA where the phone holds all game logic and one stateless route (`/api/recognize`) sends hand photos to Claude. Full rationale lives in the design docs (gitignored, local only): `Mahjong Score Tracker — Engineering Design.md` (ADR-xx) and `— Product Direction.md` (PD-xx).

## Commands

Use `pnpm`; if it is not on PATH, use `corepack pnpm` (the version is pinned in `package.json`).

| Task         | Command                                      |
| ------------ | -------------------------------------------- |
| Dev server   | `pnpm dev`                                   |
| Lint         | `pnpm lint`                                  |
| Type-check   | `pnpm typecheck`                             |
| Format check | `pnpm format:check` (fix with `pnpm format`) |
| Unit tests   | `pnpm test`                                  |
| Build        | `pnpm build`                                 |
| E2E          | `pnpm test:e2e`                              |

**Verify gate** = `lint`, `typecheck`, `format:check`, `test`, `build`, all green. Nothing is committed, pushed or reviewed until it passes.

## Code rules that bite

- `lib/tiles`, `lib/scoring`, `lib/game` are pure TypeScript: no React, Next.js, Dexie, Zustand or network (ESLint enforces this).
- The Dexie event log is the only source of truth; state is derived by replay. Events are appended, never edited or deleted. Only store actions write events.
- Parse every boundary with Zod (model output, stored events, imported backups). Invalid hands are `valid: false` results, not exceptions.
- Model API keys are server-only: no `NEXT_PUBLIC_` prefix. Never log or store photos or player names.
- Any scoring change needs a golden hand in the same PR (`tests/golden-hands/`).

## Git workflow

Goal: many agents can work at once without overwriting each other, and `main` is always green and deployable.

### Hard rules (never break these)

1. **Never commit or push to `main`.** All work happens on a branch and reaches `main` through a PR.
2. **Never force-push** except `--force-with-lease` to your own branch after a rebase. Never force-push `main`.
3. **Never use `--no-verify`**, skip hooks, or bypass the verify gate.
4. **Never `git add -A`, `git add .` or `git commit -a`.** Stage files by explicit path.
5. **Never commit secrets or local files**: `.env*` (except `.env.example`), keys, tokens, `*.tsbuildinfo`, `public/sw.js`, or the two gitignored design docs.
6. **Never rewrite history that someone else may have pulled.** Your own unpushed commits are fine to amend or squash.
7. **Do not merge a PR unless the user says to.** Opening the PR and getting review to pass is the default stopping point.
8. **Destructive git actions** (`reset --hard`, `clean -fd`, `branch -D`, `worktree remove --force`) only on your own branch or worktree, and only after checking `git status` and `git log` first.

### Branching

- Branch from a fresh `origin/main`: `git fetch origin && git switch -c <type>/<slug> origin/main`.
- Name: `<type>/<short-kebab-slug>`, type one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Example: `feat/dice-roller`, `fix/dealer-rotation-draw`.
- **One task, one branch, one PR.** Keep PRs small and scoped to one concern; a PR that mixes scoring, UI and dependency changes gets split.
- Keep branches short-lived. Rebase on `origin/main` at least before each push and before opening the PR.
- Never build one task on another task's unmerged branch unless the orchestrator says so. If a dependency exists, wait for it to merge, then branch from `main`.

### Working with multiple agents at once

The shared working tree and git index are single-writer. Two agents in the same checkout will stage each other's files and switch each other's branches, so:

- **Every agent works in its own git worktree**, never in the primary checkout. The orchestrator spawns subagents with `isolation: "worktree"`, or creates one manually:
  ```bash
  git fetch origin
  git worktree add .claude/worktrees/<slug> -b <type>/<slug> origin/main
  cd .claude/worktrees/<slug> && pnpm install --frozen-lockfile
  ```
  `.claude/worktrees/` is gitignored. Worktrees share the object store, so this is cheap.
- **Confirm where you are before any git write**: run `git branch --show-current` and `pwd`. If the branch is `main` or the path is the primary checkout, stop.
- **Disjoint file ownership.** The orchestrator assigns each task a set of paths (for example `lib/game/**` and `tests/` for the reducer task) and gives no path to two concurrent tasks. Stay inside your paths. If you need a change outside them, note it in your report instead of making it.
- **Shared files are serialized.** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `.github/**` and `CLAUDE.md` conflict easily. Only one task at a time may touch them; the orchestrator says which. Dependency additions go in their own small `chore/` PR that merges first.
- **Lockfile conflicts**: never hand-merge `pnpm-lock.yaml`. Take `origin/main`'s version and re-run `pnpm install` to regenerate it, then commit the result.
- **Do not run `pnpm dev` on a shared port** from several worktrees; set a distinct `PORT` per worktree.
- Agents do not merge, push to, or delete each other's branches. Coordination goes through the orchestrator.

### Committing safely

1. Confirm branch and location (see above), then `git status` and review `git diff` for what you are about to commit.
2. Run the **verify gate**. Fix failures; do not commit red code.
3. Stage by explicit path: `git add lib/game/dice.ts lib/game/dice.test.ts`. Check with `git diff --staged --stat` that nothing unexpected is staged (no `.env`, build output, or files outside your owned paths).
4. Commit with a **Conventional Commit** message: `type(scope): imperative summary` (72 chars or fewer), plus a body that says why when it is not obvious. Examples: `feat(game): add dice roller with rejection sampling`, `fix(scoring): count kong replacement as one fan`. Scoring commits name the golden hand added.
5. Make small, logically separate commits rather than one large one.

### Pushing safely

1. `git fetch origin && git rebase origin/main`. Resolve conflicts inside your worktree only, keeping both sides' intent; re-run the verify gate afterward.
2. `git push -u origin <your-branch>` (first push) or `git push` (later). Always name your own branch; never a bare `git push` from a branch with an unclear upstream.
3. After a rebase of an already-pushed branch, use `git push --force-with-lease origin <your-branch>`, never plain `--force`.
4. If a push is rejected, `git fetch` and inspect before doing anything else. Do not blindly force.

### Code review subagent (required before every PR)

Every change is reviewed by a **separate subagent with fresh context**, never by the agent that wrote it. Author agents never review their own work.

1. When the verify gate is green and the branch is rebased, the author (or orchestrator) spawns the reviewer with the `feature-dev:code-reviewer` agent type. Give it: the task description, the branch name, and the diff range `origin/main...HEAD`. It is read-only and must not edit, commit or push.
2. Review checklist (the reviewer reports against these):
   - **Correctness**: logic errors, edge cases, off-by-one in rotation and dice, unhandled errors.
   - **Scoring**: any scoring change has a matching golden hand; payments sum to zero; engine version is stamped.
   - **Architecture**: core `lib/` stays pure; events are append-only; only store actions write events; components never touch Dexie.
   - **Boundaries and security**: Zod parse at every boundary; no `NEXT_PUBLIC_` secrets; no logged photos or names; no `dangerouslySetInnerHTML`; rate-limit and size checks intact on `/api/recognize`.
   - **Scope and hygiene**: change stays within the task's owned paths; no stray files, debug code, commented-out code or unrelated reformatting; conventional commit messages.
   - **Tests**: new behavior is covered; tests assert behavior, not implementation.
3. The reviewer returns findings as a list, each with severity (`blocker`, `should-fix`, `nit`), `file:line`, the problem and a suggested fix, and ends with a verdict: `approve` or `changes requested`. Report only real issues with high confidence; no style opinions the linter already covers.
4. The author fixes every `blocker` and `should-fix`, commits the fixes as new commits, re-runs the verify gate, and requests a second review from a **new** reviewer. Repeat until the verdict is `approve`, with a maximum of 3 rounds; after that, stop and hand the open findings to the user.
5. `nit`s are optional. Note any deliberately skipped finding in the PR body with a reason.

### Pull requests

1. Only open a PR after: verify gate green, branch rebased on `origin/main`, reviewer verdict `approve`.
2. Create it from the branch with GitHub CLI, using the repo's PR template:
   ```bash
   gh pr create --base main --head <branch> --title "<conventional commit style title>" --body-file <body.md>
   ```
   Open as `--draft` if any check is still pending or review is unfinished, then mark ready with `gh pr ready` once it is.
3. The PR body follows `.github/pull_request_template.md` and also states: what changed and why, the linked task or ADR/PD ids, how it was tested (commands run and results), review outcome (rounds, skipped nits), and, for scoring changes, which golden hand covers it.
4. One concern per PR; keep it small enough to review in one sitting. Split large work into a stack of independent PRs that each merge cleanly on `main`.
5. After opening, bind and monitor CI with the desktop app's PR tools; do not poll `gh` in a loop. If CI fails, fix on the same branch with new commits, then re-push (and re-review if the fix is substantive).
6. **Merging is the user's call.** When told to merge: squash-merge so `main` stays linear and each PR is one Conventional Commit, using `gh pr merge --squash --delete-branch` only after CI is green and review is `approve`. Never enable auto-merge unless asked.
7. If two open PRs conflict, the one that merges second rebases on the updated `main` and re-runs the verify gate; it does not merge `main` into its branch.

### Cleanup

After a PR merges: `git fetch origin --prune`, remove the worktree (`git worktree remove .claude/worktrees/<slug>`), and delete the local branch (`git branch -d <branch>`, lowercase `-d` so git refuses if it is unmerged). Confirm `git worktree list` shows no stale entries.

### Orchestrator checklist (when running parallel tasks)

1. Split work into tasks with disjoint owned paths; schedule any shared-file change (dependencies, config) first or alone.
2. Spawn one author subagent per task, each with `isolation: "worktree"`, its branch name, owned paths, the verify gate, and this workflow.
3. When each author reports ready, spawn an independent `feature-dev:code-reviewer` subagent for it.
4. Collect PR links and review verdicts; report to the user. Do not merge without the user's go-ahead.
5. After merges, have each subagent rebase any remaining branches and re-run the gate.
