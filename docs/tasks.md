# PulseCrypto: Traceable Task Backlog

This backlog maps every development task to a unique Task ID (`T<phase>.<number>`) used in commit messages and PR tracking.

---

## Phase 1: Foundation, Spec Documents & Shared Contracts
- [x] **T1.1**: Initialize monorepo directory layout (`/backend`, `/shared`, `/mobile`), root `.gitignore`, root `package.json`, and Git remote configuration.
- [x] **T1.2**: Author spec-driven documentation (`docs/requirements.md`, `docs/design.md`, `docs/tasks.md`, `GIT_WORKFLOW.md`, later folded into the README) as the initial baseline commit on `main`.
- [x] **T1.3**: Build `/shared` workspace with strict Zod schemas and TypeScript types for `MarketUpdatePayload`, `PairMetadata`, and `ClientCommand`, including round-trip parse unit tests.
- [x] **T1.4**: Configure backend TypeScript, ESLint, and Vitest test runner.
- [x] **T1.5**: Author multi-stage `Dockerfile` and minimal `docker-compose.yml` for one-command reviewer execution (`docker compose up`).

---

## Phase 2: Backend Gateway & Stream Conflation Engine
- [x] **T2.1**: Implement Fastify HTTP server with `GET /pairs/meta`, `GET /health`, and lightweight Prometheus `/metrics`.
- [x] **T2.2**: Implement resilient Binance WebSocket client connector with multi-stream subscription (`depth20@100ms`, `!miniTicker@arr`), auto-reconnect with jitter, and heartbeat monitoring.
- [x] **T2.3**: Build in-memory Order Book manager and Derived Analytics engine (spread, buy/sell pressure, cumulative totals).
- [x] **T2.4**: Implement Conflation Engine with environment-configurable emission timer (`FLUSH_INTERVAL_MS`, default: 100ms).
- [x] **T2.5**: Implement 3-tier backpressure guard (`socket.bufferedAmount` inspection: normal, shed depth at 512KB, terminate at 2MB).
- [x] **T2.6**: Write comprehensive unit tests with Vitest for order book aggregation, conflator timing, and backpressure logic.

---

## Phase 3: Mobile Foundation, Design Tokens & Shell
- [x] **T3.1**: Initialize Expo React Native mobile project with TypeScript configured for native prebuild (`npx expo run:android`).
- [x] **T3.2**: Implement Design System token module (colors `#0B0E14`, `#00C57A`, `#FF3B69`, `#1E2633`, typography, spacing).
- [x] **T3.3**: Set up Expo Router file-based architecture (`mobile/app/`): Pro Trader Side Drawer (`(drawer)/_layout.tsx`) + 4 Bottom Tabs (`(tabs)/_layout.tsx` for Terminal, Markets, Telemetry, Settings), with custom Google Fonts (`@expo-google-fonts/hanken-grotesk`, `inter`, `jetbrains-mono`), safe area insets, and Reactotron mobile network inspection.
- [x] **T3.4**: Implement `StorageRepository` using `react-native-mmkv` for synchronous local persistence.

---

## Phase 4: Markets Watchlist, Search, Filter & Favourites
- [x] **T4.1**: Build Market Watchlist screen displaying all supported trading pairs (BTC, ETH, SOL, DOGE, XRP) using `@shopify/flash-list` for 60 FPS virtualization, with separated component styling (`*.styles.ts`).
- [x] **T4.2**: Implement search and filter bar for trading pairs.
- [x] **T4.3**: Implement Favourites toggle with MMKV persistence and automatic restoration on startup.
- [x] **T4.4**: Integrate TanStack Query (`@tanstack/react-query`) for `GET /pairs/meta` with pull-to-refresh (`refetch()` on `RefreshControl`) without interrupting active WebSocket streaming.

---

## Phase 5: Pro Terminal (Live Order Book & SVG Depth Chart)
- [x] **T5.1**: Build Last Price Header component with 24h change %, 24h high/low, and connection status pill.
- [x] **T5.2**: Build Live Order Book table (top 10 bids in green, top 10 asks in red) with animated volume depth bars.
- [x] **T5.3**: Implement UI-thread price flash micro-animations (green for tick up, red for tick down via Reanimated).
- [x] **T5.4**: Build Dual-Mountain Market Depth SVG area chart with Liquidity Gap badge and Buy/Sell Pressure label. _(The planned 250 ms redraw floor was not implemented; redraw cadence is handled by the store commit cadence in T11.2, and the chart is updated in T12.3.)_
- [x] **T5.5**: Gateway Connection & Navigation Integration:
  - Wire header `LIVE` status pill to active WebSocket connectivity state.
  - Consolidate gateway URL resolution into a single reactive URL utility module (`marketApi.resolveHttpBaseUrl` vs `storage.getHttpGatewayUrl`).
  - Subscribe `usePairsMetadata` to storage so Settings gateway edits trigger query invalidation without component remount.

