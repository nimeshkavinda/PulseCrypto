---
title: 'Phase 10b: Gateway hardening, lean image and load-test evidence'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'b96243ebbe18a46950c3cf63f2b3fa2f6ac966b7'
context:
  - '{project-root}/docs/protocol.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- `/ws` uses the `ws` defaults: a 100 MiB `maxPayload`, no inbound rate limit and no connection cap. It accepts any browser Origin and never detects half-open sockets.
- `/metrics` is public, and `/health` can't tell an orchestrator whether the gateway has data to serve.
- The production image installs every workspace's dependencies, the mobile ones included.
- The performance claims have no measurements behind them.

**Approach:**
- Bound every per-connection resource and reject abuse early.
- Move metrics to an internal port and add `/ready`.
- Slim the Docker image to the backend and shared packages.
- Add a reproducible load-test harness (synthetic feed, many real `ws` clients, slow consumers) whose results are published.

## Boundaries & Constraints

**Always:**
- Every limit is configurable through env, with safe defaults: `WS_MAX_PAYLOAD_BYTES`=4096, `WS_MAX_CONNECTIONS`=10000, `WS_RATE_LIMIT_BURST`=20, `WS_RATE_LIMIT_PER_SEC`=10, `WS_HEARTBEAT_MS`=30000, `METRICS_PORT`=9464, and `ALLOWED_ORIGINS`.
- Native apps send no `Origin` header, so an absent Origin is allowed. A present Origin must match the allowlist when the allowlist isn't `*`.
- Rejections at upgrade time are HTTP responses (`503` + `Retry-After` when full, `403` for a bad origin). Rejections after upgrade are WS close codes (`1009` too big, `1008` rate limit).
- The load test must not depend on Binance (synthetic feed) and must run with one command.

**Never:**
- No authentication or TLS termination. That belongs to the edge/load balancer, and the README says so.
- No protocol shape changes and no mobile changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Oversized frame | client sends > `WS_MAX_PAYLOAD_BYTES` | socket closed `1009` |
| Message flood | > burst messages, faster than the refill rate | socket closed `1008 'rate limit'`; counted |
| Normal chatter | ping every 5 s, occasional subscribe | never limited |
| Connection cap | `WS_MAX_CONNECTIONS` already connected | upgrade answered `503` + `Retry-After`; existing clients unaffected |
| Foreign origin | `Origin: https://evil.example`, allowlist set | upgrade answered `403` |
| No origin | native client, allowlist set | accepted |
| Half-open socket | client stops answering WS pings | terminated at the next heartbeat after a missed pong; counted |
| Readiness | metadata not loaded, or upstream `connecting`/`down` | `/ready` 503 with reasons; 200 when loaded and `live`/`stale` |
| Metrics | `GET /metrics` on the public port | 404; served on `METRICS_PORT` |
| Image | `docker build` | no `react-native`/`expo` in `node_modules`; container healthy |

</frozen-after-approval>

## Code Map

- `backend/src/config.ts`: the new limit variables and `METRICS_PORT`.
- `backend/src/hub/ClientSession.ts`: token-bucket state and heartbeat liveness. `HubSocket` gains `ping()` and a `pong` event.
- `backend/src/hub/ChannelHub.ts`:
  - Rate-limit check before parsing.
  - Heartbeat interval in `start()`/`stop()`.
  - `hasCapacity()`.
  - Close-code constants.
