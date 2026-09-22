# PulseCrypto 🚀

Real-time cryptocurrency market streaming platform. A Fastify WebSocket gateway ingests live Binance order book and ticker data, conflates it at 100ms cadence with 3-tier backpressure, and streams it to an Expo SDK 57 / React Native 0.86 mobile terminal with Pro Trader dark UI.

---

## Monorepo Structure

```
├── shared/     # Zod schemas & TypeScript types (MarketUpdatePayload, PairMetadata, ClientCommand)
├── backend/    # Fastify 5 WebSocket gateway, order book manager, conflation engine, Prometheus metrics
├── mobile/     # Expo SDK 57 + React Native 0.86 (New Architecture), Pro Trader dark theme, MMKV storage
├── docker-compose.yml
└── backend/Dockerfile   # Multi-stage Node 22 Alpine build
```

---

## Prerequisites

- **Docker** (Docker Desktop running)
- **Node.js** (for running the Expo mobile server)
- **Android Studio** (Android emulator) and/or **Xcode** (iOS simulator)

> [!TIP]
> **macOS iOS Simulator Setup**: If `xcrun simctl` complains that developer tools are missing, point `xcode-select` to your installed Xcode:
> ```bash
> sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
> ```

---

## Quick Start (Reviewer Flow)

Run everything from the **repository root** — no `cd` needed.

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend (Terminal 1)

```bash
npm run dev:backend
```

This builds and runs the Fastify backend inside Docker on port `8080`, connected to live Binance order books and ticker feeds.

### 3. Start the Mobile Terminal (Terminal 2)

```bash
npm run dev:mobile
```

Once the interactive Expo terminal appears:

| Target | Key / Action | Gateway URL (auto-detected) |
|---|---|---|
| **Android Emulator** | Press **`a`** | `ws://10.0.2.2:8080/ws` |
| **iOS Simulator** | Press **`i`** | `ws://localhost:8080/ws` |
| **Physical Device** | Scan QR code with Expo Go | See below for LAN IP setup |

The gateway URL is **automatically detected per platform** — zero configuration required for emulators and simulators.

---

## Physical Device (Expo Go over Wi-Fi)

To stream to a physical device on your local Wi-Fi:

1. Find your machine's LAN IP: `ipconfig getifaddr en0`
2. Start the mobile server with the gateway override:
   ```bash
   EXPO_PUBLIC_GATEWAY_URL=ws://<your-lan-ip>:8080/ws npm run dev:mobile
   ```
3. Scan the terminal QR code with **Expo Go**.

---

## Verifying the Backend

Once `npm run dev:backend` is up, verify health and live ingestion from any terminal:

```bash
# Health check & uptime
curl -s http://localhost:8080/health | jq .

# Live market metadata (prices & 24h stats from Binance)
curl -s http://localhost:8080/pairs/meta | jq .

# Prometheus metrics
curl -s http://localhost:8080/metrics
```

---

## Repository Commands

All commands run from the monorepo root:

| Command | Description |
|---|---|
| `npm run dev:backend` | Build and start backend inside Docker (`:8080`) |
| `npm run dev:mobile` | Start Expo mobile Metro development server |
| `npm test` | Run all test suites (shared, backend, mobile) |
| `npm run typecheck` | TypeScript type-check across all workspaces |
| `npm run lint` | ESLint across all workspaces |
