# PulseCrypto: Technical Architecture & System Design

This document details the architectural design and Architecture Decision Records (ADRs) for PulseCrypto.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────┐
│               BINANCE PUBLIC WEBSOCKET                 │
│  wss://stream.binance.com:9443/stream?streams=...      │
└───────────────────────────┬────────────────────────────┘
                            │ Raw Ticks (depth20@100ms, miniTicker)
                            ▼
┌────────────────────────────────────────────────────────┐
│            NODE.JS GATEWAY (Fastify + ws)              │
│                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ BinanceWSClient      │───>│ In-Memory LVC State  │  │
│  │ • Reconnect + Jitter │    │ • Nanosecond updates │  │
│  │ • Heartbeat monitor  │    │ • Derived analytics  │  │
│  └──────────────────────┘    └──────────┬───────────┘  │
│                                         │ FLUSH_INTERVAL_MS
│                                         │ (Default: 100ms)
│                                         ▼              │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ REST: /pairs/meta    │    │ 3-Tier Backpressure  │  │
│  │ REST: /health        │    │ • Normal: Full book  │  │
│  │ REST: /metrics       │    │ • >512KB: Shed depth │  │
│  └──────────────────────┘    │ • >2MB: Disconnect   │  │
│                              └──────────┬───────────┘  │
└─────────────────────────────────────────┼──────────────┘
                                          │ 100ms JSON Stream
                                          ▼
┌────────────────────────────────────────────────────────┐
│             MOBILE APP (React Native / Expo)           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Data Layer: Resilient WS Client + MMKV Store     │  │
│  │ + TanStack Query (@tanstack/react-query)         │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ State Layer: Zustand Atomic Selectors            │  │
│  │ + Client Throttling: Math.max(sliderValue, 250)  │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Presentation: 60 FPS Reanimated & SVG Charts     │  │
│  │ • Watchlist & Search   • Pro Terminal & Depth    │  │
│  │   (TanStack refetch)     (Floored 250ms SVG)     │  │
│  │ • In-App Telemetry     • Pro Trader Drawer       │  │
│  │   (Native labels)        (Static chrome layout)  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Decision Records (ADRs)

### ADR 1: In-Memory Last-Value-Cache (LVC) vs. External Broker
* **Context**: Raw Binance market streams emit 50–200 ticks per second across multiple pairs.
* **Decision**: Maintain an in-memory hash table (`Map<string, PairState>`) inside the Node.js process to hold the latest order book and ticker state.
* **Rationale**:
  * In-memory updates take nanoseconds in the V8 heap with zero I/O overhead.
  * Avoids 1–2ms TCP latency and serialization overhead of querying an external Redis cache on every tick.
  * Ephemeral market updates do not require disk persistence; Kafka disk logging would add 5–20ms of write latency for data that is superseded within 100ms.

### ADR 2: Fastify v5 & `ws` over Express & Socket.IO
* **Context**: The gateway must handle high-throughput market tick distribution and HTTP metadata requests.
* **Decision**: Use Fastify v5 with schema-compiled JSON serialization and the lightweight `ws` WebSocket library.
* **Rationale**:
  * Fastify delivers ~80,000 req/s, compared to Express's ~20,000 req/s ceiling.
  * `ws` has zero dependencies and allows direct inspection of `socket.bufferedAmount` for flow-control backpressure.
  * Avoids Socket.IO protocol bloat (custom framing, engine.io handshakes) which is unsuited for raw financial ticker streaming.

### ADR 3: 3-Tier Backpressure Management
* **Context**: Slow or congested mobile networks cause outbound socket buffers to accumulate in server memory, risking Node.js out-of-memory (OOM) crashes.
* **Decision**: Implement a 3-tier backpressure guard based on `socket.bufferedAmount`:
  1. **Healthy (`< 512 KB`)**: Full market update (order book depth + derived analytics).
  2. **Degraded (`>= 512 KB`)**: **Frame Shedding** activates. Strips heavy order book arrays and transmits only top-level ticker prices, allowing the mobile buffer to drain.
  3. **Critical (`>= 2 MB`)**: Graceful termination with WebSocket code `1008 (Policy Violation: Slow Consumer)` to protect server memory.

