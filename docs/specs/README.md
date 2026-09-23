# Change Specs

From Phase 9 on, every change starts as a short spec produced with the BMAD `bmad-build` workflow. It is implemented against that spec, then reviewed through three lenses before commit:
- **Blind:** the diff alone.
- **Edge-case:** path tracing.
- **Verification-gap:** which claims lack a test.

Each spec records:
- **Intent and boundaries.** The part a human approves. It is frozen once implementation starts.
- **An I/O and edge-case matrix.** Every row must map to a passing test.
- **A code map.** What to touch, what to reuse and what to leave alone.
- **Implementation notes.** Decisions and surprises found along the way.
- **A review triage log.** One verdict per reviewer finding: fixed, deferred, or refuted with evidence.

| Phase | Spec | Status |
|---|---|---|
| 9 | [Stream efficiency: protocol v1, channel fan-out and conflating backpressure](./phase-09-stream-efficiency.md) | done |
| 10a | [Upstream ingestion fixes, REST bootstrap and data freshness](./phase-10a-upstream-ingestion.md) | done |
| 10b | [Gateway hardening, lean image and load-test evidence](./phase-10b-gateway-hardening.md) | done |
| 11 | [Mobile connection reliability and render performance](./phase-11-mobile-data-layer.md) | done |
| 12 | [Live watchlist and terminal improvements](./phase-12-live-watchlist-terminal.md) | done |
