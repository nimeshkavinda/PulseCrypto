# Git Workflow & Commit Guidelines

This project follows a remote, GitFlow-based branching and review process using GitHub.

---

## 1. Branching & Pull Request Rules

```
main                          ← Always in a working, demo-ready state (Protected)
  ▲
  │ (Pull Request reviewed & merged manually by User on GitHub)
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

### Core Rules:
1. **Remote Repository**: All phase branches are pushed to GitHub (`https://github.com/nimeshkavinda/PulseCrypto.git`).
2. **Never Commit or Merge Directly to `main`**:
   * `main` is the protected baseline.
   * Direct commits to `main` are strictly forbidden (except the initial baseline spec commit).
   * **Never merge phase branches directly to `main` locally.**
3. **Pull Request Review Workflow**:
   * All work is developed and verified on `phase/<number>-<name>`.
   * When a phase is complete, the branch is pushed to origin:
     ```bash
     git push -u origin phase/<number>-<name>
     ```
   * A Pull Request is opened on GitHub from `phase/<number>-<name>` into `main`.
   * **The user manually reviews the PR diff and merges the PR on GitHub.**
   * Once merged, local `main` is updated:
     ```bash
     git checkout main
     git pull origin main
     ```
4. **Annotated Phase Tags**:
   * After each PR is merged into `main`, an annotated tag is created on `main`:
     ```bash
     git tag -a phase-1-complete -m "Phase 1 complete: Scaffolding, shared schemas, and Dockerfile"
     git push origin phase-1-complete
     ```

---

## 2. Commit Convention (Task-ID Traceability)

Every commit on a phase branch follows the Conventional Commits format, scoped to the specific Task ID from `docs/tasks.md`:

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

---

## 3. Commit Granularity & Review Checkpoints
* One commit per completed, verified task from `docs/tasks.md`.
* Never commit broken code: verify builds and tests pass locally before committing.
* Pushing and opening a PR is done at the phase boundary for user manual review.