### ADR 4: Dual Cadence Architecture (Server FLUSH_INTERVAL_MS vs. Client Slider)
* **Context**: The assignment requires a configurable interval on the backend (default 100ms), while Mockup 2 provides an in-app throttling slider (10ms–1000ms).
* **Decision**: Implement two independent, non-conflicting controls:
  * **Server-side**: Environment variable `FLUSH_INTERVAL_MS` (default `100ms`) controls how often the gateway batches and emits updates. This satisfies the literal brief without multi-client runtime conflicts.
  * **Client-side**: In-app slider controls how eagerly the mobile client flushes incoming frames to the React render tree. The client slider can throttle rendering down, but cannot outrun incoming server ticks.

### ADR 5: React Native SVG with Decoupled Redraw Cadence
* **Context**: Visualizing the dual-mountain Market Depth chart at high frequency.
* **Decision**: Use `react-native-svg` with a safety-floored redraw cadence: `chartRedrawInterval = Math.max(sliderValue, 250)`.
* **Rationale**:
  * The depth chart has only 20–40 coordinates. SVG renders this in <0.2ms native time.
  * Decoupling the depth chart redraw (minimum 250ms floor) ensures the heaviest visual component never competes with message parsing on the JS thread during burst updates.
  * Completely avoids `@shopify/react-native-skia`'s 20MB native binary bloat while matching 100% of Mockup 3's visual styling.

### ADR 6: Native Prebuild for MMKV Storage (Latest Mobile Stack)
* **Context**: Fast local persistence for favorites and offline caching.
* **Decision**: Standardize on the latest **Expo SDK 57** (`~57.0.24`), **React Native 0.86.3**, **React 19.2.3**, using `react-native-mmkv` with `npx expo run:android` / `npx expo run:ios` via `expo prebuild`.
* **Rationale**:
  * MMKV uses direct C++ JSI / Nitro bindings, operating ~30x faster than legacy AsyncStorage.
  * Synchronous reads eliminate layout shifts on app launch.
  * Stock Expo Go does not bundle custom native C++ JSI modules, so native prebuild is explicitly required.
  * Expo SDK 57 and React Native 0.86 bring modern TurboModule architecture and Hermes engine optimizations by default.

### ADR 7: Expo Router & FlashList for High-Performance Mobile Client
* **Context**: Scalable mobile navigation, modern React Native architecture, and high-cadence list rendering.
* **Decision**: Adopt **Expo Router** file-based navigation (`app/`) alongside `@shopify/flash-list`, Google Fonts (`@expo-google-fonts/hanken-grotesk`, `inter`, `jetbrains-mono`), and Reactotron JS-level network inspection.
* **Rationale**:
  * File-based routing organizes screens declaratively into groups (`(drawer)`, `(tabs)`) with automatic deep linking.
  * `@shopify/flash-list` recycles native platform views rather than destroying/recreating them, eliminating frame drops during frequent price updates.
  * Loading Google Fonts via `useFonts()` and referencing registered PostScript names ensures cross-platform visual consistency on both Android and iOS without font clipping.
  * In React Native New Architecture Bridgeless mode, standard Chrome DevTools network hooks may report multiple host conflicts; Reactotron intercepts network requests directly in JavaScript without relying on C++ CDT host hooks.

---

## 3. Production Scaling Architecture (At Scale Reference)

In a 1,000,000+ concurrent user production deployment:
1. **Ingestion Cluster**: A dedicated leader-elected singleton pod connects to Binance once.
2. **Multicast Fan-Out Backbone**: An in-memory pub/sub bus (NATS Core or Redis Cluster Pub/Sub) distributes ticks to edge gateway pods in <0.5ms.
3. **Stateless Gateway Fleet**: 50–100 Fastify + `ws` gateway pods behind an AWS ALB or Envoy Gateway, autoscaled dynamically via KEDA on `pulsecrypto_ws_active_clients` (target: 10,000 connections/pod).
4. **Graceful Draining**: Kubernetes `preStop` lifecycle hooks gradually disconnect sockets over a 60-second window during deployments to eliminate "Thundering Herd" reconnection storms.
