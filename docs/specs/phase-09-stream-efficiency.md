---
title: 'T9: Wire protocol v1 and channel-based gateway fan-out'
type: 'refactor'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'b28f874603aa79a3bcea3b71fd8275889eb2dc01'
context:
  - '{project-root}/docs/tasks.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The gateway pushes all 5 pairs at full 20-level depth to every client as 5 frames per tick, whether or not anything changed or the client is looking at it. The "degraded" backpressure tier keeps writing into a socket that is already backed up Zod parsing runs in the 10 Hz hot path. Payload timestamps look like data freshness but are just emit time.

**Approach:** Introduce a versioned, channel-based protocol (`tickers`, `book:<PAIR>`, `status`). Clients start unsubscribed and opt in. A `ChannelHub` tracks a version per channel item, serializes each changed item at most once per tick, and sends each client at most one batched frame per tick containing only what changed since that client's last frame. Backpressure skips frames. Because tracking is per client, a skipped client later receives the latest state, never a backlog. Slow consumers that stay lagging are closed with 1013.

## Boundaries & Constraints

**Always:**
- The server tick stays `FLUSH_INTERVAL_MS` (default 100).
- A client's cadence can only be slower than the tick. It is rounded up to a multiple of the tick and acknowledged with the effective value.
- One `JSON.stringify` per changed item per tick at most, whatever the client count.
- Validate inbound client messages with Zod. Never validate outbound in the hot path.
- Never send an item whose version is 0, meaning no upstream data yet. That stops the seeded placeholder data reaching clients.
- Thresholds come from env with the documented defaults.

**Never:**
- No upstream changes to Binance streams, no REST bootstrap, no security limits (Phase 10).
- No mobile rework (Phase 11). Legacy `MarketUpdatePayload`/`ClientCommand` stay in `shared`, marked `@deprecated`, so mobile keeps compiling.
- No new runtime dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Connect | new socket | one frame with `hello` (tickMs, cadence bounds, pairs, channels) and current `status` |
| Subscribe | `{type:'subscribe',channels:['tickers']}` | `ack` next; the next tick carries all tickers with version > 0, even if unchanged this tick |
| Nothing changed | tick with no version bumps | no frame sent to that client |
| Partial change | only BTC ticker changed | frame has `tickers` with just BTC |
| Book channel | subscribed `book:ETHUSDT` | only the ETH book is sent, never other pairs |
| Unsubscribe | `book:ETHUSDT` removed | no further ETH book messages |
| Cadence | `setCadence 250`, tick 100 | ack `cadenceMs: 300`; frames at most every 3 ticks, carrying latest state |
| Cadence below tick | `setCadence 10` | ack `cadenceMs: 100` |
| Soft limit | `bufferedAmount > WS_SOFT_LIMIT_BYTES` | frame skipped; `frames_dropped_total` incremented; client marked lagging |
| Recovery | buffer drains | next frame contains latest versions of everything missed |
| Sustained lag | lagging > `WS_LAG_GRACE_MS` or buffer > `WS_HARD_LIMIT_BYTES` | close `1013 'slow consumer'`; terminate after 1 s if not closed; counted |
| Bad input | invalid JSON / schema | `error` message with `code`, rate-limited to 1/s per client; socket stays open |
| Ping | `{type:'ping',id:7}` | immediate frame with `pong {id:7, serverTs}` |
| Unknown channel | `book:FOOUSDT` | `error` code `UNKNOWN_CHANNEL`; valid channels in the same request still applied |

</frozen-after-approval>

## Code Map