---

## Phase 6: System Settings & Telemetry Dashboard (Mobile & Backend Observability)
- [x] **T6.1**: Implement Client-Side Data Throttling Configurator slider (10ms–1000ms) to tune client render/flush frequency.
- [x] **T6.2**: Implement live Telemetry Performance Dashboard:
  - Circular JS Thread Frame Rate gauge (real-time FPS measurement via SVG).
  - Ingestion rate counter (msgs/sec).
  - Memory Footprint Sparkline chart (SVG path).
  - Hardware Acceleration & Storage cards adapted to native platform concepts ("Hermes / JSI Engine: Active", "MMKV Cache: X KB utilized").
- [x] **T6.3**: Backend Logging & Production Telemetry Documentation:
  - Configure structured JSON logging via Fastify's built-in Pino logger (`fastify.log`) with request ID tracing and log redaction.
  - Document production fleet observability (Prometheus scraping existing `GET /metrics` + centralized Grafana/Datadog dashboards) in README / architecture reference without auxiliary Docker Compose bloat.

---

## Phase 7: Offline Resilience, Error Handling & Polish
- [x] **T7.1**: Implement resilient WebSocket client with exponential backoff reconnection, ping/pong health monitoring, and offline indicator.
- [x] **T7.2**: Implement stale data cache: maintain most recent market data on screen if backend connection drops.
- [x] **T7.3**: Manual smoke test on the Android Emulator under sustained 100 ms updates. _(Frame-rate measurement moved to T14.3.)_
- [x] **T7.4**: Mobile Lifecycle, Resiliency & Testing Hardening:
  - Wire per-row SYNCED / LIVE indicators to socket connection status. _(Per-row data freshness: T12.1.)_
  - Pause REST polling and the socket while the app is backgrounded (AppState). _(Focus-aware sampling for telemetry: T13.2.)_
  - Move dev-only tooling (`reactotron-react-native`) to `devDependencies`.
  - Add storage-level integration tests: favourites toggle + restore, and the pull-to-refresh refetch path through `QueryClient`. _(Component render tests: T11.4.)_

---

## Phase 8: Deliverables & Documentation
- [x] **T8.1**: Write comprehensive README covering:
  - Setup and build/run instructions (Local and Docker).
  - Architectural decisions & ADRs (In-memory LVC, SVG vs Skia, 3-tier backpressure, client-side throttling vs server FLUSH_INTERVAL_MS, depth chart safety floor).
  - Documented Assumptions (Pro Trader drawer as static chrome, native adaptations of web telemetry labels).
  - Git workflow (phase branches, task-ID commits, phase tags).
  - At-scale production discussion (Kubernetes HPA, Redis/NATS fan-out, multi-region).
  - AI-assisted development workflow breakdown.
- [x] **T8.2**: Record application demonstration video/screen recording. _(Done in T15.3.)_

---

## Phase 9: Stream Efficiency & Backpressure Improvements
_Improvements from end-to-end testing: cut per-client bandwidth, send only what changed, handle slow consumers without wasted writes._
- [x] **T9.1**: Define the versioned wire protocol in `shared/src/protocol.ts`, covering the frame envelope, the `hello`/`status`/`tickers`/`book`/`ack`/`pong`/`error` messages, and the client `subscribe`/`unsubscribe`/`setCadence`/`ping` messages. Document it in `docs/protocol.md`.
- [x] **T9.2**: `ChannelHub` + `ClientSession`. Clients opt in to channels (`tickers`, `book:<PAIR>`). Each changed item is serialized once per tick, and each client gets at most one batched frame per tick.
- [x] **T9.3**: Per-client last-value backpressure. Frames are skipped while the socket is congested, and a skipped client later receives the latest state. Sustained lag closes the socket with 1013.
- [x] **T9.4**: Keep schema validation at the inbound boundary only, out of the per-tick path.
- [x] **T9.5**: Fastify + `ws` integration test suite.

## Phase 10: Upstream Ingestion Fixes & Gateway Hardening
- [x] **T10.1**: Upstream stream set of `depth20@100ms` + `aggTrade` + `ticker`, with a configurable `BINANCE_WS_URL` and a clean connector shutdown.
- [x] **T10.2**: Bootstrap metadata from Binance REST (`ticker/24hr`, `exchangeInfo`) with retry. Send exchange event timestamps, upstream `status` and per-pair staleness to clients.
- [x] **T10.3**: Hardening: `maxPayload`, inbound rate limiting, a connection cap, an origin allowlist, a server heartbeat, `/metrics` on an internal port, and separate `/health` and `/ready` endpoints.
- [x] **T10.4**: `/pairs/meta` with a response schema, `Cache-Control`/ETag, and 503 + `Retry-After` until bootstrap completes.
- [x] **T10.5**: A minimal production Docker image and a composition root in `server.ts`.
- [x] **T10.6**: A load-test harness (`backend/scripts/loadtest.ts`) with published results.

