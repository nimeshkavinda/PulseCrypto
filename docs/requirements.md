# Requirements traceability

Each requirement from the assignment brief, where it is implemented, and how it is verified. Test files are under `shared/tests/`, `backend/tests/` and `mobile/tests/`; Maestro flows are under `mobile/.maestro/`. Measurements are in [performance.md](performance.md).

## Backend

| Requirement | Implementation | Verification |
|---|---|---|
| Node.js + TypeScript, Fastify, WebSockets | `backend/`: Fastify 5, `@fastify/websocket` (`ws`), Node 20; Docker image `node:22-alpine` | `npm run typecheck`; CI `checks` and `docker` jobs |
| Subscribe to Binance streams for BTC, ETH, SOL, DOGE, XRP (USDT) | `BinanceConnector` (`src/binance.ts`): one combined stream with `depth20@100ms`, `aggTrade` and `ticker` per pair; backoff with full jitter and an idle watchdog | `binance.test.ts` (stream names, parsing, invalid frames, reconnect and backoff reset) |
| Continuously ingest order book updates | `depth20@100ms` partial snapshots into `OrderBookManager` (`src/orderbook.ts`); spread, spread % and buy/sell pressure derived per update | `orderbook.test.ts` |
| Buffer and/or batch incoming updates | Versioned last-value caches (`OrderBookManager`, `MetadataService`); `ChannelHub` batches each client's changed items into one frame per tick | `hub.test.ts` (one frame per tick, only unseen versions, shared encoding) |
| Emit at a configurable interval, default 100 ms | `FLUSH_INTERVAL_MS` (default 100, max 10000); per-client slower cadence via `setCadence` | `config.test.ts`; `hub.test.ts` (cadence rounding and clamping); `stream.integration.test.ts`; load test: ~10 frames/s per client |
| Prevent slow consumers from causing unbounded memory growth | Soft limit 64 KiB (skip the frame), hard limit 1 MiB or 5 s lag (close 1013); inbound payload cap, rate limit, connection cap, heartbeat | `hub.test.ts` (skip, catch-up with latest state, 1013 closes, limits); load test: every slow reader closed, zero healthy clients lost at 1k/5k/10k clients |
| Explain the buffering strategy in the README | [README: Buffering, conflation & backpressure](../README.md#5-buffering-conflation--backpressure); [protocol.md: Flow control](protocol.md#flow-control-and-slow-consumers) | Review |
| WebSocket server broadcasting processed updates, each identifying its pair | `/ws` (`src/ws/stream.routes.ts`); `tickers[].pair` and `book.pair` in every data message | `protocol.test.ts` (shared schemas); `stream.integration.test.ts` |
| Payload format | Protocol v1 in `shared/src/protocol.ts`, documented in [protocol.md](protocol.md). The brief's single example payload is split into a `tickers` message (price, 24h change/high/low/volume) and a `book` message (bids, asks, spread, spread %, buy/sell pressure), so a client receives books only for pairs it watches | `protocol.test.ts`; `stream.integration.test.ts` |
| `GET /pairs/meta`: display name, trading status, 24h high, low and volume | `src/http/meta.routes.ts`: Binance data from REST bootstrap (`exchangeInfo`, `ticker/24hr`) kept current by the stream; response schema, ETag; 503 + `Retry-After` until loaded | `routes.test.ts`; `bootstrap.test.ts`; `schemas.test.ts` |

## Mobile

| Requirement | Implementation | Verification |
|---|---|---|
| React Native (Expo); runs on the Android emulator (required), iOS optional | Expo SDK 57, React Native 0.86.3; debug and release builds on both platforms, Expo Go as fallback | Maestro flows on the Android emulator (release APK) and iOS simulator; CI `android-e2e` (manual) |
| Watchlist shows all supported pairs | `WatchlistScreen` (FlashList) | `filter.test.ts` (all pairs, search, favourites filter); `watchlist.test.tsx` (row); Maestro `watchlist` |
| Row: trading pair, current price, 24h change | `MarketPairCard`: live `tickers` channel, REST value until the first tick; ▲/▼ with colour | `watchlist.test.tsx` |
| Row: live connection indicator | Per-row freshness badge (LIVE / DELAYED / CACHED / OFFLINE) from the gateway `status` and the device receive time | `watchlist.test.tsx` (stale pair marked DELAYED, others LIVE); `mobile/tests/freshness.test.ts` |
| Row: favourite toggle | Star with its own press target and accessibility label | `watchlist.test.tsx`; Maestro `watchlist` |
| Search / filter | `filterUtils.ts` (symbol, name, base asset) plus All / Favourites / Gainers / Losers tabs | `filter.test.ts`; Maestro `watchlist` |
| Favourites persist across restarts | `StorageRepository`: MMKV (SQLite key-value store in Expo Go) | `storage.test.ts`; `storageFallback.test.ts`; Maestro `watchlist` (cold relaunch) |
| Details: current price | `LastPriceHero` | `terminalScreen.test.tsx`; Maestro `terminal` |
| Details: buy pressure, sell pressure, spread | `PressureSpreadBar`: numeric pressure %, absolute spread and spread % | `terminal.test.tsx`; Maestro `terminal` |
| Details: live order book (bids and asks) | `OrderBookTable`: top 10 per side from the `book:<PAIR>` channel | `terminal.test.tsx` (top 10 per side, decimals, deeper levels dropped, in-place update) |
| Details: last updated timestamp | "Updated" time (newer of ticker and book) with a stale badge | `terminalScreen.test.tsx` |
| Continuous updates from the backend | `MarketStreamClient` → `MarketIngestor` → zustand store | `streamClient.test.ts`; `streamRuntime.test.ts`; `marketStore.test.tsx` |
| Smooth under sustained bursts | At most one store commit per animation frame; per-pair selectors; hidden tabs paused; `scaleX` bar animation on the UI thread | `marketStore.test.tsx` (render isolation); `screenActivity.test.tsx`; Android release at 20 frames/s (`FLUSH_INTERVAL_MS=50`): terminal 17/18/19 ms, watchlist 17/20/22 ms p50/p90/p99; iOS release memory flat at 113–130 MB |
| Price up → green flash; price down → red flash | `PriceFlash` on the terminal price and on watchlist rows; no flash when a live value first replaces a cached or REST one | `priceFlash.test.tsx`; `watchlist.test.tsx`; `terminalScreen.test.tsx` |
| Order book volume changes animate smoothly | `OrderBookRow`: Reanimated `withTiming` on `transform: scaleX` | Android frame stats above |
| Offline: show connection status | Header status pill (socket and upstream), offline / reconnecting banner with countdown | `connectionStatus.test.ts`; `terminal.test.tsx` (banner); Maestro `offline` |
| Offline: keep showing the last data | The store keeps its values; a snapshot saved every 5 s restores "last seen" data at cold start | `persistence.test.ts`; Maestro `offline` (prices kept) |
| Offline: reconnect automatically | Full-jitter backoff 1 s → 30 s, NetInfo, AppState, idle watchdog, resubscribe on reconnect | `streamClient.test.ts`; Maestro `offline`; `docker compose stop` / `start` by hand |
| Pull-to-refresh reloads `/pairs/meta` without interrupting the WebSocket | `RefreshControl` → TanStack Query `refetch()`; the stream client doesn't depend on the query client | No automated test of the gesture; `marketApi.test.ts` covers the fetch and retry policy |

## Non-functional

| Requirement | Implementation | Verification |
|---|---|---|
| Clean architecture, separation of concerns | Gateway: connector / caches / hub / routes. App: stream client / ingestor / store / screens; composition roots in `server.ts` and `StreamRuntime` | Review; each layer tested on its own |
| Maintainable code | Shared zod contract, strict TypeScript, ESLint with React Hooks rules | `npm run typecheck && npm run lint`; CI |
| Responsive UI under continuous updates | See "Smooth under sustained bursts" | [performance.md](performance.md#on-device-release-builds) |
| Efficient state management | External store, frame-batched commits, per-pair selectors | `marketStore.test.tsx` |
| Robust connection handling | Both sides: backoff with jitter, watchdogs, timeouts; gateway limits and 1013 for slow consumers | `binance.test.ts`; `hub.test.ts`; `streamClient.test.ts`; load test |
| Appropriate error handling | Schema validation at the boundaries; per-screen error boundaries; 503 + `Retry-After` while warming up | `errorBoundary.test.tsx`; `errorBoundaryRouter.test.tsx`; `routes.test.ts`; `marketApi.test.ts` |

## Deliverables

| Deliverable | Where |
|---|---|
| Source code in Git | This repository; one branch and PR per phase ([README: Git workflow](../README.md#12-git-workflow)) |
| README: setup and build/run instructions | [README: Quick start](../README.md#1-quick-start), [Run on devices](../README.md#2-run-on-devices), [Testing](../README.md#3-testing) |
| README: architectural decisions | [README: Key decisions](../README.md#6-key-decisions); ADRs in [design.md](design.md#4-decision-records) |
| README: buffering strategy | [README: Buffering, conflation & backpressure](../README.md#5-buffering-conflation--backpressure) |
| README: assumptions | [README: Assumptions](../README.md#7-assumptions) |
| README: trade-offs | [README: Trade-offs](../README.md#9-trade-offs) |
| README: AI usage | [README: AI-assisted development](../README.md#11-ai-assisted-development) |
| Screen recording | iOS and Android recordings attached to the [v1.0.0 release](https://github.com/nimeshkavinda/PulseCrypto/releases/tag/v1.0.0), linked from the README |