- `shared/src/schemas.ts`: keep `SUPPORTED_PAIRS`, `SupportedPairSymbolSchema`, `PairMetadataSchema`, `DepthTuple`; mark `MarketUpdatePayload*` and `ClientCommand*` `@deprecated` (still used by `mobile/src/context/MarketStreamContext.tsx`).
- `backend/src/conflator.ts`, `backend/src/ws/commands.ts`, `backend/tests/conflator.test.ts`: delete; replaced by the hub. `handleConnection` there is dead code.
- `backend/src/orderbook.ts`: keep the derived-analytics math (spread, pressure over all 20 levels, cumulative notional). Add a per-pair `version` bumped in `updateDepth`, and `getBookView(pair)` returning a plain object with no Zod. Keep `updateLastTrade`.
- `backend/src/metadata.ts`: add a per-pair `version` bumped by `updateTicker`/`updateTradePrice`, plus `updatedAt`.
- `backend/src/metrics.ts`: reuse `MetricsRegistry`. Replace the shedding gauge with lagging-clients, frames-sent, frames-dropped, bytes-sent and slow-consumer-disconnect metrics.
- `backend/src/ws/stream.routes.ts`: delegate to `hub.attach(socket)`.
- `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/http/health.routes.ts`: swap `ConflationEngine` for `ChannelHub`.
- `backend/tests/binance.test.ts`: the pattern for real `ws` servers on port 0, reused for integration tests.

## Tasks & Acceptance

**Execution:**
- [x] `shared/src/protocol.ts` -- `PROTOCOL_VERSION`, channel helpers, Zod `ClientMessageSchema`, server message types plus Zod schemas (used in tests), and a `Frame` type -- one contract for both sides
- [x] `shared/src/index.ts`, `shared/src/schemas.ts`, `shared/tests/protocol.test.ts` -- export, deprecate legacy, contract tests
- [x] `backend/src/config.ts` -- `WS_SOFT_LIMIT_BYTES`=65536, `WS_HARD_LIMIT_BYTES`=1048576, `WS_LAG_GRACE_MS`=5000
- [x] `backend/src/orderbook.ts`, `backend/src/metadata.ts` -- versions plus plain view getters; drop the hot-path Zod parse
- [x] `backend/src/market/marketSource.ts` -- `MarketSource` interface (`getTicker`, `getBook`, `getStatus`, each with a version) and an adapter over the two services; this is the Phase 10 seam
- [x] `backend/src/hub/ClientSession.ts`, `backend/src/hub/ChannelHub.ts` -- subscriptions, per-client sent versions, cadence, lag state, frame assembly from cached per-item strings, inbound handling
- [x] `backend/src/metrics.ts`, `app.ts`, `server.ts`, `http/health.routes.ts`, `ws/stream.routes.ts` -- wiring; delete the conflator and commands files
- [x] `backend/tests/hub.test.ts` -- unit tests for every matrix row using fake sockets and a controllable source
- [x] `backend/tests/stream.integration.test.ts` -- real Fastify on port 0 plus a `ws` client: hello, subscribe → data frame, unsubscribe, cadence ack, ping/pong, invalid input
- [x] `docs/protocol.md` -- envelope, every message with an example, channel semantics, cadence, backpressure, and what `updatedAt`/`eventTs` mean

**Acceptance Criteria:**
- Given 1,000 fake clients subscribed to `tickers`, when one tick has a single ticker change, then that item's `JSON.stringify` runs once and each client gets one frame.
- Given `npm test`, `npm run typecheck` and `npm run lint` from the root, then all pass, with the mobile workspace unchanged.

## Design Notes

Frame envelope (every server frame):
```json
{"v":1,"tick":1842,"ts":1727071234567,"msgs":[
  {"type":"tickers","data":[{"pair":"BTCUSDT","price":64238.17,"change24h":2.45,"high24h":65120,"low24h":62800,"volume24h":28410.5,"updatedAt":1727071234501,"eventTs":null}]},
  {"type":"book","pair":"BTCUSDT","updatedAt":1727071234490,"spread":0.01,"spreadPct":0.0000156,"buyPressure":58.2,"sellPressure":41.8,"bids":[[64238.16,0.4522,29048.4]],"asks":[[64238.17,0.112,7194.67]]}
]}
```
- `tick` is the global hub tick. Gaps are normal; they mean nothing changed or the frame was conflated away.
- Frames are assembled by string concatenation of cached item JSON, so there is no per-client stringify.
- `updatedAt` is when the gateway received the data; `eventTs` is the exchange event time, filled in by Phase 10.
- A client's sent version per item is only committed after `socket.send` succeeds.

