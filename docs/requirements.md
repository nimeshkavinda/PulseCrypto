# PulseCrypto: Functional & Non-Functional Requirements

## Overview
PulseCrypto is a real-time cryptocurrency market viewer consisting of:
1. A **Node.js backend** that ingests and processes live market data from Binance public streams.
2. A **React Native mobile application** that visualizes the processed data in real time at 60 FPS.

---

## Part 1: Backend Requirements

### 1. Live Market Streams
* Connect to Binance public WebSocket market streams (`wss://stream.binance.com:9443`).
* Ingest market data for at least 5 trading pairs:
  * `BTC/USDT`
  * `ETH/USDT`
  * `SOL/USDT`
  * `DOGE/USDT`
  * `XRP/USDT`

### 2. Stream Processing & Conflation
* Ingest order book updates and 24h rolling price ticker updates continuously.
* Buffer and batch incoming updates in memory using a Last-Value-Cache (LVC).
* Emit processed updates to connected mobile clients at a configurable interval:
  * Environment-configurable via `FLUSH_INTERVAL_MS` (default: `100ms`).
* Implement proactive backpressure management to prevent slow consumers from causing unbounded Node.js heap growth.
* Document the buffering and backpressure strategy in the README.

### 3. WebSocket Server
* Expose a local WebSocket server that broadcasts processed market updates.
* Identify the trading pair in each broadcast.
* Payload format:
  ```json
  {
    "pair": "BTCUSDT",
    "timestamp": 1720802025,
    "price": 64238.17,
    "change24h": 2.45,
    "high24h": 65120.00,
    "low24h": 62800.00,
    "volume24h": 28410.52,
    "spread": 0.41,
    "spreadPct": 0.0006,
    "buyPressure": 63.0,
    "sellPressure": 37.0,
    "bids": [[64239.50, 0.45220, 29045.12], ...],
    "asks": [[64241.50, 0.11200, 7195.05], ...]
  }
  ```

### 4. REST API Endpoint
* Expose `GET /pairs/meta` returning metadata for all supported trading pairs:
  * Display Name (e.g. "BTC / USDT")
  * Trading Status ("TRADING")
  * 24 Hour High
  * 24 Hour Low
  * 24 Hour Volume
  * Last Price & 24h Change %

---

## Part 2: Mobile Application Requirements

### 1. Market Watchlist
* Display all supported trading pairs in a list.
* Each row displays:
  * Trading Pair name
  * Current Price
  * 24 Hour Change % (with color coding)
  * Live Connection Indicator pill
  * Favourite toggle button

### 2. Search & Filter
* Real-time search bar allowing users to filter trading pairs by name or symbol.

### 3. Favourites
* Users can toggle pairs as favourites.
* Favourites persist locally across application restarts using synchronous key-value storage.

### 4. Market Details (Pro Terminal)
* Selecting a trading pair navigates to/displays the Terminal screen:
  * Current Price hero with 24h stats (High, Low, Volume)
  * Live Order Book (top 10 Bids in green, top 10 Asks in red) with cumulative volume depth bars
  * Derived metrics: Spread, Spread %, Buy Pressure %, Sell Pressure %
  * Dual-Mountain Market Depth area chart with Liquidity Gap badge
  * Last Updated Timestamp

### 5. Live Updates & 60 FPS Micro-Animations
* Real-time continuous updates without UI freezing.
* When price increases, background flashes briefly in green (`#00C57A`).
* When price decreases, background flashes briefly in red (`#FF3B69`).
* Order book horizontal depth volume bars animate width smoothly on the native UI thread.

### 6. Offline Behaviour & Resilience
* If backend connection drops:
  * Update top status indicator to "Offline" / "Reconnecting".
  * Continue showing the most recently received market data from local cache.
  * Automatically reconnect with exponential backoff and jitter when connectivity returns.

### 7. Pull to Refresh
* Pull-to-refresh on the Watchlist reloads metadata from `GET /pairs/meta` without interrupting or resetting the live WebSocket stream.

---

## Part 3: UI Mockup Specifications

### Design Tokens (Mockup 1)
* **Colors**:
  * Primary (App background): `#0B0E14`
  * Secondary (Bids / Positive / Live): `#00C57A`
  * Tertiary (Asks / Negative / Sell): `#FF3B69`
  * Neutral Surface (Cards / Modals): `#1E2633`
  * Neutral Border: `#2A3649`
* **Typography**:
  * Headlines: Hanken Grotesk / Bold
  * Body: Inter / Regular
  * Numbers & Terminal data: JetBrains Mono / Monospace

### Telemetry Dashboard & Controls (Mockup 2)
* Dynamic Data Throttling Configurator slider (10ms–1000ms).
* Live JS Thread Frame Rate circular gauge (60 FPS).
* WebSocket message ingestion rate counter (msgs/sec).
* Memory Footprint Sparkline chart (MB).
* Hardware Acceleration and Cache cards adapted to native concepts ("Hermes / JSI Engine: Active", "MMKV Cache: X KB utilized").

### Terminal & Drawer Navigation (Mockup 3)
* Left side drawer: Pro Trader profile, Tier 3 Verified, API Keys, Security, Trade History, Support, Sign Out (static UI layout chrome).
* Bottom Navigation Tabs: Terminal, Markets, Telemetry, Settings.

---

## Part 4: Non-Functional Requirements
* **Clean Architecture**: Strong separation of concerns between domain, application, and infrastructure layers.
* **Performance**: UI remains responsive at 60 FPS under continuous 100ms update bursts.
* **Type Safety**: End-to-end contracts validated with Zod in a shared monorepo package.
* **Maintainability & Testing**: High unit test coverage across stream parsing, conflation, and backpressure logic.
