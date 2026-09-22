# Git Workflow & Commit Guidelines

This project follows a phase-branched, task-traceable Git workflow.

---

## 1. Branching Model

```
main                          ← Always in a working, demo-ready state
  │
  ├─ phase/1-foundation        ← Scaffolding, shared schemas, Dockerfile
  ├─ phase/2-backend           ← Fastify gateway, Binance ingestion, backpressure guard
  ├─ phase/3-mobile-shell      ← React Native navigation, design system tokens
  ├─ phase/4-watchlist         ← Watchlist, search, favorites, TanStack Query refresh
  ├─ phase/5-terminal          ← Order book table, SVG depth chart, Reanimated flash
  ├─ phase/6-telemetry         ← In-app telemetry dashboard, client-side throttling
  ├─ phase/7-resilience        ← Offline indicator, stale cache, auto-reconnect
  └─ phase/8-docs              ← Final README, demo video recording
```

* **Main branch**: `main` must always build, run, and remain in a demo-ready state.
* **Phase branches**: Created from `main` as `phase/<number>-<name>`.
* **Merging**: Merged back into `main` using `--no-ff` (non-fast-forward) so individual task commits remain visible in `git log --graph`.

---

## 2. Commit Convention

Every commit follows the Conventional Commits format, scoped to a specific Task ID from `docs/tasks.md`:

```
<type>(<task-id>): <summary>

[optional body explaining design decisions or trade-offs]
```

### Supported Types
* `feat`: A new feature or component implementation
* `fix`: A bug fix or correction
* `test`: Adding or updating test suites
* `docs`: Documentation, README, or specification updates
* `refactor`: Code change that neither fixes a bug nor adds a feature
* `chore`: Build scripts, dependencies, or tool configuration

### Examples
* `feat(T1.3): implement shared zod schemas with round-trip test coverage`
* `feat(T2.1): create fastify http server with /pairs/meta and /health`
* `feat(T2.5): implement 3-tier backpressure guard for socket flow control`
* `test(T2.6): add vitest suites for order book aggregation and backpressure`
* `docs(spec): add requirements.md, design.md, tasks.md, and git workflow`

---

## 3. Phase Boundary Tags

After merging each phase branch into `main`, an annotated tag is created on `main`:
* `phase-1-complete`
* `phase-2-complete`
* `phase-3-complete`
* `phase-4-complete`
* `phase-5-complete`
* `phase-6-complete`
* `phase-7-complete`
* `phase-8-complete`

These tags provide an instant timeline of project milestones via `git tag`.
