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

You have two ways to run the mobile app:

#### Option A: Inside Expo Go (Zero compile time)
```bash
npm run dev:mobile
```
- Press **`a`** → opens on Android Emulator (`ws://10.0.2.2:8080/ws`)
- Press **`i`** → opens on iOS Simulator (`ws://localhost:8080/ws`)
- Scan QR code → opens on physical phone via Expo Go

#### Option B: Standalone Native App (Outside Expo Go)
Compiles a dedicated native binary (`com.pulsecrypto.mobile`) with local Xcode / Android Gradle tooling:
- **iOS Simulator (Native Build)**:
  ```bash
  npm run dev:mobile:ios
  ```
- **Android Emulator (Native Build)**:
  ```bash
  npm run dev:mobile:android
  ```

Gateway URLs are **automatically detected per platform** — zero configuration required for emulators and simulators.

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
| `npm run dev:mobile` | Start Expo mobile dev server (for Expo Go) |
| `npm run dev:mobile:ios` | Build & run standalone native iOS app on simulator |
| `npm run dev:mobile:android` | Build & run standalone native Android app on emulator |
| `npm test` | Run all test suites (shared, backend, mobile) |
| `npm run typecheck` | TypeScript type-check across all workspaces |
| `npm run lint` | ESLint across all workspaces |
