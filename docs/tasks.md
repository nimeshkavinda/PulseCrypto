# PulseCrypto: Traceable Task Backlog

This backlog maps every development task to a unique Task ID (`T<phase>.<number>`) used in commit messages and PR tracking.

---

## Phase 1: Foundation, Spec Documents & Shared Contracts
- [x] **T1.1**: Initialize monorepo directory layout (`/backend`, `/shared`, `/mobile`), root `.gitignore`, root `package.json`, and Git remote configuration.
- [x] **T1.2**: Author spec-driven documentation (`docs/requirements.md`, `docs/design.md`, `docs/tasks.md`, `GIT_WORKFLOW.md`) as the initial baseline commit on `main`.
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
- [x] **T5.4**: Build Dual-Mountain Market Depth SVG area chart with safety-floored redraw cadence (`Math.max(sliderValue, 250)`), Liquidity Gap badge, and Buy/Sell Pressure ratio.
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
- [ ] **T7.1**: Implement resilient WebSocket client with exponential backoff reconnection, ping/pong health monitoring, and offline indicator.
- [ ] **T7.2**: Implement stale data cache: maintain most recent market data on screen if backend connection drops.
- [ ] **T7.3**: Verify on Android Emulator and ensure smooth 60 FPS operation under sustained 100ms update bursts.
- [ ] **T7.4**: Mobile Lifecycle, Resiliency & Testing Hardening:
  - Wire per-row SYNCED / LIVE indicators to real streaming status.
  - Implement focus-aware polling (`useFocusEffect` / app background pause) to avoid redundant background network calls.
  - Move dev-only tooling (`reactotron-react-native`) to `devDependencies`.
  - Add hook and component integration tests: `useFavorites` toggle + restore, `FlashList` render, and pull-to-refresh refetch path with `QueryClientProvider` wrapper.

---

## Phase 8: Deliverables & Documentation
- [ ] **T8.1**: Write comprehensive README covering:
  - Setup and build/run instructions (Local and Docker).
  - Architectural decisions & ADRs (In-memory LVC, SVG vs Skia, 3-tier backpressure, client-side throttling vs server FLUSH_INTERVAL_MS, depth chart safety floor).
  - Documented Assumptions (Pro Trader drawer as static chrome, native adaptations of web telemetry labels).
  - Git workflow audit trail (phase branches, task-ID commits, phase tags).
  - At-scale production discussion (Kubernetes HPA, Redis/NATS fan-out, multi-region).
  - AI-assisted development workflow breakdown.
- [ ] **T8.2**: Record application demonstration video/screen recording.