## Phase 11: Mobile Connection Reliability & Render Performance
- [x] **T11.1**: `MarketStreamClient`, framework-agnostic: a connection state machine with full-jitter backoff, heartbeat, NetInfo/AppState integration and resubscribe on reconnect.
- [x] **T11.2**: An external market store with per-pair selectors and frame-batched commits.
- [x] **T11.3**: Gateway configuration precedence: app config, then env, then platform default. User overrides are persisted. Persistent storage works in dev builds (MMKV) and in Expo Go (SQLite kv-store fallback).
- [x] **T11.4**: A jest-expo + React Native Testing Library suite covering the state machine and render isolation.

## Phase 12: Live Watchlist & Terminal Improvements
- [x] **T12.1**: Watchlist rows bound to the `tickers` channel, with a per-row price flash and a freshness indicator. REST is used for static metadata and pull-to-refresh.
- [x] **T12.2**: The terminal subscribes to `book:<pair>` and shows buy/sell pressure, spread and %, and a last-updated time with a stale badge.
- [x] **T12.3**: Order book bars animate with `scaleX` transforms, and the depth chart plots price against cumulative quantity.
- [x] **T12.4**: Cold start and offline UX: cached data labelled "last seen", skeletons, and an offline banner.

## Phase 13: Settings Fixes, Native Telemetry & Hardening
- [x] **T13.1**: The cadence control drives server `setCadence` and shows the acknowledged value. The gateway editor is available in dev builds only.
- [x] **T13.2**: `perf-monitor` Expo Module (Swift + Kotlin) reporting native memory footprint and UI-thread FPS. Telemetry sampling runs only while the screen is focused.
- [x] **T13.3**: Dev tooling excluded from release bundles, error boundaries, and cleartext traffic allowed in debug builds only.

## Phase 14: CI, E2E & Performance Evidence
- [x] **T14.1**: GitHub Actions running typecheck, lint, tests, the Docker build and a load-test smoke run, plus the React Hooks lint rules.
- [x] **T14.2**: A Maestro E2E flow covering search, favourite, relaunch, terminal, offline and reconnect.
- [x] **T14.3**: Android frame-stats capture under a sustained burst, and the gateway load-test results.

## Fixes from Review & Testing
_Defects found in code review of Phases 9–14 and in device testing, fixed in one change. No protocol changes._
- [x] **TF.1**: Gateway: `null` and non-object upstream frames are counted as invalid, a throwing handler is contained, the upstream handshake has a timeout, and reconnect backoff resets on the first valid stream message (not on open). `/ready` logic is a tested helper. The lagging-clients gauge resets when the last client leaves. `FLUSH_INTERVAL_MS` is capped at 10 s and `spreadPct` keeps 8 decimals. CI uses a read-only token and the load-test gate also requires finite numbers and ≥ 95% of the non-slow clients connected.
- [x] **TF.2**: Stream client: a 10 s connect timeout, attempts reset on the first market data message (not on open or `hello`/`status`), per-element ticker validation with a dropped-message count, and pair switches coalesced into a single channel update. Snapshots store live entries only, and a final commit runs before the save on stop. Freshness uses the device's receive time. `/pairs/meta` warm-up (503) is retried for as long as it lasts.
- [x] **TF.3**: UI: the Settings storage card shows favourites, active pair, cadence and cached prices (exact bytes) and follows changes made elsewhere. Clear Cached Prices clears memory and storage, Reset Preferences switches the running app to BTC, and the buttons are aligned. The cadence slider no longer steals vertical scrolls and supports screen-reader increment/decrement. The terminal uses `/pairs/meta` decimals, the spread % shows two significant figures, the price no longer flashes when the first live tick replaces a REST/cached value, and the banner and status texts were corrected. Tab screens have error boundaries, telemetry sampling resets per visit and survives native errors, and the Android frame counter no longer counts the window's start frame.

## Phase 15: Documentation Updates & Deliverables
- [x] **T15.1**: Update the README to match the final implementation: architecture, protocol, buffering strategy, ADRs, scaling analysis, assumptions, trade-offs and AI workflow. The run instructions cover the dev build (primary) and Expo Go (secondary fallback: SQLite-backed storage, no MMKV), plus `EXPO_PUBLIC_GATEWAY_URL` for physical devices.
- [x] **T15.2**: Repository default branch and a fresh-clone verification.
- [x] **T15.3**: Screen recording (T8.2): iOS simulator and Android emulator, attached to the v1.0.0 release.
- [x] **T15.4**: `docs/design.md` (architecture, data flow, ADRs with the alternatives rejected, scaling design) and `docs/requirements.md` (brief requirement → implementation → verification). The Git workflow moves into the README.
