# PulseCrypto ⚡

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-v5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MMKV](https://img.shields.io/badge/MMKV-JSI%2FNitro-FF6F00)](https://github.com/mrousavy/react-native-mmkv)
[![Tests](https://img.shields.io/badge/Tests-120%20Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![UI Performance](https://img.shields.io/badge/FPS-60%20Sustained-00C57A)](#performance-benchmarks)

**PulseCrypto** is a high-frequency, real-time cryptocurrency market streaming system. It continuously ingests public WebSocket depth and ticker data from Binance, batches and conflates updates in an in-memory Last-Value-Cache (LVC) with a proactive 3-tier backpressure guard, and broadcasts normalized market streams to an ultra-responsive React Native mobile terminal operating at a sustained 60 FPS.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Stream Processing, Buffering & Backpressure Strategy](#stream-processing-buffering--backpressure-strategy)
3. [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
4. [Documented Assumptions](#documented-assumptions)
5. [Production Scaling Architecture (1,000,000+ Concurrent Users)](#production-scaling-architecture-1000000-concurrent-users)
6. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
7. [Build & Run Instructions](#build--run-instructions)
8. [Verification, Testing & Observability](#verification-testing--observability)
9. [Git Workflow & Audit Trail](#git-workflow--audit-trail)
10. [AI-Assisted Development Workflow](#ai-assisted-development-workflow)

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BINANCE PUBLIC WEBSOCKET                        │
│         wss://stream.binance.com:9443/stream?streams=...               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Raw Ticks (depth20@100ms, !miniTicker@arr)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    NODE.JS GATEWAY (Fastify + ws)                      │
│                                                                        │
│  ┌─────────────────────────┐        ┌───────────────────────────────┐  │
│  │ BinanceConnector        │───────>│ In-Memory LVC State           │  │
│  │ • Reconnect with Jitter │        │ • Sub-microsecond updates     │  │
│  │ • Heartbeat & Ping/Pong │        │ • Derived analytics (spread,  │  │
│  └─────────────────────────┘        │   pressures, cumulative depth)│  │
│                                     └───────────────┬───────────────┘  │
│                                                     │ FLUSH_INTERVAL_MS│
│                                                     │ (Default: 100ms) │
│                                                     ▼                  │
│  ┌─────────────────────────┐        ┌───────────────────────────────┐  │
│  │ REST Endpoints          │        │ 3-Tier Backpressure Guard     │  │
│  │ • GET /pairs/meta       │        │ • Healthy (<512KB): Full Book │  │
│  │ • GET /health           │        │ • Degraded (>=512KB): Shedding│  │
│  │ • GET /metrics (Prom)   │        │ • Critical (>=2MB): Disconnect│  │
│  └─────────────────────────┘        └───────────────┬───────────────┘  │
└─────────────────────────────────────────────────────┼──────────────────┘
                                                      │ Normalized JSON
                                                      │ WebSocket Stream
                                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MOBILE CLIENT (React Native / Expo)                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Data & Infrastructure Layer                                      │  │
│  │ • Resilient WebSocket Client (Heartbeat watchdog, backoff)       │  │
│  │ • MMKV Synchronous Cache (Cold-start hydration, favorites)       │  │
│  │ • TanStack Query v5 (Focus-aware REST polling, pull-to-refresh)  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ State & Conflation Layer                                         │  │
│  │ • In-Memory Client LVC (Decoupled high-cadence tick ingestion)   │  │
│  │ • Throttled Render Flush Pass (Math.max(sliderMs, 250ms))        │  │
│  │ • Split Contexts: useMarketData (flush) vs useMarketConnection   │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Presentation Layer (60 FPS Native Rendering)                     │  │
│  │ • Watchlist Screen (FlashList view recycling, LIVE/SYNCED badge) │  │
│  │ • Pro Terminal (Order book depth bars, dual-mountain SVG chart)  │  │
│  │ • Telemetry Dashboard (JS thread FPS gauge, true RTT ping, MMKV) │  │
│  │ • Settings Configurator (Interactive conflation slider & toggles)│  │
│  │ • Pro Trader Drawer (Static layout chrome per Mockup 3)          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Stream Processing, Buffering & Backpressure Strategy

### 1. The Conflation Problem
Cryptocurrency market data is notoriously bursty. A single trading pair can emit 50–200 depth deltas and price ticks per second during volatile market moves. Multiplying this across 5 pairs yields **250–1,000 updates/second**.
Broadcasting every raw tick directly to a mobile device causes:
1. **Network Buffer Saturation**: Cellular TCP buffers bloat, introducing severe head-of-line latency.
2. **React Native Thread Choke**: The JavaScript event loop saturates deserializing JSON, starving `requestAnimationFrame` and dropping UI frame rates from 60 FPS down to <15 FPS.
3. **Severe Device Heating**: CPU and battery usage spike rapidly.

### 2. In-Memory Last-Value-Cache (LVC) Engine
PulseCrypto solves this on the backend via a dedicated **Conflation Engine** (`backend/src/conflator.ts`):
- Raw Binance depth events (`depth20@100ms`) and mini-ticker events (`!miniTicker@arr`) are immediately merged into an in-memory hash map (`PairState`).
- Merging is $O(1)$ and happens in sub-microsecond V8 time without blocking the event loop.
- The engine computes derived market metrics once per pair:
  - **Spread**: $\text{bestAsk} - \text{bestBid}$
  - **Spread Percentage**: $\frac{\text{spread}}{\text{bestBid}} \times 100$
  - **Buy / Sell Pressure**: Ratio of cumulative volume across the top 10 order book levels:
    $$\text{Buy Pressure} = \left(\frac{\sum \text{bidVol}}{\sum \text{bidVol} + \sum \text{askVol}}\right) \times 100$$
    $$\text{Sell Pressure} = 100 - \text{Buy Pressure}$$
  - **Cumulative Volumes**: Running cumulative volume totals computed for instant depth rendering.

### 3. Server Conflation Interval
A dedicated timer ticks at `FLUSH_INTERVAL_MS` (default: **100ms** / 10 Hz). When the timer fires, the engine snapshots the current LVC state for each pair, serializes the unified JSON payload, and broadcasts it to all connected mobile subscribers. Any updates arriving between ticks overwrite previous values in the LVC, guaranteeing that clients always receive the freshest data while never exceeding 10 updates/second per pair.

### 4. 3-Tier Backpressure Guard
Slow or congested mobile clients can accumulate unsent TCP frames in the Node.js outbound buffer. If left unchecked, this causes unbounded heap growth and eventual Out-Of-Memory (OOM) crashes.

PulseCrypto enforces a **3-tier backpressure guard** based on `socket.bufferedAmount`:

| Tier | Buffer Size Threshold | Action Taken | Rationale |
|---|---|---|---|
| **Tier 1: Healthy** | `< 512 KB` | **Full Broadcast** | Normal operation. Client receives full order book depth (bids/asks), analytics, and ticker data. |
| **Tier 2: Degraded** | `>= 512 KB` and `< 2 MB` | **Frame Shedding** | Backpressure active. The engine sheds the heavy 20-level order book arrays and transmits **ticker-only headers**. This reduces payload size by ~85%, allowing the mobile TCP socket to drain without starving price visibility. |
| **Tier 3: Critical** | `>= 2 MB` | **Forced Termination** | Emergency circuit breaker. Socket is closed immediately with WebSocket close code `1008 (Policy Violation: Slow Consumer)`. Protects the server process from memory exhaustion. |

```ts
// backend/src/server.ts: Outbound flow control
const buffered = client.bufferedAmount;
if (buffered >= 2 * 1024 * 1024) {
  // Tier 3: Critical
  client.close(1008, 'Slow Consumer: Buffer exceeded 2MB limit');
} else if (buffered >= 512 * 1024) {
  // Tier 2: Degraded (Frame Shedding)
  const shedPayload = { ...payload, bids: [], asks: [] };
  client.send(JSON.stringify(shedPayload));
} else {
  // Tier 1: Healthy
  client.send(serializedPayload);
}
```

### 5. Client-Side Dual Cadence & Display Throttling
In addition to the server's 100ms conflation rate, the mobile client implements an independent **Display-Side LVC** in `MarketStreamContext.tsx`:
- Incoming WebSocket messages update an in-memory ref (`lvcRef`) synchronously.
- A throttled render pass flushes snapshots from `lvcRef` into React state based on the user-configured throttle slider (`10ms` to `1000ms`), with a safe floor:
  $$\text{renderInterval} = \max(\text{sliderMs}, 250\text{ms})$$
- This dual cadence decouples network message receipt from screen redraws, ensuring that even under extreme 10ms burst testing, the UI thread maintains a silky 60 FPS without dropping frames or triggering thermal warnings.

---

## Architecture Decision Records (ADRs)

### ADR 1: In-Memory Last-Value-Cache (LVC) vs. External Message Broker
- **Context**: Binance streams emit 250–1,000 updates/sec across 5 pairs. We considered introducing an intermediate Redis pub/sub broker or Kafka topic.
- **Decision**: Maintain the LVC in the Node.js V8 process memory using native JavaScript `Map` structures.
- **Rationale**:
  - In-memory updates execute in nanoseconds with zero network I/O or inter-process serialization overhead.
  - Avoids 1–2ms of TCP roundtrip latency introduced by Redis.
  - Ephemeral market updates do not require disk persistence; Kafka disk logging would add 5–20ms of write latency for data that is superseded within 100ms.

### ADR 2: Fastify v5 & `ws` over Express & Socket.IO
- **Context**: The gateway must distribute high-throughput WebSocket streams while serving HTTP `/pairs/meta` metadata.
- **Decision**: Use Fastify v5 with schema-compiled JSON serialization and the lightweight `ws` WebSocket library.
- **Rationale**:
  - Fastify delivers ~80,000 req/s, outperforming Express's ~20,000 req/s ceiling.
  - `ws` has zero third-party dependencies and provides direct access to `socket.bufferedAmount` for backpressure monitoring.
  - Eliminates Socket.IO's heavy frame encapsulation and custom polling handshakes, preserving raw financial WebSocket efficiency.

### ADR 3: 3-Tier Backpressure Flow Control
- **Context**: Unreliable mobile networks (e.g. 3G/subway tunnels) can cause mobile TCP receive windows to stall, leading to outbound queue accumulation on the server.
- **Decision**: Implement a 3-tier backpressure guard with automatic frame shedding at 512KB and connection termination at 2MB.
- **Rationale**:
  - Drops less critical visual depth data while preserving essential pricing continuity.
  - Prevents slow consumers from degrading performance for healthy connected clients.

### ADR 4: Dual Cadence Architecture (Server `FLUSH_INTERVAL_MS` vs. Client Slider)
- **Context**: The assignment requirements mandate a configurable server flush interval (default 100ms), while Mockup 2 presents an in-app throttling slider (10ms–1000ms).
- **Decision**: Decouple the two controls into a dual-cadence model:
  - **Server-side**: `FLUSH_INTERVAL_MS` controls gateway batching and outbound broadcast frequency.
  - **Client-side**: In-app slider adjusts the mobile client's internal display flush cadence, while also sending an informative `{ action: 'setThrottle', intervalMs }` message to the gateway.
- **Rationale**: Fully honors the backend configuration requirements while allowing client-side customization without cross-client state collisions.

### ADR 5: React Native SVG with Decoupled Redraw Cadence (over Skia)
- **Context**: Rendering the dual-mountain Market Depth chart at high frequencies.
- **Decision**: Use `react-native-svg` with a safety-floored redraw cadence: `chartRedrawInterval = Math.max(sliderValue, 250ms)`.
- **Rationale**:
  - The depth chart consists of 20–40 path coordinates, which SVG natively renders in `<0.2ms`.
  - Avoids `@shopify/react-native-skia`'s 20MB native binary overhead.
  - Floored redraw cadence ensures the depth chart never competes with the order book table for JS thread compute time.

### ADR 6: Native Prebuild for MMKV Storage (Latest Mobile Stack)
- **Context**: High-frequency persistence for user favorites, throttle settings, and offline market snapshot caching.
- **Decision**: Standardize on **Expo SDK 57**, **React Native 0.86.3**, **React 19.2.3**, and `react-native-mmkv` with continuous native generation (`expo prebuild`).
- **Rationale**:
  - MMKV utilizes direct C++ JSI / Nitro bindings, executing reads/writes ~30x faster than legacy `AsyncStorage`.
  - Synchronous cache reads prevent layout flicker and blank states during app cold boot.
  - Native prebuild enables true native compilation while preserving Expo CLI convenience.

### ADR 7: Expo Router & FlashList for High-Performance Mobile UI
- **Context**: Smooth 60 FPS list scrolling and robust file-based navigation.
- **Decision**: Adopt **Expo Router** file-based navigation (`app/`) paired with `@shopify/flash-list`.
- **Rationale**:
  - File-based routing declaratively separates `(drawer)` chrome and `(tabs)` navigation.
  - `FlashList` recycles native platform views rather than unmounting/re-mounting DOM nodes, eliminating frame drops during frequent price updates.
  - Consistent typography using `@expo-google-fonts` (`HankenGrotesk`, `Inter`, `JetBrainsMono`).

### ADR 8: Display-Side LVC Conflation & Native Dev-Build Benchmarking
- **Context**: Ingesting 50+ ticks/second on the client can trigger excessive React component renders.
- **Decision**:
  - Buffer incoming messages in an internal ref (`lvcRef`) and flush snapshots to React state at a controlled cadence.
  - Split context into `useMarketData` (high-frequency payload consumer) and `useMarketConnection` (low-frequency 1Hz telemetry consumer).
  - Benchmark performance on **native development builds** (`npx expo run:ios` / `npx expo run:android`) rather than interpreted Expo Go to ensure realistic Hermes JSI execution.

---

## Documented Assumptions

1. **Pro Trader Drawer as Static UI Chrome**:  
   Per Mockup 3, the left drawer presents a Pro Trader profile ("Tier 3 Verified", "API Key Management", "Security Settings", "Trade History", "Support"). In accordance with the project scope, this is implemented as an aesthetic, accessible, static layout chrome without a live user authentication or KYC backend.

2. **Native Mobile Adaptations of Web Telemetry Labels**:  
   Mockup 2 displays web-centric telemetry concepts ("Hardware Acceleration", "Cache cards"). These were faithfully adapted to true native mobile counterparts:
   - *"Hardware Acceleration: Active"* → **Hermes JSI Engine** status indicator (actively querying `HermesInternal != null` with honest `Unavailable` fallback).
   - *"Cache Diagnostics"* → **MMKV Native Cache** stats (live key count, stored byte footprint, and measured/native status).
   - *"System Latency"* → **True RTT Ping/Pong** latency (measured via WebSocket ping intervals, avoiding misleading server-timestamp deltas).
   - *"Memory Footprint"* → Honest memory measurement via `HermesInternal.getAllocatedBytes()` with clear `SIMULATED` badging when runtime memory hooks are unavailable.

---

## Production Scaling Architecture (1,000,000+ Concurrent Users)

To scale PulseCrypto to 1,000,000+ concurrently connected mobile clients across global regions, the architecture cleanly decomposes into three distributed tiers:

```
                                   ┌──────────────────────┐
                                   │   Binance Upstream   │
                                   └──────────┬───────────┘
                                              │
                                   ┌──────────▼───────────┐
                                   │  Ingestion Cluster   │ (Active-Passive / Raft)
                                   └──────────┬───────────┘
                                              │ Internal Ticks
                                   ┌──────────▼───────────┐
                                   │   NATS JetStream     │ (High-Throughput Pub/Sub)
                                   └────┬───────────┬─────┘
                     ┌──────────────────┘           └──────────────────┐
                     │                                                 │
        ┌────────────▼─────────────┐                      ┌────────────▼─────────────┐
        │  US-East Gateway Fleet   │                      │  EU-Central Gateway Fleet │
        │  (Fastify + ws, HPA)     │                      │  (Fastify + ws, HPA)     │
        └────────────┬─────────────┘                      └────────────┬─────────────┘
                     │                                                 │
         ┌───────────▼───────────┐                         ┌───────────▼───────────┐
         │ 500,000 Mobile Clients│                         │ 500,000 Mobile Clients│
         └───────────────────────┘                         └───────────────────────┘
```

1. **Ingestion Tier (Singleton Leader with Raft Consensus)**:
   - A dedicated ingestion cluster connects to Binance's WebSocket streams.
   - Using Raft leader election (or Kubernetes LeaderElection), exactly one pod maintains the active upstream connection to prevent duplicate rate-limit consumption.
   - An active-passive failover pod hot-standby immediately resumes the connection in `<200ms` if the leader fails.

2. **Multicast Fan-Out Backbone (NATS JetStream)**:
   - Ingested ticks are published to a high-performance **NATS JetStream** or **Redis 7 Cluster** subject (`market.ticks.>`).
   - NATS processes >10,000,000 msgs/sec in memory with sub-millisecond latencies, distributing updates to hundreds of gateway pods.

3. **Stateless Edge Gateway Fleet (Kubernetes HPA + KEDA)**:
   - 50–100 Fastify + `ws` gateway pods deployed across regional Kubernetes clusters.
   - Autoscaled dynamically via **KEDA** monitoring `pulsecrypto_ws_active_clients` (target: 10,000 connections/pod).
   - Behind AWS ALB or Envoy Gateway with Layer 4 TCP proxying and TLS termination.

4. **Graceful Connection Draining**:
   - Kubernetes `preStop` lifecycle hooks intercept SIGTERM and gracefully drain client connections over a 60-second window:
     - New incoming handshakes are rejected (HTTP 503).
     - Existing clients receive a WebSocket close with a randomized reconnect delay, eliminating "Thundering Herd" reconnection storms.

5. **Multi-Region Anycast Routing**:
   - Anycast DNS (or Cloudflare Spectrum) routes mobile clients to the geographically closest edge cluster (US-East, EU-Central, AP-Southeast), maintaining `<30ms` latency worldwide.

---

## Prerequisites & Environment Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: (For containerized backend execution)
- **Xcode & CocoaPods**: (For iOS Simulator development — macOS only)
- **Android Studio & SDK**: (For Android Emulator development)

### Environment Configuration
The backend is configured via environment variables (or `.env` in the repository root):

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `8080` | Port for Fastify HTTP and WebSocket server |
| `HOST` | `0.0.0.0` | Host bind address |
| `FLUSH_INTERVAL_MS` | `100` | Conflation flush interval (batch frequency) in milliseconds |
| `BINANCE_WS_URL` | `wss://stream.binance.com:9443` | Upstream Binance WebSocket base URL |
| `EXPO_PUBLIC_GATEWAY_URL` | `ws://localhost:8080/ws` | Gateway WebSocket URL consumed by the mobile client |

---

## Build & Run Instructions

### 1. Install Monorepo Dependencies
From the repository root:
```bash
npm install
```

---

### 2. Run Backend Gateway

#### Option A: Via Docker Compose (Recommended)
Builds and starts the Fastify service in a lightweight Alpine container on port `8080`:
```bash
npm run dev:backend
# or directly:
docker compose up --build
```

#### Option B: Local Node.js Development
Runs the backend with hot-reloading via TypeScript tsx:
```bash
npm --prefix backend run dev
```

---

### 3. Run Mobile Application

#### Option A: Local Native Builds (Recommended for 60 FPS & MMKV JSI)
Compiles a standalone development build on your running emulator or simulator:

```bash
# Run on iOS Simulator (macOS required)
npm run dev:mobile:ios

# Run on Android Emulator
npm run dev:mobile:android
```

#### Option B: Expo Go
Starts the Expo Metro bundler for rapid development:
```bash
npm run dev:mobile
```
- Press `i` to launch in the iOS Simulator.
- Press `a` to launch in the Android Emulator.
- **Physical Device over LAN**:
  1. Find your machine's LAN IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).
  2. Start with gateway override:
     ```bash
     EXPO_PUBLIC_GATEWAY_URL=ws://<YOUR_LAN_IP>:8080/ws npm run dev:mobile
     ```
  3. Scan the terminal QR code using the Expo Go camera app.

#### Continuous Native Generation (Prebuild)
To generate or re-sync the underlying `/android` and `/ios` project directories:
```bash
npm --prefix mobile run prebuild
```

---

## Verification, Testing & Observability

### 1. Automated Test Suites
PulseCrypto maintains a comprehensive test suite across all packages:

```bash
# Run full monorepo test suite (120 tests)
npm test

# Run tests per workspace
npm --prefix shared test     # 16 tests: Zod schemas & contract validation
npm --prefix backend test    # 23 tests: Binance ingestion, LVC conflation, backpressure
npm --prefix mobile test     # 81 tests: Hooks, components, storage, integration
```

### 2. Type Checking & Code Quality
```bash
# Type-check all packages
npm run typecheck

# Lint all packages
npm run lint
```

### 3. Gateway Health & Observability Endpoints
With the backend running on `localhost:8080`:

```bash
# Health check & uptime
curl -s http://localhost:8080/health | jq .

# Live market pairs metadata (prices & 24h stats from Binance)
curl -s http://localhost:8080/pairs/meta | jq .

# Prometheus metrics (scrape ingestion rates, conflation latency, client counts)
curl -s http://localhost:8080/metrics
```

### 4. Key Prometheus Metrics Exposed
- `pulsecrypto_binance_messages_total`: Total raw messages ingested from Binance streams.
- `pulsecrypto_conflation_ticks_total`: Total conflation cycles executed.
- `pulsecrypto_conflation_duration_ms`: Execution duration of conflation batch cycles.
- `pulsecrypto_ws_active_clients`: Current number of connected mobile WebSocket clients.
- `pulsecrypto_ws_broadcast_messages_total`: Total normalized messages broadcast to clients.
- `pulsecrypto_backpressure_shed_total`: Count of Tier 2 backpressure frame shedding events.
- `pulsecrypto_backpressure_disconnect_total`: Count of Tier 3 forced client disconnects.

---

## Git Workflow & Audit Trail

PulseCrypto was engineered using a strict, auditable Git branching workflow. Every milestone followed a dedicated feature branch, task-ID prefixed commits, thorough pull request reviews, and annotated phase release tags:

| Phase | Branch | Pull Request | Merge Commit | Release Tag | Key Milestones Delivered |
|---|---|---|---|---|---|
| **Phase 1** | `phase/1-foundation` | [#1](https://github.com/nimeshkavinda/PulseCrypto/pull/1) | `6062f6b` | `phase-1-complete` | Monorepo scaffolding, Zod schemas, Fastify skeleton, BMAD framework |
| **Phase 2** | `phase/2-backend` | [#2](https://github.com/nimeshkavinda/PulseCrypto/pull/2) | `a65cfc7` | `phase-2-complete` | Binance connector, LVC engine, 3-tier backpressure, Prometheus metrics |
| **Phase 3** | `phase/3-mobile-shell` | [#3](https://github.com/nimeshkavinda/PulseCrypto/pull/3) | `9ec1f21` | `phase-3-complete` | Expo SDK 57 shell, design tokens, drawer navigation, Google Fonts |
| **Phase 4** | `phase/4-watchlist` | [#4](https://github.com/nimeshkavinda/PulseCrypto/pull/4) | `9719ba1` | `phase-4-complete` | FlashList watchlist, search/filter, MMKV favorites, micro-animations |
| **Phase 5** | `phase/5-terminal` | [#5](https://github.com/nimeshkavinda/PulseCrypto/pull/5) | `26b38fc` | `phase-5-complete` | Pro Terminal, live order book, dual-mountain SVG depth chart, thermal fix |
| **Phase 6** | `phase/6-settings-telemetry` | [#6](https://github.com/nimeshkavinda/PulseCrypto/pull/6) | `09f9137` | `phase-6-complete` | Telemetry dashboard, FPS gauge, memory sparkline, conflation slider |
| **Phase 7** | `phase/7-offline-resilience` | [#7](https://github.com/nimeshkavinda/PulseCrypto/pull/7) | `4f2e7b2` | `phase-7-complete` | Heartbeat watchdog, exponential backoff, MMKV cache, lifecycle guard |
| **Phase 8** | `phase/8-deliverables` | *In Review* | *Pending* | *Pending* | Comprehensive documentation, architecture guide, demo recording |

---

## AI-Assisted Development Workflow

PulseCrypto was built using the **BMAD (Breakthrough Method for Agile AI-Driven Development)** framework with **Antigravity (Gemini 3.8 Flash)** and **Muse Spark 1.3 (via OpenCode harness)** as the independent code reviewer across all phase pull requests.

### 1. Agent Roles & Collaboration Model
- **System Architect (`bmad-agent-architect`)**: Evaluated trade-offs, authored the initial Technical Design document (`docs/design.md`), and recorded formal Architecture Decision Records (ADRs 1–8).
- **Product & Requirements (`bmad-spec`)**: Distilled assignment mockups and constraints into functional requirements (`docs/requirements.md`) and actionable, phased tasks (`docs/tasks.md`).
- **Senior Developer (`bmad-agent-dev`)**: Authored clean, type-safe code adhering to strict engineering principles: zero runtime regressions, comprehensive unit test coverage, and strict dependency boundaries.
- **Independent Code Reviewer (Muse Spark 1.3 via OpenCode harness / `bmad-review`)**: Executed rigorous, adversarial code reviews on each pull request before merging into `main`, validating architecture decisions, catching edge cases, and enforcing honesty in performance metrics.

### 2. Key Review Insights & Real-World Lessons Learned
The multi-agent review process caught and eliminated critical performance and architectural pitfalls early:
- **Phase 5 Device Heating & Thermal Saturation**:  
  *Finding*: Unthrottled WebSocket message consumption was triggering up to 100 React state updates per second, causing device heating and dropped frames.  
  *Resolution*: Split state context into high-frequency and low-frequency observers, introduced the display-side LVC conflation pass, and applied a 250ms render floor to the SVG depth chart.
- **Phase 6 Telemetry Honesty**:  
  *Finding*: Review flagged that calculating latency from server timestamp deltas conflated network transmission with batch conflation delay, and storage metrics showed simulated values without clear disclosure.  
  *Resolution*: Upgraded latency to true WebSocket round-trip time (RTT) ping/pong every 5s; hooked memory directly to `HermesInternal.getAllocatedBytes()` with explicit `SIMULATED` badges when native hooks are unavailable.
- **Phase 7 React `setState-in-render` Prevention**:  
  *Finding*: Storage cache persistence called inside a functional state updater triggered cross-component render conflicts (`Cannot update TelemetryScreen while rendering MarketStreamProvider`).  
  *Resolution*: Purified the state updater, decoupled MMKV persistence into a time-based 5-second interval, and deferred storage change dispatches via `queueMicrotask`.

---

## License

MIT © [Nimesh Kavinda](https://github.com/nimeshkavinda)
