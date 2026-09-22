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

- **Docker** (Docker Desktop for macOS)
- **Node.js v24** (see `.nvmrc`) — only needed for the mobile Expo CLI
- **Android Studio** with an Android Emulator AVD configured (or Expo Go on a physical device)

---

## Quick Start (Reviewer Flow)

Run everything from the **repo root** — no `cd` required.

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start the Backend (Docker) + Mobile (Expo) Together

```bash
npm run dev:docker
```

This single command:
- Builds and starts the Fastify backend inside Docker on port `8080` (connects to live Binance streams)
- Starts the Expo Metro bundler for the mobile app
- Logs are color-prefixed (`[docker-be]` / `[mobile]`) in one terminal
- `Ctrl-C` cleanly stops both

### Step 3: Launch the App

Once you see the Expo QR code in the terminal:

| Target | Key / Command | Gateway URL (auto-detected) |
|---|---|---|
| **Android Emulator** | Press **`a`** | `ws://10.0.2.2:8080/ws` |
| **iOS Simulator** | Press **`i`** | `ws://localhost:8080/ws` |
| **Physical Device (Expo Go)** | Scan QR code | Set `EXPO_PUBLIC_GATEWAY_URL=ws://<your-lan-ip>:8080/ws` before starting |

The gateway URL is **automatically detected per platform** — no manual configuration needed for emulators/simulators.

---

## Running Backend and Mobile Separately (Two Terminals)

If you prefer separate terminals:

**Terminal 1 — Backend (Docker):**
```bash
npm run docker:up
```

**Terminal 2 — Mobile (Expo):**
```bash
npm run dev:mobile
```
Then press `a` (Android), `i` (iOS), or scan QR (physical device).

---

## Verifying the Backend

Once the backend is running (via Docker), verify from any terminal:

```bash
# Health check
curl -s http://localhost:8080/health | jq .

# Live market metadata (prices from Binance)
curl -s http://localhost:8080/pairs/meta | jq .

# Prometheus metrics
curl -s http://localhost:8080/metrics
```

---

## Physical Device (Expo Go over Wi-Fi)

To run on a physical device instead of an emulator:

1. Find your LAN IP: `ipconfig getifaddr en0`
2. Start with the gateway URL override:
   ```bash
   EXPO_PUBLIC_GATEWAY_URL=ws://<your-lan-ip>:8080/ws npm run dev:docker
   ```
3. Scan the QR code in the terminal with **Expo Go** on your phone.

---

## All Commands

All commands run from the repo root.

| Command | Description |
|---|---|
| `npm run dev:docker` | Start Docker backend + Expo mobile concurrently (recommended) |
| `npm run docker:up` | Start backend in Docker only |
| `npm run docker:down` | Stop Docker backend |
| `npm run dev:mobile` | Start Expo mobile dev server only |
| `npm run dev` | Start local `tsx watch` backend + Expo mobile (for backend code iteration) |
| `npm test` | Run all unit tests (shared + backend + mobile) |
| `npm run typecheck` | TypeScript type-check all workspaces |
| `npm run lint` | ESLint all workspaces |