- `backend/src/ws/stream.routes.ts`: `preValidation` for the capacity and origin checks.
- `backend/src/app.ts`: register `@fastify/websocket` with `maxPayload`, and drop `/metrics` from the public app.
- `backend/src/http/metrics.routes.ts`: becomes `buildMetricsApp()` (a separate Fastify instance).
- `backend/src/http/health.routes.ts`: add `/ready` through an injected readiness function.
- `backend/src/server.ts`: start the metrics server; wire readiness from `MetadataService` + `StatusTracker`.
- `backend/Dockerfile`, `docker-compose.yml`: workspace-scoped installs, `COPY --chown`, one healthcheck, `METRICS_PORT` exposed.
- `backend/scripts/loadtest/{server,run,client-worker}.ts` (new): the harness. `npm --prefix backend run loadtest`.
- Tests: extend `hub.test.ts` and `stream.integration.test.ts`; `routes.test.ts` covers `/ready` and the metrics app.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/config.ts` -- limit variables
- [x] `backend/src/hub/*` -- rate limit, heartbeat, capacity
- [x] `backend/src/ws/stream.routes.ts`, `backend/src/app.ts` -- upgrade checks, `maxPayload`
- [x] `backend/src/http/*`, `backend/src/server.ts` -- `/ready`, internal metrics server
- [x] `backend/Dockerfile`, `docker-compose.yml` -- lean image
- [x] `backend/scripts/loadtest/*`, `backend/package.json` -- the harness
- [x] `backend/tests/*` -- every matrix row except Image (verified by a docker build)
- [x] `docs/performance.md` -- load-test method and results

**Acceptance Criteria:**
- Given the load test at 1k and 5k clients with a 70/30 watchlist/terminal mix and 2% slow readers, then results report gateway CPU, RSS, p50/p99 tick duration, p50/p99 frame latency and bytes per client per second, and slow readers are skipped and then closed without affecting healthy clients' latency.
- Given `npm test && npm run typecheck && npm run lint`, then all pass.

## Verification

**Commands:**
- `npm test && npm run typecheck && npm run lint` -- expected: all green
- `docker compose build && docker compose up -d` -- expected: healthy; `curl :8080/metrics` 404; `curl :9464/metrics` 200
- `npm --prefix backend run loadtest -- --clients 5000` -- expected: a results table

## Implementation Notes

- The load test ([docs/performance.md](../performance.md)) found the per-client cost to be ~6–15 µs per tick. A CPU profile showed the kernel `writev` (one per client per frame) dominating busy time, with hub logic ~0.6 µs per client measured in isolation. Two changes follow:
  - Clients with identical pending state in a tick now share one pre-encoded `Buffer` (cache keyed by an item-version signature).
  - Frame metrics are incremented once per tick.
- Results: 10k clients on one process at 58% ELU, tick p99 73 ms (< 100 ms budget), frame latency p99 59 ms. Every 2% slow reader was skipped then closed with 1013, and no healthy client was lost.
- The image went from 1.99 GB to 309 MB: 47 packages, 39.7 MB of `node_modules`, and no React/Expo. It runs as `node`, with a single healthcheck. Metrics port 9464 is bound to localhost in compose.
- The load harness covers the real-socket slow-consumer scenario deferred from Phase 9.
- Found in Phase 11 device testing: the shared frame `Buffer`s were being sent as binary WebSocket frames. They're now sent as text frames (`{ binary: false }`), with an integration assertion.
- Readiness counts upstream `stale` as ready: the instance still serves real, partially fresh data, and taking every replica out during a partial upstream stall would cause a full outage.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-23: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | HTTP CORS split `ALLOWED_ORIGINS` without trimming while the WS origin check trimmed, so `"a, b"` behaved differently on the two paths | medium | patch | One parsed list is now shared by both, plus a CORS test in production mode. |
| 2 | The capacity check runs before the upgrade, so concurrent upgrades can briefly exceed `WS_MAX_CONNECTIONS` | low | reject | Overshoot is bounded by the number of in-flight upgrades (a handful), and memory per client is bounded by the hard limit. A strict cap would need a reservation counter across async upgrade completion, which adds complexity for no practical benefit. Documented as a soft cap. |
| 3 | The load-test client uses the private `ws._socket.pause()` to simulate slow readers | low | reject | Test tooling only, and it's the most direct way to stop reading at the TCP level. It isn't shipped. |
| 4 | Heartbeat liveness is also refreshed by inbound messages, not only pongs | false | none | Intended: any inbound traffic proves the connection is alive. Half-open sockets send nothing, so they are still caught. |
