# PulseCrypto

Real-time cryptocurrency market streaming system. A Fastify WebSocket gateway ingests live Binance depth and miniTicker streams, conflates market updates at a configurable 100ms interval with backpressure management, and broadcasts payloads to a React Native / Expo mobile client.

---

## Monorepo Structure

```
├── shared/              # Shared TypeScript types and Zod schemas
├── backend/             # Fastify WebSocket gateway, order book manager, conflation engine, Prometheus metrics
├── mobile/              # React Native 0.86 / Expo SDK 57 mobile client (New Architecture)
├── docker-compose.yml   # Containerized backend gateway
└── backend/Dockerfile   # Multi-stage Node Alpine build
```

---

## Prerequisites

- **Docker**
- **Node.js**
- **Android Studio** (Android SDK & emulator) and/or **Xcode** (iOS Simulator)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Backend Gateway (Terminal 1)

```bash
npm run dev:backend
```

Builds and starts the Fastify service in Docker on port `8080`, connected to upstream Binance feeds.

Verify gateway health:
```bash
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/pairs/meta | jq .
curl -s http://localhost:8080/metrics
```

### 3. Start Mobile Client (Terminal 2)

#### Via Expo Go

```bash
npm run dev:mobile
```

- Press `a` for Android Emulator
- Press `i` for iOS Simulator
- Scan QR code for physical device on the same LAN (`EXPO_PUBLIC_GATEWAY_URL=ws://<LAN_IP>:8080/ws npm run dev:mobile`)

#### Via Local Native Build

Compiles and installs a standalone debug build on your running emulator/simulator using local toolchains:

```bash
npm run dev:mobile:ios      # Compiles via Xcode tooling (xcodebuild)
npm run dev:mobile:android  # Compiles via Android SDK (gradle)
```

#### Native Project Generation (Continuous Native Generation)

To generate the underlying `/android` and `/ios` project directories for direct inspection or custom native configuration:

```bash
npm --prefix mobile run prebuild
```

#### Cloud Builds (EAS)

If building remotely via Expo Application Services:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

---

## Repository Commands

All commands run from the monorepo root:

| Command | Description |
|---|---|
| `npm run dev:backend` | Build and start backend inside Docker (`:8080`) |
| `npm run dev:mobile` | Start Expo Metro bundler for Expo Go |
| `npm run dev:mobile:ios` | Build and run native iOS app on simulator |
| `npm run dev:mobile:android` | Build and run native Android app on emulator |
| `npm test` | Run test suites across shared, backend, and mobile |
| `npm run typecheck` | Type-check all packages |
| `npm run lint` | Lint all packages |