## Verification

**Commands:**
- `npm test && npm run typecheck && npm run lint` -- expected: all green

## Implementation Notes

- 2026-09-23: Spec approved at about 2k tokens, above the 1.6k guideline. It was kept whole because the protocol, the hub and their tests are one change.

- Books now start empty (version 0) instead of seeded, so only upstream data is ever sent. The seeded metadata in `/pairs/meta` still exists; Phase 10 removes it.
- The DepthTuple third element is now **per-level notional**, matching the mockup's TOTAL column. The client derives cumulative values for the depth chart.
- `updateLastTrade` was removed from OrderBookManager. The trade price flows through `MetadataService.updateTradePrice`, which is the ticker source.
- Found and fixed: `backend/tsconfig.test.json` inherited `exclude: ["tests"]`, so `npm run typecheck` never checked backend tests. Backend vitest now aliases `@pulsecrypto/shared` to its sources, and `pre*` scripts build shared, so a fresh clone works without a manual shared build.
- `@fastify/websocket` is hoisted to the root while `fastify` sits in `backend/node_modules`, so the plugin's own type augmentation never resolves. A documented bridge now lives in `src/types/fastify-websocket.d.ts`.
- `buildApp` no longer uses module-level singletons (an early part of T10.5). `server.ts` is the composition root.
- Smoke test against live Binance: subscribed to `tickers` + `book:BTCUSDT`, the client received 10.1 frames/s at 14.35 KB/s.
- Matrix coverage: `backend/tests/hub.test.ts` covers every row. `backend/tests/stream.integration.test.ts` covers connect, subscribe, book, unsubscribe, cadence, ping and bad input over real sockets.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-23: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | `handleMessage` still processes inbound frames after `closeSlowConsumer` marks the session closed. The socket stays open for up to 1 s. | low | patch | `closeSlowConsumer` sets `closed` but the `message` listener stays attached, so a ping produced a pong on a 1013-closing socket. Fixed with a guard, plus a test. |
| 2 | The effective cadence can exceed the advertised `maxCadenceMs` when the tick doesn't divide it (tick 300 → 10200 > 10000). | low | patch | `ceil(min(req,max)/tick)`. Now capped at `floor(max/tick)` ticks, plus a test. |
| 3 | The lag grace timer only advanced on ticks where the client had pending data, so a congested client with nothing new was never grace-closed. The lagging gauge undercounted the same way. | medium | patch | `lagSince` was set only in the `parts.length > 0` branch. Lag tracking moved ahead of the cadence and payload checks, plus a test. |
| 4 | There was no test for the soft < hard limit config validation or for env coercion. | low | patch | Added `backend/tests/config.test.ts`. |
| 5 | Backpressure is only exercised with fake sockets (`bufferedAmount` set by hand), with no real-socket slow-consumer test. | low | defer | Kernel buffers absorb MBs before `ws.bufferedAmount` grows, so a deterministic test needs a paused reader at volume. It fits the Phase 10 load harness (T10.6). |
| 6 | The mobile client still speaks the legacy protocol (`action: setThrottle/ping/subscribe`) and gets `BAD_MESSAGE` replies and no data. | false | none | Intended and documented in the spec's Never section: the mobile migration is Phase 11. The legacy types are kept so mobile still compiles. |
| 7 | `/pairs/meta` still serves seeded placeholder metadata before upstream data arrives. | low | defer | Pre-existing, and scheduled as T10.2 (REST bootstrap). Stream items with version 0 are already never sent. |
| 8 | There's still no `maxPayload`, connection cap or inbound rate limit on `/ws`. | low | defer | Pre-existing, and scheduled as T10.3. |
